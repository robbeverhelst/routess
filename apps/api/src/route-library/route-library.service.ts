import { EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Injectable } from "@nestjs/common";
import { Route } from "../entities/route.entity";

export interface RouteLibraryStatistics {
	totalRoutes: number;
	totalDistance: number;
}

@Injectable()
export class RouteLibraryService {
	constructor(
		@InjectRepository(Route)
		private readonly routeRepository: EntityRepository<Route>,
	) {}

	async statisticsFor(userId: number): Promise<RouteLibraryStatistics> {
		const routes = await this.routeRepository.find({ user: userId });
		return {
			totalRoutes: routes.length,
			totalDistance: routes.reduce((total, route) => total + (route.distance || 0), 0),
		};
	}
}
