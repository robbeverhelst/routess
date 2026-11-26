import type { Coordinate } from "@routess/core";
import {
	type EdgeTrace,
	type EdgeTraceRequest,
	type EngineCosting,
	type EngineCostingModel,
	type EngineLocation,
	type EngineRoute,
	type LatLon,
	type LocatedPoint,
	type LocatePoint,
	RoutingEngine,
	type TracedRoute,
} from "src/routing/routing-engine";

type EngineMethod = "locate" | "route" | "traceEdges" | "traceRoute" | "isochrone";

// In-memory RoutingEngine for tests that care about domain results, not the
// provider protocol. Defaults: every point snaps onto itself, a route is one
// straight leg through its locations, traces and isochrones are empty.
// Replace any handler per scenario; `calls` records the methods hit.
export class FakeRoutingEngine extends RoutingEngine {
	calls: EngineMethod[] = [];

	locateHandler = (points: LocatePoint[], _costing: EngineCosting): LocatedPoint[] =>
		points.map((p) => ({ edges: [{ coordinate: [p.lon, p.lat], distanceM: 0, reach: 50, use: "road" }] }));

	routeHandler = (locations: EngineLocation[], _costing: EngineCosting): EngineRoute => ({
		legs: [{ lengthKm: 0, timeS: 0 }],
		locations: locations.map((l, i) => ({ lat: l.lat, lon: l.lon, originalIndex: i })),
	});

	traceEdgesHandler = (_request: EdgeTraceRequest): EdgeTrace => ({ edges: [] });

	traceRouteHandler = (_shape: LatLon[], _costing: EngineCostingModel, _language: string): TracedRoute => ({
		legs: [],
	});

	isochroneHandler = (_point: LatLon, _costing: EngineCosting, _distanceKm: number): Coordinate[] => [];

	async locate(points: LocatePoint[], costing: EngineCosting): Promise<LocatedPoint[]> {
		this.calls.push("locate");
		return this.locateHandler(points, costing);
	}

	async route(locations: EngineLocation[], costing: EngineCosting): Promise<EngineRoute> {
		this.calls.push("route");
		return this.routeHandler(locations, costing);
	}

	async traceEdges(request: EdgeTraceRequest): Promise<EdgeTrace> {
		this.calls.push("traceEdges");
		return this.traceEdgesHandler(request);
	}

	async traceRoute(shape: LatLon[], costing: EngineCostingModel, language: string): Promise<TracedRoute> {
		this.calls.push("traceRoute");
		return this.traceRouteHandler(shape, costing, language);
	}

	async isochrone(point: LatLon, costing: EngineCosting, distanceKm: number): Promise<Coordinate[]> {
		this.calls.push("isochrone");
		return this.isochroneHandler(point, costing, distanceKm);
	}
}
