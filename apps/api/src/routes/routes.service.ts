import type { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Route } from "../entities/route.entity";
import type { MetricsService } from "../telemetry/metrics.service";
import type { CreateRouteDto } from "./dto/create-route.dto";
import type { UpdateRouteDto } from "./dto/update-route.dto";

@Injectable()
export class RoutesService {
	constructor(
		@InjectRepository(Route)
		private readonly routeRepository: EntityRepository<Route>,
		private readonly em: EntityManager,
		private readonly metricsService: MetricsService,
	) {}

	async create(createRouteDto: CreateRouteDto, userId: number): Promise<Route> {
		const route = this.routeRepository.create({
			...createRouteDto,
			user: userId,
		});

		await this.em.persistAndFlush(route);
		await this.em.populate(route, ["user"]);

		// Record route creation metric
		this.metricsService.recordRouteCreated(userId);

		return route;
	}

	async findAll(userId: number): Promise<Route[]> {
		return this.routeRepository.find(
			{ user: userId, deletedAt: null },
			{
				populate: ["user"],
				orderBy: { createdAt: "DESC" }, // Most recent routes first
				limit: 100, // Prevent loading too many routes at once
			},
		);
	}

	async findOne(id: number, userId: number): Promise<Route> {
		const route = await this.routeRepository.findOne({ id, user: userId, deletedAt: null }, { populate: ["user"] });

		if (!route) {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}

		return route;
	}

	async update(id: number, updateRouteDto: UpdateRouteDto, userId: number): Promise<Route> {
		const route = await this.findOne(id, userId);

		this.routeRepository.assign(route, updateRouteDto);
		await this.em.persistAndFlush(route);

		return route;
	}

	async remove(id: number, userId: number): Promise<void> {
		const route = await this.findOne(id, userId);
		route.deletedAt = new Date();
		await this.em.persistAndFlush(route);

		// Record route deletion metric
		this.metricsService.recordRouteDeleted(userId);
	}

	async hardDelete(id: number, userId: number): Promise<void> {
		const route = await this.routeRepository.findOne({ id, user: userId });
		if (!route) {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		await this.em.removeAndFlush(route);
	}
}
