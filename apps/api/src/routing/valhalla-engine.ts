import { Injectable } from "@nestjs/common";
import { type Coordinate, decodePolyline6 } from "@routess/core";

import { CacheService } from "../cache/cache.service";
import {
	type EdgeAttribute,
	type EdgeTrace,
	type EdgeTraceRequest,
	type EngineCosting,
	type EngineCostingModel,
	type EngineFeature,
	type EngineLocation,
	type EngineRoute,
	type LatLon,
	type LocatedPoint,
	type LocatePoint,
	RoutingEngine,
	RoutingNoPathError,
	type TracedRoute,
} from "./routing-engine";
import { ValhallaHttp } from "./valhalla-http";

// trace_attributes is a pure function of (shape, costing): same geometry
// always classifies the same until the OSM tiles refresh. /route is less
// cacheable (waypoint combos are near-unique) but a shorter TTL still dedupes
// generation-pipeline repeats and recalcs of saved routes. See ADR 0032.
const TRACE_CACHE_TTL_S = 30 * 24 * 60 * 60;
const ROUTE_CACHE_TTL_S = 7 * 24 * 60 * 60;

// Keys hash the exact Valhalla request body. The version tag keeps entries
// written before this adapter (a different value shape) from being read.
const CACHE_KEY_VERSION = 2;

const VALHALLA_EDGE_ATTRIBUTES: Record<EdgeAttribute, string[]> = {
	wayId: ["edge.way_id"],
	surface: ["edge.surface"],
	length: ["edge.length"],
	headings: ["edge.begin_heading", "edge.end_heading"],
	shapeIndices: ["edge.begin_shape_index", "edge.end_shape_index"],
	bicycleNetwork: ["edge.bicycle_network"],
	roadClass: ["edge.road_class"],
};
const EDGE_ATTRIBUTE_ORDER = Object.keys(VALHALLA_EDGE_ATTRIBUTES) as EdgeAttribute[];

interface ValhallaLocateEdge {
	correlated_lat?: number;
	correlated_lon?: number;
	distance?: number;
	outbound_reach?: number;
	inbound_reach?: number;
	edge?: {
		classification?: { classification?: string; use?: string; surface?: string };
	};
}

interface ValhallaLocateResult {
	edges?: ValhallaLocateEdge[] | null;
}

interface ValhallaRouteResponse {
	trip?: {
		legs?: { shape?: string; summary?: { length?: number; time?: number } }[];
		locations?: { lat?: number; lon?: number; original_index?: number }[];
	};
	error?: string;
}

interface ValhallaTraceEdge {
	way_id?: number;
	surface?: string;
	length?: number;
	begin_heading?: number;
	end_heading?: number;
	begin_shape_index?: number;
	end_shape_index?: number;
	// Valhalla returns the network membership mask as `bicycle_network`
	// (the request filter key is `edge.bicycle_network`); 0 = not signed.
	bicycle_network?: number | boolean;
	road_class?: string;
}

interface ValhallaTraceAttributesResponse {
	shape?: string;
	edges?: ValhallaTraceEdge[];
}

interface ValhallaTraceRouteResponse {
	trip?: {
		legs?: {
			shape?: string;
			maneuvers?: { type?: number; instruction?: string; street_names?: string[]; begin_shape_index?: number }[];
		}[];
	};
}

interface ValhallaIsochroneResponse {
	features?: {
		geometry?: { coordinates?: unknown[][] };
	}[];
}

@Injectable()
export class ValhallaEngine extends RoutingEngine {
	constructor(
		private readonly http: ValhallaHttp,
		private readonly cache: CacheService,
	) {
		super();
	}

	async locate(
		points: LocatePoint[],
		costing: EngineCosting,
		feature: EngineFeature = "routing",
	): Promise<LocatedPoint[]> {
		const results = await this.http.post<ValhallaLocateResult[]>(
			"/locate",
			{
				locations: points.map(({ lat, lon, radiusM }) => (radiusM ? { lat, lon, radius: radiusM } : { lat, lon })),
				costing: costing.costing,
				costing_options: costing.costing_options,
				verbose: true,
			},
			feature,
		);

		return points.map((_, i) => ({
			edges: (results[i]?.edges ?? []).flatMap((e) =>
				typeof e.correlated_lat === "number" && typeof e.correlated_lon === "number"
					? [
							{
								coordinate: [e.correlated_lon, e.correlated_lat] as Coordinate,
								distanceM: e.distance,
								reach: Math.min(e.outbound_reach ?? 0, e.inbound_reach ?? 0),
								use: e.edge?.classification?.use,
								surface: e.edge?.classification?.surface,
							},
						]
					: [],
			),
		}));
	}

	async route(
		locations: EngineLocation[],
		costing: EngineCosting,
		feature: EngineFeature = "routing",
	): Promise<EngineRoute> {
		const body = {
			locations: locations.map(({ lat, lon, type }) => (type ? { lat, lon, type } : { lat, lon })),
			costing: costing.costing,
			costing_options: costing.costing_options,
			directions_options: { units: "kilometers" },
			format: "json",
		};
		const cacheKey = this.cache.hashKey({ v: CACHE_KEY_VERSION, body });
		return this.cache.getOrSet("valhalla-route", cacheKey, ROUTE_CACHE_TTL_S, async () => {
			const data = await this.http.post<ValhallaRouteResponse>("/route", body, feature);
			if (data.error || !data.trip?.legs?.length) {
				throw new RoutingNoPathError(data.error ?? "Valhalla returned no trip");
			}

			return {
				legs: data.trip.legs.map((leg) => ({
					shape: leg.shape,
					lengthKm: leg.summary?.length ?? 0,
					timeS: leg.summary?.time ?? 0,
				})),
				locations: (data.trip.locations ?? []).flatMap((loc) =>
					typeof loc.lat === "number" && typeof loc.lon === "number"
						? [{ lat: loc.lat, lon: loc.lon, originalIndex: loc.original_index }]
						: [],
				),
			};
		});
	}

	async traceEdges(request: EdgeTraceRequest, feature: EngineFeature = "routing"): Promise<EdgeTrace> {
		const requested = new Set(request.attributes);
		const body = {
			...("points" in request.shape ? { shape: request.shape.points } : { encoded_polyline: request.shape.polyline }),
			shape_match: request.match === "snap" ? "map_snap" : "walk_or_snap",
			costing: request.costing.costing,
			costing_options: request.costing.costing_options,
			filters: {
				attributes: [
					...EDGE_ATTRIBUTE_ORDER.filter((a) => requested.has(a)).flatMap((a) => VALHALLA_EDGE_ATTRIBUTES[a]),
					"shape",
				],
				action: "include",
			},
		};
		const cacheKey = this.cache.hashKey({ v: CACHE_KEY_VERSION, body });
		return this.cache.getOrSet("valhalla-trace", cacheKey, TRACE_CACHE_TTL_S, async () => {
			const data = await this.http.post<ValhallaTraceAttributesResponse>("/trace_attributes", body, feature);
			return {
				edges: (data.edges ?? []).map((edge) => ({
					wayId: edge.way_id,
					surface: edge.surface,
					lengthKm: edge.length,
					beginHeadingDeg: edge.begin_heading,
					endHeadingDeg: edge.end_heading,
					beginShapeIndex: edge.begin_shape_index,
					endShapeIndex: edge.end_shape_index,
					onBikeNetwork:
						edge.bicycle_network === undefined
							? undefined
							: typeof edge.bicycle_network === "number"
								? edge.bicycle_network > 0
								: edge.bicycle_network === true,
					roadClass: edge.road_class,
				})),
				shape: data.shape,
			};
		});
	}

	async traceRoute(
		shape: LatLon[],
		costing: EngineCostingModel,
		language: string,
		feature: EngineFeature = "routing",
	): Promise<TracedRoute> {
		const data = await this.http.post<ValhallaTraceRouteResponse>(
			"/trace_route",
			{
				shape,
				shape_match: "map_snap",
				costing,
				directions_options: { units: "kilometers", language },
			},
			feature,
		);

		return {
			legs: (data.trip?.legs ?? []).map((leg) => ({
				shape: leg.shape ? decodePolyline6(leg.shape) : [],
				maneuvers: (leg.maneuvers ?? []).map((m) => ({
					type: m.type,
					instruction: m.instruction,
					streetNames: m.street_names,
					beginShapeIndex: m.begin_shape_index,
				})),
			})),
		};
	}

	async isochrone(
		point: LatLon,
		costing: EngineCosting,
		distanceKm: number,
		feature: EngineFeature = "routing",
	): Promise<Coordinate[]> {
		const data = await this.http.post<ValhallaIsochroneResponse>(
			"/isochrone",
			{
				locations: [{ lat: point.lat, lon: point.lon }],
				costing: costing.costing,
				costing_options: costing.costing_options,
				contours: [{ distance: distanceKm }],
				polygons: true,
			},
			feature,
		);
		const ring = data.features?.[0]?.geometry?.coordinates?.[0] ?? [];
		return ring.filter(
			(p): p is Coordinate => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number",
		);
	}
}
