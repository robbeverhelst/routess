import { EntityManager } from "@mikro-orm/core";
import { Injectable, Logger } from "@nestjs/common";
import { downsampleCoordinates, surfaceCompositionFromEdges, valhallaCostingModelForActivity } from "@routess/core";
import { Route } from "../entities/route.entity";
import type { ValhallaCosting } from "../routing/dto/trace-attributes.dto";
import { RoutingService } from "../routing/routing.service";

const MAX_SHAPE_POINTS = 1500;

// Derives a Route's persisted surface composition (ADR 0031) through the
// cached trace_attributes path, so the editing session's calls usually make
// this free. Fail-open like Place derivation: errors leave the column null
// and the next geometry save retries.
@Injectable()
export class SurfaceCompositionService {
	private readonly logger = new Logger(SurfaceCompositionService.name);

	constructor(
		private readonly em: EntityManager,
		private readonly routing: RoutingService,
	) {}

	// Fire-and-forget entry point used after route saves. Forks the EM so it
	// is safe to run after the request context that triggered it has closed.
	async deriveForRoute(routeId: number): Promise<void> {
		try {
			const em = this.em.fork();
			const route = await em.findOne(Route, { id: routeId });
			if (!route?.geometry || route.geometry.length < 2) return;
			const shape = downsampleCoordinates(route.geometry, MAX_SHAPE_POINTS).map(([lng, lat]) => ({ lat, lon: lng }));
			const costing = valhallaCostingModelForActivity(route.activity ?? "cycle") as ValhallaCosting;
			const data = await this.routing.traceAttributes({ shape, costing });
			const composition = surfaceCompositionFromEdges(data.edges, data.shape);
			if (!composition) return;
			route.surfaceComposition = composition;
			await em.persist(route).flush();
		} catch (error) {
			this.logger.warn(
				`Surface derivation failed for route ${routeId}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
