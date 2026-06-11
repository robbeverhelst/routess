import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, type TestingModule } from "@nestjs/testing";
import { type Coordinate, destinationPoint, encodePolyline6, type GenerationAnchor, loopRadiusKm } from "@routess/core";
import { RoutingService } from "../routing/routing.service";
import { ROUTE_GENERATION_COMPLETED, type RouteGenerationCompletedEvent } from "../telemetry/domain-events";
import type { GenerateRequestDto } from "./dto/generate.dto";
import { GenerationService } from "./generation.service";
import { NodeNetworksService } from "./node-networks.service";

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
	isochroneHandler: (body: { locations: { lat: number; lon: number }[]; contours: { distance: number }[] }) => unknown;
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
		this.isochroneHandler = (body) => {
			const center = body.locations[0];
			const ring: [number, number][] = [];
			for (let deg = 0; deg <= 360; deg += 10) {
				ring.push(destinationPoint([center.lon, center.lat], deg, body.contours[0].distance));
			}
			return { features: [{ geometry: { coordinates: [ring] } }] };
		};
	}

	callValhalla(path: string, body: unknown): Promise<unknown> {
		this.calls.push(path);
		if (path === "/locate") return Promise.resolve(this.locateHandler(body as never));
		if (path === "/route") return Promise.resolve(this.routeHandler(body as never));
		if (path === "/trace_attributes") return Promise.resolve(this.traceHandler(body));
		if (path === "/isochrone") return Promise.resolve(this.isochroneHandler(body as never));
		return Promise.reject(new Error(`unexpected path ${path}`));
	}
}

// Fake node tiles: an empty pool by default (out of coverage); tests place
// Nodes explicitly.
class FakeNodeNetworks {
	enabled = true;
	pool: GenerationAnchor[] = [];

	anchorsForBbox(): Promise<GenerationAnchor[]> {
		return Promise.resolve(this.pool);
	}
}

describe("GenerationService", () => {
	let service: GenerationService;
	let fake: FakeRouting;
	let nodes: FakeNodeNetworks;
	let emitter: EventEmitter2;
	let events: RouteGenerationCompletedEvent[];

	beforeEach(async () => {
		fake = new FakeRouting();
		nodes = new FakeNodeNetworks();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				GenerationService,
				{ provide: RoutingService, useValue: fake },
				{ provide: NodeNetworksService, useValue: nodes },
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

	it("nudges vias onto the preferred surface when one is within the search radius", async () => {
		// Each via gets two candidate edges: tarmac at the requested point and
		// gravel 0.001° north. With an unpaved preference the gravel edge must
		// win even though it is farther.
		const requestedViaLats = new Set<number>();
		fake.locateHandler = (body) =>
			body.locations.map((loc, i) => {
				if (i > 0) requestedViaLats.add(loc.lat);
				const paved = {
					correlated_lat: loc.lat,
					correlated_lon: loc.lon,
					distance: 5,
					outbound_reach: 50,
					inbound_reach: 50,
					edge: { classification: { classification: "residential", use: "road", surface: "paved" } },
				};
				const gravel = {
					correlated_lat: loc.lat + 0.001,
					correlated_lon: loc.lon,
					distance: 120,
					outbound_reach: 50,
					inbound_reach: 50,
					edge: { classification: { classification: "unclassified", use: "track", surface: "gravel" } },
				};
				return { edges: i === 0 ? [paved] : [paved, gravel] };
			});

		let locateLocations: { lat: number; lon: number; radius?: number }[] = [];
		let firstRouteLocations: { lat: number; lon: number; type?: string }[] = [];
		const originalCall = fake.callValhalla.bind(fake);
		fake.callValhalla = (path: string, body: unknown) => {
			const typed = body as { locations: { lat: number; lon: number; radius?: number; type?: string }[] };
			if (path === "/locate" && locateLocations.length === 0) locateLocations = typed.locations;
			if (path === "/route" && firstRouteLocations.length === 0) firstRouteLocations = typed.locations;
			return originalCall(path, body);
		};

		const response = await service.generate({
			...REQUEST,
			preferences: { ...REQUEST.preferences, surfacePreference: "unpaved" },
		});
		expect(response.failure).toBeUndefined();

		// The start snaps nearest (no radius); vias search the nudge radius.
		expect(locateLocations[0].radius).toBeUndefined();
		for (const loc of locateLocations.slice(1)) expect(loc.radius).toBe(500);

		// Every routed via sits on the gravel edge: requested lat + 0.001.
		const vias = firstRouteLocations.filter((l) => l.type === "through");
		expect(vias.length).toBeGreaterThan(0);
		for (const via of vias) {
			const cameFromGravel = [...requestedViaLats].some((lat) => Math.abs(via.lat - (lat + 0.001)) < 1e-9);
			expect(cameFromGravel).toBe(true);
		}
	});

	it("routes a surface-anchored candidate from traced gravel runs, without a second locate", async () => {
		// Traces report a contiguous gravel run ~4.5km east of the start; the
		// anchored wave must route a candidate whose via sits on that run.
		const shapePoints: Coordinate[] = Array.from({ length: 25 }, (_, i) => destinationPoint(GHENT, 90, i * 0.5));
		fake.traceHandler = () => ({
			shape: encodePolyline6(shapePoints),
			edges: Array.from({ length: 24 }, (_, i) => ({
				way_id: 100 + i,
				surface: i >= 8 && i <= 11 ? "gravel" : "paved",
				length: 30 / 24,
				begin_heading: (i * 15) % 360,
				end_heading: (i * 15 + 10) % 360,
				begin_shape_index: i,
				end_shape_index: i + 1,
			})),
		});

		const routeVias: { lat: number; lon: number }[][] = [];
		const original = fake.routeHandler;
		fake.routeHandler = (body) => {
			routeVias.push(body.locations.filter((l) => l.type === "through"));
			return original(body);
		};

		const response = await service.generate({
			...REQUEST,
			preferences: { ...REQUEST.preferences, surfacePreference: "unpaved" },
		});
		expect(response.failure).toBeUndefined();

		// Anchored vias come from traced edges: already on the network, no snap pass.
		expect(fake.calls.filter((path) => path === "/locate")).toHaveLength(1);

		// The run is 5km (edges 8-11); its halfway edge midpoint is shape[9]
		// (tolerance covers the polyline6 encode/decode round-trip).
		const [lonMid, latMid] = shapePoints[9];
		const anchored = routeVias.find(
			(vias) => vias.length === 1 && Math.abs(vias[0].lat - latMid) < 1e-4 && Math.abs(vias[0].lon - lonMid) < 1e-4,
		);
		expect(anchored).toBeDefined();
	});

	it("runs a surface wave when a strict preference is poorly met", async () => {
		// All-paved tracing under an unpaved preference: surfaceFit 0 triggers
		// the wave, visible as a second /locate batch for the adjacent bearings.
		const response = await service.generate({
			...REQUEST,
			preferences: { ...REQUEST.preferences, surfacePreference: "unpaved" },
		});
		expect(response.failure).toBeUndefined();
		expect(fake.calls.filter((path) => path === "/locate")).toHaveLength(2);
	});

	it("skips the surface wave when the preference is already well met", async () => {
		fake.traceHandler = () => ({
			edges: Array.from({ length: 24 }, (_, i) => ({
				way_id: 100 + i,
				surface: "gravel",
				length: 30 / 24,
				begin_heading: (i * 15) % 360,
				end_heading: (i * 15 + 10) % 360,
			})),
		});
		const response = await service.generate({
			...REQUEST,
			preferences: { ...REQUEST.preferences, surfacePreference: "unpaved" },
		});
		expect(response.failure).toBeUndefined();
		expect(fake.calls.filter((path) => path === "/locate")).toHaveLength(1);
	});

	it("never runs a surface wave for the mixed preference", async () => {
		await service.generate(REQUEST);
		expect(fake.calls.filter((path) => path === "/locate")).toHaveLength(1);
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

	describe("isochrone fallback (generation v2)", () => {
		// Fan plans route start + 3 vias + start = 5 locations; isochrone plans
		// have 2 vias = 4 locations. Failing the 5-location requests simulates
		// hostile geometry where only the frontier tactic finds a way around.
		const failFanRoutes = () => {
			const original = fake.routeHandler;
			fake.routeHandler = (body) => (body.locations.length === 5 ? { error: "no path" } : original(body));
		};

		it("rescues a generation whose entire fan is unroutable", async () => {
			failFanRoutes();
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
			expect(response.candidates.length).toBeGreaterThan(0);
			expect(response.candidates[0].viaPoints).toHaveLength(2);
			expect(fake.calls.filter((path) => path === "/isochrone")).toHaveLength(1);
			expect(events[0]?.usedIsochroneFallback).toBe(true);
		});

		it("still fails honestly when even the frontier routes nothing", async () => {
			fake.routeHandler = () => ({ error: "no path" });
			const response = await service.generate(REQUEST);
			expect(response.failure?.code).toBe("no_candidates_routable");
			expect(fake.calls.filter((path) => path === "/isochrone")).toHaveLength(1);
		});

		it("never fires when the fan produced candidates", async () => {
			await service.generate(REQUEST);
			expect(fake.calls.filter((path) => path === "/isochrone")).toHaveLength(0);
			expect(events[0]?.usedIsochroneFallback).toBe(false);
		});
	});

	describe("anchors stage (generation v2, ADR-0037)", () => {
		// A Node within snap range of every fan via: one ring of Nodes at the
		// via radius around the start, denser than the fan's bearing spacing.
		const nodeRing = (): GenerationAnchor[] => {
			const radius = loopRadiusKm(REQUEST.targetDistanceKm);
			const ring: GenerationAnchor[] = [];
			for (let deg = 0; deg < 360; deg += 10) {
				ring.push({ coordinate: destinationPoint(GHENT, deg, 2 * radius), ref: String(deg / 10 + 1) });
				ring.push({ coordinate: destinationPoint(GHENT, deg, radius), ref: String(deg / 10 + 100) });
			}
			return ring;
		};

		const diverseTraces = (withNetwork: boolean) => {
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
						...(withNetwork ? { bicycle_network: i % 2 } : {}),
					})),
				};
			};
		};

		it("snaps vias onto Nodes and reports refs + NetworkFit for cycle", async () => {
			nodes.pool = nodeRing();
			diverseTraces(true);

			const response = await service.generate({ ...REQUEST, preferNodeNetworks: true });
			expect(response.failure).toBeUndefined();
			const best = response.candidates[0];
			expect(best.viaPoints.some((via) => via.ref !== undefined)).toBe(true);
			// Half the traced length is network-flagged.
			expect(best.networkFitPct).toBe(50);
		});

		it("measures walk NetworkFit by anchored vias, not edges", async () => {
			nodes.pool = nodeRing();
			diverseTraces(false);

			const response = await service.generate({ ...REQUEST, activity: "walk", preferNodeNetworks: true });
			expect(response.failure).toBeUndefined();
			const best = response.candidates[0];
			const anchored = best.viaPoints.filter((via) => via.ref !== undefined).length;
			expect(best.networkFitPct).toBe(Math.round((anchored / best.viaPoints.length) * 100));
		});

		it("degrades silently to v1 behaviour out of coverage", async () => {
			nodes.pool = [];
			diverseTraces(false);

			const response = await service.generate({ ...REQUEST, preferNodeNetworks: true });
			expect(response.failure).toBeUndefined();
			expect(response.candidates.length).toBe(3);
			expect(response.candidates[0].networkFitPct).toBeUndefined();
			expect(response.candidates[0].viaPoints.every((via) => via.ref === undefined)).toBe(true);
		});

		it("injects a must-pass anchor as a via in every candidate", async () => {
			diverseTraces(false);
			const landmark = destinationPoint(GHENT, 90, 3);

			const response = await service.generate({
				...REQUEST,
				anchors: [{ lat: landmark[1], lon: landmark[0], name: "Kasteel", required: true }],
			});
			expect(response.failure).toBeUndefined();
			for (const candidate of response.candidates) {
				expect(candidate.viaPoints).toHaveLength(4);
				expect(candidate.viaPoints.some((via) => via.name === "Kasteel")).toBe(true);
			}
		});

		it("rejects a must-pass anchor the loop cannot plausibly reach", async () => {
			const faraway = destinationPoint(GHENT, 90, 100);

			const response = await service.generate({
				...REQUEST,
				anchors: [{ lat: faraway[1], lon: faraway[0], required: true }],
			});
			expect(response.candidates).toEqual([]);
			expect(response.failure?.code).toBe("invalid_input");
			expect(fake.calls).toHaveLength(0);
		});

		it("ignores pool anchors out of snap range instead of distorting the loop", async () => {
			diverseTraces(false);
			const faraway = destinationPoint(GHENT, 0, 80);

			const response = await service.generate({
				...REQUEST,
				anchors: [{ lat: faraway[1], lon: faraway[0], ref: "999" }],
			});
			expect(response.failure).toBeUndefined();
			expect(response.candidates[0].viaPoints.every((via) => via.ref === undefined)).toBe(true);
		});
	});
});
