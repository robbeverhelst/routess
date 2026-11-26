import { HttpException, HttpStatus } from "@nestjs/common";
import type { Coordinate, ValhallaCostingRequest } from "@routess/core";

// The one seam between Routess and its routing engine. Callers speak in
// points, costings and domain-shaped results; the adapter behind it owns the
// provider protocol, the response caches (ADR 0032), the concurrency cap,
// the timeout and the metrics. ValhallaEngine is the production adapter,
// FakeRoutingEngine the in-memory one for tests.

export interface LatLon {
	lat: number;
	lon: number;
}

export type EngineCostingModel = "bicycle" | "pedestrian" | "auto";

/** A costing model, optionally tuned by the RoutingPreferences translation. */
export interface EngineCosting {
	costing: EngineCostingModel;
	costing_options?: ValhallaCostingRequest["costing_options"];
}

/** Which product surface a call serves; labels the provider-call metric. */
export type EngineFeature = "routing" | "generation" | "navigation";

export interface LocatePoint extends LatLon {
	/** Search radius around the point; the engine default when absent. */
	radiusM?: number;
}

/** One candidate edge a point can snap onto. */
export interface LocatedEdge {
	coordinate: Coordinate;
	distanceM?: number;
	/** Connected network through the edge (min of inbound and outbound). */
	reach: number;
	use?: string;
	surface?: string;
}

export interface LocatedPoint {
	edges: LocatedEdge[];
}

export interface EngineLocation extends LatLon {
	/** `through` forbids a U-turn at the location; `break` is the default. */
	type?: "break" | "through";
}

export interface EngineLeg {
	/** Polyline6-encoded leg shape. */
	shape?: string;
	lengthKm: number;
	timeS: number;
}

export interface SnappedLocation extends LatLon {
	originalIndex?: number;
}

export interface EngineRoute {
	legs: EngineLeg[];
	locations: SnappedLocation[];
}

export type EdgeAttribute =
	"wayId" | "surface" | "length" | "headings" | "shapeIndices" | "bicycleNetwork" | "roadClass";

export interface EdgeTraceRequest {
	/** Recorded points, or a polyline6 shape the engine produced itself. */
	shape: { points: LatLon[] } | { polyline: string };
	costing: EngineCosting;
	/** `snap` map-matches; `walk-or-snap` walks exact edges first. */
	match: "snap" | "walk-or-snap";
	attributes: readonly EdgeAttribute[];
}

export interface TracedEdge {
	wayId?: number;
	surface?: string;
	lengthKm?: number;
	beginHeadingDeg?: number;
	endHeadingDeg?: number;
	beginShapeIndex?: number;
	endShapeIndex?: number;
	onBikeNetwork?: boolean;
	roadClass?: string;
}

export interface EdgeTrace {
	edges: TracedEdge[];
	/** Polyline6-encoded matched shape the edge shape indices point into. */
	shape?: string;
}

export interface TracedManeuver {
	type?: number;
	instruction?: string;
	streetNames?: string[];
	beginShapeIndex?: number;
}

export interface TracedRouteLeg {
	/** The leg's matched shape, which can deviate from the input. */
	shape: Coordinate[];
	maneuvers: TracedManeuver[];
}

export interface TracedRoute {
	legs: TracedRouteLeg[];
}

export abstract class RoutingEngine {
	/** Snap candidates for each point, in input order. */
	abstract locate(points: LocatePoint[], costing: EngineCosting, feature?: EngineFeature): Promise<LocatedPoint[]>;

	/** Throws RoutingNoPathError when no route connects the locations. Cached. */
	abstract route(locations: EngineLocation[], costing: EngineCosting, feature?: EngineFeature): Promise<EngineRoute>;

	/** Per-edge attributes along a shape. Cached. */
	abstract traceEdges(request: EdgeTraceRequest, feature?: EngineFeature): Promise<EdgeTrace>;

	/** Map-matches a shape into narrated maneuvers in `language`. */
	abstract traceRoute(
		shape: LatLon[],
		costing: EngineCostingModel,
		language: string,
		feature?: EngineFeature,
	): Promise<TracedRoute>;

	/** Outer ring of the area reachable within `distanceKm` of road travel. */
	abstract isochrone(
		point: LatLon,
		costing: EngineCosting,
		distanceKm: number,
		feature?: EngineFeature,
	): Promise<Coordinate[]>;
}

// The three ways an engine call fails. Each is an HttpException so a caller
// that does not handle it still answers with the status the API has always
// used: 502 for a missing path or an upstream error, 503 when unavailable.

export class RoutingNoPathError extends HttpException {
	constructor(message = "Valhalla returned no trip") {
		super(message, HttpStatus.BAD_GATEWAY);
	}
}

/** The engine is at its concurrency cap and shed the call instead of queueing it. */
export class RoutingShedError extends HttpException {
	constructor() {
		super("Routing is busy, try again shortly", HttpStatus.SERVICE_UNAVAILABLE);
	}
}

/** Valhalla failed, timed out or is not configured (502 or 503). */
export class RoutingUpstreamError extends HttpException {}
