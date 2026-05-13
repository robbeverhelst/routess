import { EntityManager, EntityRepository, wrap } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { Route } from "../entities/route.entity";
import type { User } from "../entities/user.entity";
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

type SerializableUser = Pick<User, "id" | "email" | "name" | "avatar" | "isEmailVerified" | "role" | "preferences">;

@Injectable()
export class RoutesService {
	constructor(
		@InjectRepository(Route)
		private readonly routeRepository: EntityRepository<Route>,
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
			privacy: route.privacy,
			tags: route.tags,
			waypoints: route.waypoints,
			geometry: route.geometry,
			distance: route.distance,
			duration: route.duration,
			elevationGain: route.elevationGain,
			startAddress: route.startAddress,
			endAddress: route.endAddress,
			user: toUserResponseDto(serializedUser, this.config.analytics.salt),
			createdAt: route.createdAt.toISOString(),
			updatedAt: route.updatedAt.toISOString(),
		};
	}

	async create(createRouteDto: CreateRouteDto, userId: number): Promise<RouteResponseDto> {
		const route = this.routeRepository.create({
			...createRouteDto,
			privacy: createRouteDto.privacy ?? "private",
			tags: createRouteDto.tags ?? [],
			user: userId,
		});
		await this.em.persistAndFlush(route);
		await this.em.populate(route, ["user"]);
		this.events.emit(ROUTE_CREATED, { userId } satisfies RouteCreatedEvent);
		return this.toResponseDto(route);
	}

	async findAll(userId: number): Promise<RouteResponseDto[]> {
		const routes = await this.routeRepository.find(
			{ user: userId },
			{ populate: ["user"], orderBy: { createdAt: "DESC" }, limit: 100 },
		);
		return routes.map((route) => this.toResponseDto(route));
	}

	async findOne(id: number, userId: number): Promise<RouteResponseDto> {
		const route = await this.findOwnedRouteOrFail(id, userId);
		return this.toResponseDto(route);
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
