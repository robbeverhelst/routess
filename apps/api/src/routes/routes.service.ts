import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { INDEXABLE_MIN_DISTANCE_METERS, isRouteIndexable } from "@routess/core";
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
import type { CreateRouteDto } from "./dto/create-route.dto";
import type { PublicRouteSummaryDto } from "./dto/public-route-summary.dto";
import type { RouteResponseDto } from "./dto/route-response.dto";
import type { UpdateRouteDto } from "./dto/update-route.dto";
import { toRouteResponseDto } from "./route.mapper";

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
		return toRouteResponseDto(route, this.config.analytics.salt);
	}

	async create(createRouteDto: CreateRouteDto, userId: number): Promise<RouteResponseDto> {
		const owner = await this.userRepository.findOneOrFail({ id: userId });
		const ownerDefault = owner.preferences?.defaultRouteVisibility ?? "private";
		const route = this.routeRepository.create({
			...createRouteDto,
			visibility: createRouteDto.visibility ?? ownerDefault,
			tags: createRouteDto.tags ?? [],
			favourite: createRouteDto.favourite ?? false,
			provenance: createRouteDto.provenance ?? "valhalla",
			user: userId,
		});
		if (route.visibility === "public") {
			route.publishedAt = new Date();
		}
		await this.em.persistAndFlush(route);
		await this.em.populate(route, ["user"]);
		this.events.emit(ROUTE_CREATED, { userId } satisfies RouteCreatedEvent);
		return this.toResponseDto(route);
	}

	async findAll(userId: number, limit: number, offset: number): Promise<{ items: RouteResponseDto[]; total: number }> {
		const [routes, total] = await this.routeRepository.findAndCount(
			{ user: userId },
			{ populate: ["user"], orderBy: { createdAt: "DESC" }, limit, offset },
		);
		return { items: routes.map((route) => this.toResponseDto(route)), total };
	}

	// findOne (by numeric id): owners see their route regardless of visibility;
	// non-owners only see 'public'. Unlisted routes are NOT served by id — ids
	// are sequential and enumerable, which would defeat the "only people with
	// the link" tier; unlisted access goes through findOneByShareToken instead.
	// Everything else 404s (never 403, to avoid leaking existence).
	async findOne(id: number, viewerId: number | null): Promise<RouteResponseDto> {
		const route = await this.routeRepository.findOne({ id }, { populate: ["user"] });
		if (!route) {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		const ownerId = (route.user as unknown as User).id;
		const isOwner = viewerId !== null && ownerId === viewerId;
		if (!isOwner && route.visibility !== "public") {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		return this.toResponseDto(route);
	}

	// Share-link lookup: serves public and unlisted routes to anyone holding
	// the unguessable token. Private routes 404 even with the token (revoking
	// a share is as simple as flipping the route back to private).
	async findOneByShareToken(shareToken: string): Promise<RouteResponseDto> {
		const route = await this.routeRepository.findOne({ shareToken }, { populate: ["user"] });
		if (!route || route.visibility === "private") {
			throw new NotFoundException("Route not found");
		}
		return this.toResponseDto(route);
	}

	// Indexable public Routes for the landing sitemap and future RegionalHubs.
	// SQL prefilters the cheap conditions; the canonical gate (isRouteIndexable
	// in @routess/core) decides, so landing and API can never disagree. The
	// in-memory window is acceptable while the indexable corpus is small.
	async findIndexablePublic(limit: number, offset: number): Promise<{ items: PublicRouteSummaryDto[]; total: number }> {
		const candidates = await this.routeRepository.find(
			{ visibility: "public", distance: { $gte: INDEXABLE_MIN_DISTANCE_METERS } },
			{
				fields: ["id", "name", "distance", "description", "tags", "visibility", "updatedAt"],
				orderBy: { updatedAt: "DESC" },
				limit: 5000,
			},
		);
		const indexable = candidates.filter((route) => isRouteIndexable(route));
		const items = indexable.slice(offset, offset + limit).map((route) => ({
			id: route.id,
			name: route.name,
			distance: route.distance,
			updatedAt: route.updatedAt instanceof Date ? route.updatedAt.toISOString() : String(route.updatedAt),
		}));
		return { items, total: indexable.length };
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
		// PublishedAt: stamped on the first transition to public, never bumped
		// afterward — re-publishing restores feed position (CONTEXT.md).
		if (route.visibility === "public" && !route.publishedAt) {
			route.publishedAt = new Date();
		}
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

	// Same visibility semantics as findOne: ids serve owners and public routes;
	// unlisted GPX downloads go through the share token.
	async findForGpx(id: number, viewerId: number | null): Promise<Route> {
		const route = await this.routeRepository.findOne({ id });
		if (!route) {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		const ownerId = (route.user as unknown as { id: number }).id;
		const isOwner = viewerId !== null && ownerId === viewerId;
		if (!isOwner && route.visibility !== "public") {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		return route;
	}

	async findForGpxByShareToken(shareToken: string): Promise<Route> {
		const route = await this.routeRepository.findOne({ shareToken });
		if (!route || route.visibility === "private") {
			throw new NotFoundException("Route not found");
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
