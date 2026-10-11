import { EntityManager } from "@mikro-orm/core";
import { Injectable } from "@nestjs/common";

export interface RouteLibraryStatistics {
	totalRoutes: number;
	totalDistance: number;
}

@Injectable()
export class RouteLibraryService {
	constructor(private readonly em: EntityManager) {}

	// Aggregated in SQL so `/users/me` doesn't hydrate every Route (with its
	// waypoints and geometry) just to count them. Same rows as the ORM read:
	// the owner's Routes of any visibility, soft-deleted ones excluded.
	async statisticsFor(userId: number): Promise<RouteLibraryStatistics> {
		const rows = (await this.em.getConnection().execute(
			`select count(*)::int as count, coalesce(sum("distance"), 0)::float as distance
			from "route"
			where "user_id" = ? and "deleted_at" is null`,
			[userId],
		)) as Array<{ count: number; distance: number }>;
		const stats = rows[0] ?? { count: 0, distance: 0 };
		return { totalRoutes: stats.count, totalDistance: stats.distance };
	}
}
