import { afterEach, describe, expect, it } from "bun:test";

import { type Coordinate, encodePolyline6 } from "@routess/core";

import { CacheService } from "../cache/cache.service";
import type { AppConfig } from "../config/app-config";
import type { MetricsService } from "../telemetry/metrics.service";
import { RoutingNoPathError, RoutingShedError, RoutingUpstreamError } from "./routing-engine";
import { traceSurfaceEdges } from "./routing.service";
import { ValhallaEngine } from "./valhalla-engine";
import { ValhallaHttp } from "./valhalla-http";

const originalFetch = globalThis.fetch;

const metrics = {
	recordExternalRequest: () => undefined,
	recordProviderCall: () => undefined,
	recordCacheEvent: () => undefined,
} as unknown as MetricsService;

interface Captured {
	path: string;
	body: Record<string, unknown>;
}

// Real in-memory CacheService (Redis disabled) behind a stubbed fetch, so the
// tests cover the adapter as production runs it.
function makeEngine(valhallaUrl = "http://valhalla.test", timeoutMs?: number): ValhallaEngine {
	const config = { routing: { valhallaUrl }, cache: { redisUrl: "" } } as AppConfig;
	const http = new ValhallaHttp(config, metrics);
	if (timeoutMs) http.timeoutMs = timeoutMs;
	return new ValhallaEngine(http, new CacheService(config, metrics));
}

// A 200 whose body never finishes, as fetch delivers it: the stream errors
// once the request's signal aborts.
function stalledBody(signal: AbortSignal): Response {
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(new TextEncoder().encode('{"features":'));
			signal.addEventListener("abort", () => controller.error(signal.reason));
		},
	});
	return new Response(stream, { status: 200 });
}

function stubFetch(respond: (path: string) => Response | Promise<Response>): Captured[] {
	const captured: Captured[] = [];
	globalThis.fetch = (async (url: string, init: RequestInit) => {
		const path = new URL(url).pathname;
		captured.push({ path, body: JSON.parse(init.body as string) });
		return respond(path);
	}) as unknown as typeof fetch;
	return captured;
}

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const BIKE = {
	costing: "bicycle" as const,
	costing_options: { bicycle: { use_ferry: 0, use_roads: 0.5, use_tracks: 0.5, avoid_bad_surfaces: 0.25 } },
};

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("ValhallaEngine.route", () => {
	it("normalizes legs and snapped locations and keeps location types", async () => {
		const captured = stubFetch(() =>
			json({
				trip: {
					legs: [{ shape: "abc", summary: { length: 1.5, time: 300 } }, { summary: {} }],
					locations: [{ lat: 1, lon: 2, original_index: 0 }, { lat: 3 }],
				},
			}),
		);

		const route = await makeEngine().route(
			[
				{ lat: 1, lon: 2, type: "break" },
				{ lat: 3, lon: 4 },
			],
			BIKE,
		);

		expect(route).toEqual({
			legs: [
				{ shape: "abc", lengthKm: 1.5, timeS: 300 },
				{ shape: undefined, lengthKm: 0, timeS: 0 },
			],
			locations: [{ lat: 1, lon: 2, originalIndex: 0 }],
		});
		expect(captured[0]).toEqual({
			path: "/route",
			body: {
				locations: [
					{ lat: 1, lon: 2, type: "break" },
					{ lat: 3, lon: 4 },
				],
				costing: "bicycle",
				costing_options: BIKE.costing_options,
				directions_options: { units: "kilometers" },
				format: "json",
			},
		});
	});

	it("serves a repeated route from cache and re-fetches a different costing", async () => {
		const captured = stubFetch(() => json({ trip: { legs: [{ shape: "abc", summary: { length: 1, time: 1 } }] } }));
		const engine = makeEngine();
		const locations = [
			{ lat: 1, lon: 2 },
			{ lat: 3, lon: 4 },
		];

		await engine.route(locations, BIKE);
		await engine.route(locations, BIKE);
		expect(captured).toHaveLength(1);

		await engine.route(locations, { costing: "pedestrian" });
		expect(captured).toHaveLength(2);
	});

	it("throws RoutingNoPathError for no trip and never caches it", async () => {
		const captured = stubFetch(() => json({ error: "No path could be found" }));
		const engine = makeEngine();
		const locations = [
			{ lat: 1, lon: 2 },
			{ lat: 3, lon: 4 },
		];

		const error = await engine.route(locations, BIKE).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(RoutingNoPathError);
		expect((error as RoutingNoPathError).getStatus()).toBe(502);
		expect((error as RoutingNoPathError).message).toBe("No path could be found");

		await engine.route(locations, BIKE).catch(() => undefined);
		expect(captured).toHaveLength(2);
	});
});

describe("ValhallaEngine.traceEdges", () => {
	it("requests attributes in a fixed order and normalizes edges", async () => {
		const captured = stubFetch(() =>
			json({
				shape: "matched",
				edges: [
					{ way_id: 7, surface: "gravel", length: 0.2, begin_shape_index: 0, end_shape_index: 3, bicycle_network: 2 },
					{ way_id: 8, bicycle_network: 0, road_class: "residential" },
					{ way_id: 9 },
				],
			}),
		);

		const trace = await makeEngine().traceEdges({
			shape: { polyline: "route-shape" },
			costing: BIKE,
			match: "walk-or-snap",
			attributes: ["roadClass", "shapeIndices", "wayId", "bicycleNetwork"],
		});

		expect(captured[0].path).toBe("/trace_attributes");
		expect(captured[0].body).toEqual({
			encoded_polyline: "route-shape",
			shape_match: "walk_or_snap",
			costing: "bicycle",
			costing_options: BIKE.costing_options,
			filters: {
				attributes: [
					"edge.way_id",
					"edge.begin_shape_index",
					"edge.end_shape_index",
					"edge.bicycle_network",
					"edge.road_class",
					"shape",
				],
				action: "include",
			},
		});
		expect(trace.shape).toBe("matched");
		expect(trace.edges[0]).toMatchObject({
			wayId: 7,
			surface: "gravel",
			lengthKm: 0.2,
			beginShapeIndex: 0,
			endShapeIndex: 3,
			onBikeNetwork: true,
		});
		expect(trace.edges[1]).toMatchObject({ wayId: 8, onBikeNetwork: false, roadClass: "residential" });
		expect(trace.edges[2].onBikeNetwork).toBeUndefined();
	});

	it("gives the trace-attributes endpoint and surface derivation one shared cache entry", async () => {
		const captured = stubFetch(() =>
			json({ shape: "s", edges: [{ surface: "paved", length: 1, begin_shape_index: 0, end_shape_index: 1 }] }),
		);
		const engine = makeEngine();
		const points = [
			{ lat: 1, lon: 2 },
			{ lat: 3, lon: 4 },
		];

		const first = await traceSurfaceEdges(engine, points, "bicycle");
		const second = await traceSurfaceEdges(engine, points, "bicycle");

		expect(second).toEqual(first);
		expect(first.edges).toEqual([{ surface: "paved", length: 1, begin_shape_index: 0, end_shape_index: 1 }]);
		expect(captured).toHaveLength(1);
		expect(captured[0].body).toEqual({
			shape: points,
			shape_match: "map_snap",
			costing: "bicycle",
			filters: {
				attributes: ["edge.surface", "edge.length", "edge.begin_shape_index", "edge.end_shape_index", "shape"],
				action: "include",
			},
		});
	});
});

describe("ValhallaEngine.locate", () => {
	it("passes search radii and keeps only edges with a snapped coordinate", async () => {
		const captured = stubFetch(() =>
			json([
				{
					edges: [
						{
							correlated_lat: 1.1,
							correlated_lon: 2.1,
							distance: 12,
							outbound_reach: 50,
							inbound_reach: 8,
							edge: { classification: { use: "road", surface: "paved" } },
						},
						{ distance: 3 },
					],
				},
				{ edges: null },
			]),
		);

		const located = await makeEngine().locate(
			[
				{ lat: 1, lon: 2, radiusM: 500 },
				{ lat: 3, lon: 4 },
				{ lat: 5, lon: 6 },
			],
			BIKE,
		);

		expect(captured[0].body.locations).toEqual([
			{ lat: 1, lon: 2, radius: 500 },
			{ lat: 3, lon: 4 },
			{ lat: 5, lon: 6 },
		]);
		expect(captured[0].body.verbose).toBe(true);
		expect(located).toEqual([
			{ edges: [{ coordinate: [2.1, 1.1], distanceM: 12, reach: 8, use: "road", surface: "paved" }] },
			{ edges: [] },
			{ edges: [] },
		]);
	});
});

describe("ValhallaEngine.traceRoute and isochrone", () => {
	it("decodes matched leg shapes and maneuvers", async () => {
		const matched: Coordinate[] = [
			[4, 51],
			[4.001, 51],
		];
		const captured = stubFetch(() =>
			json({
				trip: {
					legs: [
						{
							shape: encodePolyline6(matched),
							maneuvers: [{ type: 15, instruction: "Turn left.", street_names: ["Dijkpad"], begin_shape_index: 1 }],
						},
					],
				},
			}),
		);

		const traced = await makeEngine().traceRoute([{ lat: 51, lon: 4 }], "bicycle", "nl-NL", "navigation");

		expect(captured[0].body).toEqual({
			shape: [{ lat: 51, lon: 4 }],
			shape_match: "map_snap",
			costing: "bicycle",
			directions_options: { units: "kilometers", language: "nl-NL" },
		});
		expect(traced.legs[0].shape).toEqual(matched);
		expect(traced.legs[0].maneuvers).toEqual([
			{ type: 15, instruction: "Turn left.", streetNames: ["Dijkpad"], beginShapeIndex: 1 },
		]);
	});

	it("returns the isochrone's outer ring without malformed points", async () => {
		stubFetch(() =>
			json({
				features: [
					{
						geometry: {
							coordinates: [
								[
									[1, 2],
									["x", 3],
									[3, 4],
								],
							],
						},
					},
				],
			}),
		);

		const ring = await makeEngine().isochrone({ lat: 2, lon: 1 }, BIKE, 10);

		expect(ring).toEqual([
			[1, 2],
			[3, 4],
		]);
	});
});

describe("ValhallaHttp failures", () => {
	it("maps an upstream error status to a 502 RoutingUpstreamError", async () => {
		stubFetch(() => new Response("boom", { status: 500 }));
		const error = await makeEngine()
			.isochrone({ lat: 1, lon: 2 }, BIKE, 5)
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(RoutingUpstreamError);
		expect((error as RoutingUpstreamError).getStatus()).toBe(502);
	});

	it("maps a network failure to a 503 RoutingUpstreamError", async () => {
		globalThis.fetch = (async () => {
			throw new Error("ECONNREFUSED");
		}) as unknown as typeof fetch;
		const error = await makeEngine()
			.isochrone({ lat: 1, lon: 2 }, BIKE, 5)
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(RoutingUpstreamError);
		expect((error as RoutingUpstreamError).getStatus()).toBe(503);
	});

	it("answers 503 when Valhalla is not configured", async () => {
		const error = await makeEngine("")
			.isochrone({ lat: 1, lon: 2 }, BIKE, 5)
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(RoutingUpstreamError);
		expect((error as RoutingUpstreamError).getStatus()).toBe(503);
	});

	it("times out a body that stalls after the headers", async () => {
		globalThis.fetch = (async (_url: string, init: RequestInit) =>
			stalledBody(init.signal as AbortSignal)) as unknown as typeof fetch;
		const error = await makeEngine("http://valhalla.test", 50)
			.isochrone({ lat: 1, lon: 2 }, BIKE, 5)
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(RoutingUpstreamError);
		expect((error as RoutingUpstreamError).getStatus()).toBe(503);
	});

	it("holds the concurrency slot until the body is read", async () => {
		globalThis.fetch = (async (_url: string, init: RequestInit) =>
			stalledBody(init.signal as AbortSignal)) as unknown as typeof fetch;
		const engine = makeEngine("http://valhalla.test", 200);

		const inFlight = Array.from({ length: 32 }, (_, i) =>
			engine.isochrone({ lat: i, lon: 0 }, BIKE, 5).catch((e: unknown) => e),
		);
		// Let every call get its headers and start reading.
		await Bun.sleep(10);
		const error = await engine.isochrone({ lat: 99, lon: 0 }, BIKE, 5).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(RoutingShedError);
		await Promise.all(inFlight);
	});

	it("sheds the call past the concurrency cap instead of queueing it", async () => {
		const pending: ((r: Response) => void)[] = [];
		stubFetch(() => new Promise<Response>((resolve) => pending.push(resolve)));
		const engine = makeEngine();

		const inFlight = Array.from({ length: 32 }, (_, i) => engine.isochrone({ lat: i, lon: 0 }, BIKE, 5));
		const error = await engine.isochrone({ lat: 99, lon: 0 }, BIKE, 5).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(RoutingShedError);
		expect((error as RoutingShedError).getStatus()).toBe(503);
		for (const resolve of pending) resolve(json({ features: [] }));
		await Promise.all(inFlight);
	});
});
