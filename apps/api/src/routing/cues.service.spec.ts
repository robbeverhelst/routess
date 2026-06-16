import type { EntityRepository } from "@mikro-orm/core";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { type Coordinate, encodePolyline6 } from "@routess/core";
import { CacheService } from "../cache/cache.service";
import type { AppConfig } from "../config/app-config";
import type { ExternalRoute } from "../entities/external-route.entity";
import type { Route } from "../entities/route.entity";
import type { NodeNetworksService } from "../generation/node-networks.service";
import type { MetricsService } from "../telemetry/metrics.service";
import { CuesService } from "./cues.service";
import { RoutingService } from "./routing.service";

const originalFetch = globalThis.fetch;

// Straight west→east path at lat 51; 0.001° lng ≈ 70 m.
const PATH: Coordinate[] = Array.from({ length: 30 }, (_, i) => [4 + i * 0.001, 51]);

const metrics = {
	recordExternalRequest: () => undefined,
	recordProviderCall: () => undefined,
	recordCacheEvent: () => undefined,
} as unknown as MetricsService;

interface Stubs {
	route?: Partial<Route> | null;
	externalRoute?: Partial<ExternalRoute> | null;
	anchors?: { coordinate: Coordinate; ref?: string }[];
	anchorsThrow?: boolean;
}

function makeService(stubs: Stubs = {}): { service: CuesService; valhallaCalls: () => number } {
	const config = { routing: { valhallaUrl: "http://valhalla.test" }, cache: { redisUrl: "" } } as AppConfig;
	const cache = new CacheService(config, metrics);
	const routing = new RoutingService(config, metrics, cache);
	const nodeNetworks = {
		anchorsForBbox: async () => {
			if (stubs.anchorsThrow) throw new Error("tiles down");
			return stubs.anchors ?? [];
		},
	} as unknown as NodeNetworksService;
	const routeRepository = {
		findOne: async (where: { visibility?: unknown }) => {
			if (!stubs.route) return null;
			// Mirror the service's anonymous-visibility filter.
			const visible = (stubs.route.visibility ?? "private") !== "private";
			return where.visibility !== undefined && !visible ? null : stubs.route;
		},
	} as unknown as EntityRepository<Route>;
	const externalRouteRepository = {
		findOne: async () => stubs.externalRoute ?? null,
	} as unknown as EntityRepository<ExternalRoute>;
	const service = new CuesService(routing, cache, nodeNetworks, routeRepository, externalRouteRepository);
	return { service, valhallaCalls: () => calls };
}

let calls = 0;

function stubTraceRoute(maneuvers: { type?: number; instruction: string; begin_shape_index: number }[]): void {
	calls = 0;
	globalThis.fetch = (async () => {
		calls++;
		return new Response(JSON.stringify({ trip: { legs: [{ shape: encodePolyline6(PATH), maneuvers }] } }), {
			status: 200,
		});
	}) as typeof fetch;
}

function stubValhallaDown(): void {
	calls = 0;
	globalThis.fetch = (async () => {
		calls++;
		return new Response("boom", { status: 500 });
	}) as typeof fetch;
}

afterEach(() => {
	globalThis.fetch = originalFetch;
});

const BASE_REQUEST = { geometry: encodePolyline6(PATH), activity: "cycle" as const, locale: "en" as const };

describe("CuesService maneuver cues", () => {
	it("anchors maneuvers onto the stored path in order", async () => {
		const { service } = makeService();
		stubTraceRoute([
			{ type: 1, instruction: "Ride east.", begin_shape_index: 0 },
			{ type: 15, instruction: "Turn left onto Dijkpad.", begin_shape_index: 10 },
			{ type: 4, instruction: "You have arrived.", begin_shape_index: 29 },
		]);

		const result = await service.cues(BASE_REQUEST);

		expect(result.degraded).toBe(false);
		expect(result.cues.map((c) => c.kind)).toEqual(["maneuver", "maneuver", "maneuver"]);
		expect(result.cues[0].distanceAlongMeters).toBe(0);
		// 10 segments of ~70 m.
		expect(result.cues[1].distanceAlongMeters).toBeGreaterThan(600);
		expect(result.cues[1].distanceAlongMeters).toBeLessThan(800);
		expect(result.cues[1].text).toBe("Turn left onto Dijkpad.");
		const along = result.cues.map((c) => c.distanceAlongMeters);
		expect([...along].sort((a, b) => a - b)).toEqual(along);
	});

	it("serves a repeated request from cache (one Valhalla call)", async () => {
		const { service, valhallaCalls } = makeService();
		stubTraceRoute([{ type: 1, instruction: "Ride east.", begin_shape_index: 0 }]);

		const first = await service.cues(BASE_REQUEST);
		const second = await service.cues(BASE_REQUEST);

		expect(second).toEqual(first);
		expect(valhallaCalls()).toBe(1);
	});
});

describe("CuesService node decoration", () => {
	it("chains node passages into head-toward cues and skips the last node", async () => {
		const { service } = makeService({
			anchors: [
				// On the path at ~point 5, ~point 15, ~point 25.
				{ coordinate: [4.005, 51], ref: "47" },
				{ coordinate: [4.015, 51], ref: "52" },
				{ coordinate: [4.025, 51], ref: "61" },
				// 500 m north of the path: not a passage.
				{ coordinate: [4.01, 51.0045], ref: "99" },
			],
		});
		stubTraceRoute([{ type: 1, instruction: "Ride east.", begin_shape_index: 0 }]);

		const result = await service.cues(BASE_REQUEST);
		const nodeCues = result.cues.filter((c) => c.kind === "node");

		expect(nodeCues.map((c) => [c.nodeRef, c.nodeNextRef])).toEqual([
			["47", "52"],
			["52", "61"],
		]);
		expect(nodeCues[0].text).toBe("At node 47, head toward node 52");
		expect(result.cues.findIndex((c) => c.nodeRef === "47")).toBeGreaterThan(0);
	});

	it("decorates, never replaces: node failures still yield maneuver cues", async () => {
		const { service } = makeService({ anchorsThrow: true });
		stubTraceRoute([{ type: 1, instruction: "Ride east.", begin_shape_index: 0 }]);

		const result = await service.cues(BASE_REQUEST);
		expect(result.degraded).toBe(false);
		expect(result.cues).toHaveLength(1);
		expect(result.cues[0].kind).toBe("maneuver");
	});
});

describe("CuesService degradation", () => {
	it("falls back to a follow-the-path cue when Valhalla is down, without caching it", async () => {
		const { service, valhallaCalls } = makeService();
		stubValhallaDown();

		const degraded = await service.cues({ ...BASE_REQUEST, locale: "nl" });
		expect(degraded.degraded).toBe(true);
		expect(degraded.cues).toEqual([
			{ kind: "followPath", shapeIndex: 0, distanceAlongMeters: 0, text: "Volg de route" },
		]);

		// Valhalla recovers: the degraded answer must not have poisoned the cache.
		stubTraceRoute([{ type: 1, instruction: "Rijd naar het oosten.", begin_shape_index: 0 }]);
		const recovered = await service.cues({ ...BASE_REQUEST, locale: "nl" });
		expect(recovered.degraded).toBe(false);
		expect(recovered.cues[0].kind).toBe("maneuver");
		expect(valhallaCalls()).toBe(1);
	});
});

describe("CuesService geometry resolution", () => {
	it("rejects requests without exactly one selector", async () => {
		const { service } = makeService();
		expect(service.cues({ activity: "cycle" })).rejects.toThrow(BadRequestException);
		expect(service.cues({ ...BASE_REQUEST, routeId: 1 })).rejects.toThrow(BadRequestException);
	});

	it("resolves a public route by id", async () => {
		const { service } = makeService({ route: { visibility: "public", geometry: PATH } });
		stubTraceRoute([{ type: 1, instruction: "Ride east.", begin_shape_index: 0 }]);
		const result = await service.cues({ routeId: 7, activity: "cycle" });
		expect(result.cues[0].text).toBe("Ride east.");
	});

	it("404s a private route by id so ids stay unenumerable", async () => {
		const { service } = makeService({ route: { visibility: "private", geometry: PATH } });
		expect(service.cues({ routeId: 7, activity: "cycle" })).rejects.toThrow(NotFoundException);
	});

	it("resolves an external route by id", async () => {
		const { service } = makeService({ externalRoute: { geometry: PATH } });
		stubTraceRoute([{ type: 1, instruction: "Ride east.", begin_shape_index: 0 }]);
		const result = await service.cues({ externalRouteId: 3, activity: "walk" });
		expect(result.cues).toHaveLength(1);
	});

	it("rejects geometry with fewer than two points", async () => {
		const { service } = makeService();
		expect(service.cues({ geometry: encodePolyline6([[4, 51]]), activity: "cycle" })).rejects.toThrow(
			BadRequestException,
		);
	});
});
