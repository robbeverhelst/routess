import { EntityManager, EntityRepository, type FilterQuery, wrap } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { RouteActivity, RouteVisibility } from "@routess/core";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import {
	ROUTE_CREATED,
	ROUTE_DELETED,
	type RouteCreatedEvent,
	type RouteDeletedEvent,
} from "../telemetry/domain-events";
import { toUserResponseDto } from "../users/user.mapper";
import type { CreateRouteDto } from "./dto/create-route.dto";
import type { RouteResponseDto } from "./dto/route-response.dto";
import type { UpdateRouteDto } from "./dto/update-route.dto";

export type RouteListSort = "recent" | "created" | "name" | "distance" | "elevation";

export interface RouteListQuery {
	q?: string;
	activity?: RouteActivity;
	visibility?: RouteVisibility;
	tags?: string[];
	sort?: RouteListSort;
}

const LIST_LIMIT = 500;

type SerializableUser = Pick<
	User,
	| "id"
	| "email"
	| "name"
	| "avatar"
	| "isEmailVerified"
	| "role"
	| "preferences"
	| "deletionStatus"
	| "deletionRequestedAt"
>;

@Injectable()
export class RoutesService {
	constructor(
		@InjectRepository(Route)
		private readonly routeRepository: EntityRepository<Route>,
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
		private readonly em: EntityManager,
		private readonly events: EventEmitter2,
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
	) {}

	private toResponseDto(route: Route): RouteResponseDto {
		const serializedUser = wrap(route.user).toJSON() as SerializableUser;
		return {
			id: route.id,
			name: route.name,
			description: route.description,
			activity: route.activity,
			visibility: route.visibility,
			tags: route.tags,
			waypoints: route.waypoints,
			geometry: route.geometry,
			distance: route.distance,
			duration: route.duration,
			elevationGain: route.elevationGain,
			startAddress: route.startAddress,
			endAddress: route.endAddress,
			routingPreferences: route.routingPreferences ?? null,
			provenance: route.provenance,
			user: toUserResponseDto(serializedUser, this.config.analytics.salt),
			createdAt: route.createdAt.toISOString(),
			updatedAt: route.updatedAt.toISOString(),
		};
	}

	async create(createRouteDto: CreateRouteDto, userId: number): Promise<RouteResponseDto> {
		const owner = await this.userRepository.findOneOrFail({ id: userId });
		const ownerDefault = owner.preferences?.defaultRouteVisibility ?? "private";
		const route = this.routeRepository.create({
			...createRouteDto,
			visibility: createRouteDto.visibility ?? ownerDefault,
			tags: createRouteDto.tags ?? [],
			provenance: createRouteDto.provenance ?? "valhalla",
			user: userId,
		});
		await this.em.persistAndFlush(route);
		await this.em.populate(route, ["user"]);
		this.events.emit(ROUTE_CREATED, { userId } satisfies RouteCreatedEvent);
		return this.toResponseDto(route);
	}

	async findAll(userId: number, query: RouteListQuery = {}): Promise<RouteResponseDto[]> {
		const where: FilterQuery<Route> = { user: userId };
		if (query.activity) where.activity = query.activity;
		if (query.visibility) where.visibility = query.visibility;
		if (query.q?.trim()) {
			const term = `%${query.q.trim()}%`;
			(where as Record<string, unknown>).$or = [{ name: { $ilike: term } }, { description: { $ilike: term } }];
		}
		if (query.tags && query.tags.length > 0) {
			(where as Record<string, unknown>).tags = { $contains: query.tags };
		}
		const orderBy = this.resolveOrderBy(query.sort ?? "recent");
		const routes = await this.routeRepository.find(where, {
			populate: ["user"],
			orderBy,
			limit: LIST_LIMIT,
		});
		return routes.map((route) => this.toResponseDto(route));
	}

	private resolveOrderBy(sort: RouteListSort): Record<string, "ASC" | "DESC"> {
		switch (sort) {
			case "created":
				return { createdAt: "DESC" };
			case "name":
				return { name: "ASC" };
			case "distance":
				return { distance: "DESC" };
			case "elevation":
				return { elevationGain: "DESC" };
			default:
				return { updatedAt: "DESC" };
		}
	}

	async listTags(userId: number): Promise<Array<{ tag: string; count: number }>> {
		const routes = await this.routeRepository.find({ user: userId }, { fields: ["tags"], limit: LIST_LIMIT });
		const counts = new Map<string, number>();
		for (const route of routes) {
			for (const tag of route.tags ?? []) {
				counts.set(tag, (counts.get(tag) ?? 0) + 1);
			}
		}
		return Array.from(counts.entries())
			.map(([tag, count]) => ({ tag, count }))
			.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
	}

	// findOne: returns the Route if the viewer is the owner, OR if the route's
	// visibility is 'public' or 'unlisted'. Private routes 404 to non-owners (we
	// avoid 403 to prevent leaking existence). Anonymous viewers (viewerId=null)
	// are treated as non-owners.
	async findOne(id: number, viewerId: number | null): Promise<RouteResponseDto> {
		const route = await this.routeRepository.findOne({ id }, { populate: ["user"] });
		if (!route) {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		const ownerId = (route.user as unknown as User).id;
		const isOwner = viewerId !== null && ownerId === viewerId;
		if (!isOwner && route.visibility === "private") {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		return this.toResponseDto(route);
	}

	// Public-only listing for someone else's library. Excludes 'private' and
	// 'unlisted' so that "browse Alice's routes" only surfaces Routes she has
	// explicitly marked discoverable.
	async findPublicByOwner(ownerId: number): Promise<RouteResponseDto[]> {
		const routes = await this.routeRepository.find(
			{ user: ownerId, visibility: "public" },
			{ populate: ["user"], orderBy: { createdAt: "DESC" }, limit: 100 },
		);
		return routes.map((r) => this.toResponseDto(r));
	}

	async update(id: number, updateRouteDto: UpdateRouteDto, userId: number): Promise<RouteResponseDto> {
		const route = await this.findOwnedRouteOrFail(id, userId);
		this.routeRepository.assign(route, updateRouteDto);
		await this.em.persistAndFlush(route);
		await this.em.populate(route, ["user"]);
		return this.toResponseDto(route);
	}

	async remove(id: number, userId: number): Promise<void> {
		const route = await this.findOwnedRouteOrFail(id, userId);
		route.deletedAt = new Date();
		await this.em.persistAndFlush(route);
		this.events.emit(ROUTE_DELETED, { userId } satisfies RouteDeletedEvent);
	}

	async findForGpx(id: number, viewerId: number | null): Promise<Route> {
		const route = await this.routeRepository.findOne({ id });
		if (!route) {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		const ownerId = (route.user as unknown as { id: number }).id;
		const isOwner = viewerId !== null && ownerId === viewerId;
		if (!isOwner && route.visibility === "private") {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		return route;
	}

	async hardDelete(id: number, userId: number): Promise<void> {
		const route = await this.routeRepository.findOne({ id, user: userId }, { filters: { softDelete: false } });
		if (!route) {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		await this.em.removeAndFlush(route);
	}

	private async findOwnedRouteOrFail(id: number, userId: number): Promise<Route> {
		const route = await this.routeRepository.findOne({ id, user: userId }, { populate: ["user"] });
		if (!route) {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		return route;
	}
}
