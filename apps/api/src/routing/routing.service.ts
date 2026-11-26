import { Injectable, Logger } from "@nestjs/common";
import { valhallaCostingFromPreferences } from "@routess/core";

import type { RouteRequestDto, RoutingRouteResponseDto } from "./dto/route.dto";
import type { TraceAttributesRequestDto, TraceAttributesResponseDto } from "./dto/trace-attributes.dto";
import { type EngineCostingModel, type LatLon, RoutingEngine, RoutingNoPathError } from "./routing-engine";

// Per-edge surface data for a shape. Shared by the trace-attributes endpoint
// and save-time surface derivation, so both make the same engine call and a
// save usually hits the entry the editing session already cached.
export async function traceSurfaceEdges(
	engine: RoutingEngine,
	points: LatLon[],
	costing: EngineCostingModel,
): Promise<TraceAttributesResponseDto> {
	const trace = await engine.traceEdges({
		shape: { points },
		costing: { costing },
		match: "snap",
		attributes: ["surface", "length", "shapeIndices"],
	});
	return {
		edges: trace.edges.map((edge) => ({
			surface: edge.surface,
			length: edge.lengthKm,
			begin_shape_index: edge.beginShapeIndex,
			end_shape_index: edge.endShapeIndex,
		})),
		shape: trace.shape,
	};
}

// Translates the public routing endpoints' DTOs to RoutingEngine calls.
@Injectable()
export class RoutingService {
	private readonly logger = new Logger(RoutingService.name);

	constructor(private readonly engine: RoutingEngine) {}

	async traceAttributes(request: TraceAttributesRequestDto): Promise<TraceAttributesResponseDto> {
		return traceSurfaceEdges(this.engine, request.shape, request.costing);
	}

	async route(request: RouteRequestDto): Promise<RoutingRouteResponseDto> {
		const costing = valhallaCostingFromPreferences(request.activity, request.preferences, {
			walkingSpeedKmh: request.walkingSpeedKmh,
		});
		const locations = request.locations.map((l) => ({ lat: l.lat, lon: l.lon }));

		let route: Awaited<ReturnType<RoutingEngine["route"]>>;
		try {
			route = await this.engine.route(locations, costing);
		} catch (err) {
			if (err instanceof RoutingNoPathError) this.logger.warn(`Valhalla /route returned no trip: ${err.message}`);
			throw err;
		}

		return {
			legs: route.legs.flatMap((leg) =>
				typeof leg.shape === "string" ? [{ shape: leg.shape, summary: { length: leg.lengthKm, time: leg.timeS } }] : [],
			),
			locations: route.locations.map((loc) => ({ lat: loc.lat, lon: loc.lon, original_index: loc.originalIndex })),
		};
	}
}
