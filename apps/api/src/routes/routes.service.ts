import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
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
