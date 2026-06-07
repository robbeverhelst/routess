import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import { type Coordinate, destinationPoint, encodePolyline6 } from "@routess/core";
import { RoutingService } from "../routing/routing.service";
import { ROUTE_GENERATION_COMPLETED, type RouteGenerationCompletedEvent } from "../telemetry/domain-events";
import type { GenerateRequestDto } from "./dto/generate.dto";
import { GenerationService } from "./generation.service";

const GHENT: Coordinate = [3.7174, 51.0543];

const REQUEST: GenerateRequestDto = {
	start: { lat: GHENT[1], lon: GHENT[0] },
	activity: "cycle",
	targetDistanceKm: 30,
	heading: "any",
	preferences: { surfacePreference: "mixed", avoidFerries: true, avoidHighways: false },
};

// Fake Valhalla: answers /locate by echoing every point as snapped, /route
// with a circular loop near the target distance, /trace_attributes with
// distinct ways (a clean loop). Tests override pieces per scenario.
class FakeRouting {
	locateHandler: (body: { locations: { lat: number; lon: number }[] }) => unknown;
	routeHandler: (body: { locations: { lat: number; lon: number; type?: string }[] }) => unknown;
	traceHandler: (body: unknown) => unknown;
	calls: string[] = [];

	constructor() {
		this.locateHandler = (body) => {
			return body.locations.map((loc) => ({
				edges: [
					{
						correlated_lat: loc.lat,
						correlated_lon: loc.lon,
						distance: 5,
						outbound_reach: 50,
						inbound_reach: 50,
						edge: { classification: { classification: "residential", use: "road" } },
					},
				],
			}));
		};
		this.routeHandler = (body) => {
			const center = body.locations[0];
			const loop: Coordinate[] = [];
			for (let deg = 0; deg < 360; deg += 15) {
				loop.push(destinationPoint([center.lon, center.lat], deg, 30 / (2 * Math.PI)));
			}
			loop.push(loop[0]);
			return {
				trip: {
					legs: [{ shape: encodePolyline6(loop), summary: { length: 30, time: 5400 } }],
				},
			};
		};
		this.traceHandler = () => ({
			edges: Array.from({ length: 24 }, (_, i) => ({
				way_id: 100 + i,
				surface: "paved",
				length: 30 / 24,
				begin_heading: (i * 15) % 360,
				end_heading: (i * 15 + 10) % 360,
			})),
		});
	}

	callValhalla(path: string, body: unknown): Promise<unknown> {
		this.calls.push(path);
		if (path === "/locate") return Promise.resolve(this.locateHandler(body as never));
		if (path === "/route") return Promise.resolve(this.routeHandler(body as never));
		if (path === "/trace_attributes") return Promise.resolve(this.traceHandler(body));
		return Promise.reject(new Error(`unexpected path ${path}`));
	}
}

describe("GenerationService", () => {
	let service: GenerationService;
	let fake: FakeRouting;
	let emitter: EventEmitter2;
	let events: RouteGenerationCompletedEvent[];

	beforeEach(async () => {
		fake = new FakeRouting();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				GenerationService,
				{ provide: RoutingService, useValue: fake },
				{ provide: EventEmitter2, useValue: new EventEmitter2() },
			],
		}).compile();
		service = module.get(GenerationService);
		emitter = module.get(EventEmitter2);
		events = [];
		emitter.on(ROUTE_GENERATION_COMPLETED, (event: RouteGenerationCompletedEvent) => {
			events.push(event);
		});
	});

	it("returns up to 3 diverse candidates for a healthy network", async () => {
		// Make each bearing trace different ways so candidates stay diverse.
		let traceCount = 0;
		fake.traceHandler = () => {
			traceCount++;
			return {
				edges: Array.from({ length: 24 }, (_, i) => ({
					way_id: traceCount * 1000 + i,
					surface: "paved",
					length: 30 / 24,
					begin_heading: (i * 15) % 360,
					end_heading: (i * 15 + 10) % 360,
				})),
			};
		};

		const response = await service.generate(REQUEST);
		expect(response.failure).toBeUndefined();
		expect(response.candidates.length).toBe(3);
		const best = response.candidates[0];
		expect(best.overlapPct).toBe(0);
		expect(best.lowQuality).toBe(false);
		expect(best.distanceKm).toBe(30);
		expect(best.viaPoints).toHaveLength(3);
		expect(best.shape.length).toBeGreaterThan(10);
		expect(best.surfaceMetersByBucket.paved).toBeGreaterThan(29000);

		expect(events).toHaveLength(1);
		expect(events[0].outcome).toBe("succeeded");
		expect(events[0].candidateCount).toBe(3);
		expect(events[0].valhallaCalls).toBeGreaterThanOrEqual(17); // 1 locate + 8 routes + 8 traces
	});

	it("dedupes identical loops down to one candidate", async () => {
		// Default traceHandler returns the SAME way set for every bearing.
		const response = await service.generate(REQUEST);
		expect(response.candidates.length).toBe(1);
	});

	it("fails with start_not_routable when the start has no edges", async () => {
		fake.locateHandler = (body) => body.locations.map(() => ({ edges: null }));
		const response = await service.generate(REQUEST);
		expect(response.candidates).toEqual([]);
		expect(response.failure?.code).toBe("start_not_routable");
		expect(events[0]?.outcome).toBe("failed");
		expect(events[0]?.failureCode).toBe("start_not_routable");
	});

	it("fails with no_candidates_routable when every via is off-network", async () => {
		fake.locateHandler = (body) =>
			body.locations.map((loc, i) =>
				i === 0 ? { edges: [{ way_id: 1, correlated_lat: loc.lat, correlated_lon: loc.lon }] } : { edges: [] },
			);
		const response = await service.generate(REQUEST);
		expect(response.failure?.code).toBe("no_candidates_routable");
	});

	it("drops candidates whose vias snap too far away (locate snaps generously)", async () => {
		// Every via "snaps" to a road 20km away — off-network in practice.
		fake.locateHandler = (body) =>
			body.locations.map((loc, i) => ({
				edges: [
					i === 0
						? { way_id: 1, correlated_lat: loc.lat, correlated_lon: loc.lon }
						: { way_id: 1, correlated_lat: loc.lat + 0.2, correlated_lon: loc.lon },
				],
			}));
		const response = await service.generate(REQUEST);
		expect(response.failure?.code).toBe("no_candidates_routable");
	});

	it("fails with start_not_routable when the start snaps too far away", async () => {
		fake.locateHandler = (body) =>
			body.locations.map((loc) => ({
				edges: [{ way_id: 1, correlated_lat: loc.lat + 0.05, correlated_lon: loc.lon }],
			}));
		const response = await service.generate(REQUEST);
		expect(response.failure?.code).toBe("start_not_routable");
	});

	it("fails with no_candidates_routable when routing finds no trips", async () => {
		fake.routeHandler = () => ({ error: "No path could be found" });
		const response = await service.generate(REQUEST);
		expect(response.failure?.code).toBe("no_candidates_routable");
	});

	it("fails with all_candidates_low_quality when every loop is an out-and-back", async () => {
		// Every way traversed twice with reversed headings: overlap 100%.
		fake.traceHandler = () => ({
			edges: [
				{ way_id: 1, surface: "paved", length: 15, begin_heading: 90, end_heading: 90 },
				{ way_id: 1, surface: "paved", length: 15, begin_heading: 270, end_heading: 270 },
			],
		});
		const response = await service.generate(REQUEST);
		expect(response.failure?.code).toBe("all_candidates_low_quality");
		expect(response.failure?.bestOverlapPct).toBe(100);
	});

	it("fails with all_bearings_excluded when regenerate exhausted the fan", async () => {
		const response = await service.generate({
			...REQUEST,
			excludeBearings: [0, 45, 90, 135, 180, 225, 270, 315],
		});
		expect(response.failure?.code).toBe("all_bearings_excluded");
		expect(fake.calls).toHaveLength(0);
	});

	it("snaps vias past driveways and dead-end stubs to the nearest real road", async () => {
		// Per via, the nearest edges are a driveway and a low-reach dead-end
		// stub, both "snapping" far away (which would fail the snap-distance
		// guard); only the real road edge stays at the requested point. If the
		// picker preferred either bad edge, every candidate would be dropped.
		fake.locateHandler = (body) =>
			body.locations.map((loc, i) => ({
				edges:
					i === 0
						? [
								{
									correlated_lat: loc.lat,
									correlated_lon: loc.lon,
									distance: 5,
									outbound_reach: 50,
									inbound_reach: 50,
									edge: { classification: { classification: "residential", use: "road" } },
								},
							]
						: [
								{
									correlated_lat: loc.lat + 0.5,
									correlated_lon: loc.lon,
									distance: 3,
									outbound_reach: 50,
									inbound_reach: 50,
									edge: { classification: { classification: "service_other", use: "driveway" } },
								},
								{
									correlated_lat: loc.lat + 0.5,
									correlated_lon: loc.lon,
									distance: 8,
									outbound_reach: 2,
									inbound_reach: 50,
									edge: { classification: { classification: "residential", use: "road" } },
								},
								{
									correlated_lat: loc.lat,
									correlated_lon: loc.lon,
									distance: 20,
									outbound_reach: 50,
									inbound_reach: 50,
									edge: { classification: { classification: "residential", use: "road" } },
								},
							],
			}));

		const response = await service.generate(REQUEST);
		expect(response.failure).toBeUndefined();
		expect(response.candidates.length).toBeGreaterThan(0);
	});

	it("returns via points projected onto the loop geometry", async () => {
		const response = await service.generate(REQUEST);
		expect(response.failure).toBeUndefined();
		const candidate = response.candidates[0];
		const { decodePolyline6 } = await import("@routess/core");
		const geometry = decodePolyline6(candidate.shape);
		for (const via of candidate.viaPoints) {
			const minKm = Math.min(...geometry.map((g) => Math.hypot((g[0] - via.lon) * 68, (g[1] - via.lat) * 111)));
			expect(minKm).toBeLessThan(0.05);
		}
	});

	it("routes via points as `through` so the router cannot U-turn at them", async () => {
		let observedTypes: (string | undefined)[] = [];
		const original = fake.routeHandler;
		fake.routeHandler = (body) => {
			observedTypes = body.locations.map((l) => l.type);
			return original(body);
		};
		await service.generate(REQUEST);
		expect(observedTypes[0]).toBe("break");
		expect(observedTypes[observedTypes.length - 1]).toBe("break");
		for (const type of observedTypes.slice(1, -1)) expect(type).toBe("through");
	});

	it("refines the radius once when the routed distance misses badly", async () => {
		// First route per bearing comes back at double the target; the refined
		// plan (smaller circle) comes back on target.
		const routedDistances: number[] = [];
		fake.routeHandler = (body) => {
			const center = body.locations[0];
			const isRefined = routedDistances.filter((d) => d === 60).length > routedDistances.filter((d) => d === 30).length;
			const distance = isRefined ? 30 : 60;
			routedDistances.push(distance);
			const loop: Coordinate[] = [];
			for (let deg = 0; deg < 360; deg += 15) {
				loop.push(destinationPoint([center.lon, center.lat], deg, distance / (2 * Math.PI)));
			}
			loop.push(loop[0]);
			return {
				trip: { legs: [{ shape: encodePolyline6(loop), summary: { length: distance, time: 5400 } }] },
			};
		};

		const response = await service.generate(REQUEST);
		expect(response.failure).toBeUndefined();
		expect(response.candidates[0]?.distanceKm).toBe(30);
	});
});
