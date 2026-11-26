import { beforeEach, describe, expect, it } from "bun:test";

import { EventEmitter2 } from "@nestjs/event-emitter";
import { type Coordinate, destinationPoint, encodePolyline6 } from "@routess/core";
import type { GenerateRequestDto } from "src/generation/dto/generate.dto";
import { GenerationService } from "src/generation/generation.service";
import type { NodeNetworksService } from "src/generation/node-networks.service";
import { RoutingNoPathError, RoutingShedError } from "src/routing/routing-engine";

import { FakeRoutingEngine } from "../../fixtures/mocks/fake-routing-engine";

// Generation against the in-memory RoutingEngine: domain-level results, no
// Valhalla protocol. generation.service.spec.ts pins the requests instead.

const GHENT: Coordinate = [3.7174, 51.0543];

const REQUEST: GenerateRequestDto = {
	start: { lat: GHENT[1], lon: GHENT[0] },
	activity: "cycle",
	targetDistanceKm: 30,
	heading: "any",
	preferences: { surfacePreference: "mixed", avoidFerries: true, avoidHighways: false },
};

function circleLoop(center: Coordinate, distanceKm: number): string {
	const loop: Coordinate[] = [];
	for (let deg = 0; deg < 360; deg += 15) loop.push(destinationPoint(center, deg, distanceKm / (2 * Math.PI)));
	loop.push(loop[0]);
	return encodePolyline6(loop);
}

describe("GenerationService on a RoutingEngine", () => {
	let engine: FakeRoutingEngine;
	let service: GenerationService;

	beforeEach(() => {
		engine = new FakeRoutingEngine();
		engine.routeHandler = (locations) => ({
			legs: [{ shape: circleLoop([locations[0].lon, locations[0].lat], 30), lengthKm: 30, timeS: 5400 }],
			locations: [],
		});
		let trace = 0;
		engine.traceEdgesHandler = () => {
			trace++;
			return {
				edges: Array.from({ length: 24 }, (_, i) => ({
					wayId: trace * 1000 + i,
					surface: "paved",
					lengthKm: 30 / 24,
					beginHeadingDeg: (i * 15) % 360,
					endHeadingDeg: (i * 15 + 10) % 360,
					onBikeNetwork: true,
				})),
			};
		};
		const nodes = { anchorsForBbox: async () => [] } as unknown as NodeNetworksService;
		service = new GenerationService(engine, nodes, new EventEmitter2());
	});

	it("scores candidates from the engine's routes and edge traces", async () => {
		const response = await service.generate(REQUEST);

		expect(response.failure).toBeUndefined();
		expect(response.candidates.length).toBeGreaterThan(0);
		expect(response.candidates[0].distanceKm).toBe(30);
		expect(engine.calls.filter((c) => c === "locate")).toHaveLength(1);
	});

	it("treats a missing path as an unroutable candidate, then tries the isochrone fallback", async () => {
		engine.routeHandler = () => {
			throw new RoutingNoPathError("No path could be found");
		};

		const response = await service.generate(REQUEST);

		expect(response.failure?.code).toBe("no_candidates_routable");
		expect(engine.calls).toContain("isochrone");
		expect(engine.calls).not.toContain("traceEdges");
	});

	it("lets a shed locate escape instead of reporting a generation failure", async () => {
		engine.locateHandler = () => {
			throw new RoutingShedError();
		};

		await expect(service.generate(REQUEST)).rejects.toBeInstanceOf(RoutingShedError);
	});

	it("reports a shed fan as routing busy, not as no_candidates_routable", async () => {
		engine.routeHandler = () => {
			throw new RoutingShedError();
		};

		await expect(service.generate(REQUEST)).rejects.toBeInstanceOf(RoutingShedError);
	});

	it("still returns the candidates that routed when only some calls were shed", async () => {
		const routeOk = engine.routeHandler;
		let calls = 0;
		engine.routeHandler = (locations, costing) => {
			calls++;
			if (calls % 2 === 0) throw new RoutingShedError();
			return routeOk(locations, costing);
		};

		const response = await service.generate(REQUEST);

		expect(response.failure).toBeUndefined();
		expect(response.candidates.length).toBeGreaterThan(0);
	});
});
