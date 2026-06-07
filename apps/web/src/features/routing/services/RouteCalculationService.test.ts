import type { Coordinate } from "@routess/core";
import { emptyHistory, type Waypoint } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sampleAndComputeMock, computeRouteMock } = vi.hoisted(() => ({
	sampleAndComputeMock: vi.fn(),
	computeRouteMock: vi.fn(),
}));

vi.mock("./elevation", () => ({
	getDefaultElevationService: () => ({
		sampleAndCompute: sampleAndComputeMock,
	}),
}));

vi.mock("./valhallaClient", () => ({
	computeRoute: computeRouteMock,
}));

import { useRoutingStore } from "@/stores/routingStore";
import { getRoute } from "./RouteCalculationService";

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const wp = (coord: Coordinate, type: "routed" | "direct" = "routed"): Waypoint => ({ coord, type });

const mapStub = {} as MapboxMap;

describe("RouteCalculationService.getRoute — elevation lifecycle", () => {
	beforeEach(() => {
		useRoutingStore.setState({
			waypoints: [],
			routePath: [],
			distanceMeters: null,
			durationSeconds: null,
			isOfflineRoute: false,
			hasRoute: false,
			elevationGain: undefined,
			elevationLoss: undefined,
			elevationProfile: undefined,
			isComputingElevation: false,
			isMapLocked: false,
			routingPreferences: null,
			history: emptyHistory<Waypoint[]>(),
			canUndo: false,
			canRedo: false,
		});
		sampleAndComputeMock.mockReset();
		computeRouteMock.mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("delivers ElevationGain to the store even when Valhalla snapped the Waypoints", async () => {
		// User clicked two points slightly off the road network. Valhalla returns
		// a route, with snapped waypoint locations that differ from the input.
		const userClicks: Waypoint[] = [wp([0, 0]), wp([0.01, 0])];
		const snappedFromValhalla: Waypoint[] = [wp([0.0001, 0]), wp([0.0099, 0])];
		const routePath: Coordinate[] = [
			[0.0001, 0],
			[0.005, 0],
			[0.0099, 0],
		];

		useRoutingStore.getState().setWaypoints(userClicks);

		computeRouteMock.mockResolvedValue({
			ok: true,
			routePath,
			distanceKm: 1.1,
			durationMinutes: 10,
			snappedWaypoints: snappedFromValhalla,
		});

		// Hold the elevation result so we can resolve it AFTER the editor
		// would have written snappedWaypoints back to the store. This is the
		// exact race the production code hits.
		let resolveSample!: (value: { gainMeters: number; lossMeters: number; profile: never[] }) => void;
		const samplePromise = new Promise((resolve) => {
			resolveSample = resolve;
		});
		sampleAndComputeMock.mockReturnValue(samplePromise);

		const result = await getRoute(mapStub, "test-token");
		expect(result.success).toBe(true);
		expect(result.waypointsSnapped).toBe(true);
		expect(result.snappedWaypoints).toBeDefined();

		// Editor commits the snapped Waypoints to the store, mirroring
		// RouteDraftEditor.recompute.
		if (!result.snappedWaypoints) throw new Error("expected snappedWaypoints from getRoute");
		useRoutingStore.getState().setWaypoints(result.snappedWaypoints);

		// Now the elevation sampling completes.
		resolveSample({ gainMeters: 42, lossMeters: 10, profile: [] });
		await flushMicrotasks();

		// The bug: routeInputsMatch compared pre-snap vs post-snap waypoints
		// and discarded the result. After the fix, the result must reach the
		// store regardless of waypoint snap-mutation.
		expect(useRoutingStore.getState().elevationGain).toBe(42);
		expect(useRoutingStore.getState().elevationLoss).toBe(10);
		expect(useRoutingStore.getState().isComputingElevation).toBe(false);
	});

	it("still discards elevation if the routePath itself changed mid-sample", async () => {
		const initialClicks: Waypoint[] = [wp([0, 0]), wp([0.01, 0])];
		useRoutingStore.getState().setWaypoints(initialClicks);

		computeRouteMock.mockResolvedValue({
			ok: true,
			routePath: [
				[0, 0],
				[0.005, 0],
				[0.01, 0],
			],
			distanceKm: 1.1,
			durationMinutes: 10,
		});

		let resolveSample!: (value: { gainMeters: number; lossMeters: number; profile: never[] }) => void;
		const samplePromise = new Promise((resolve) => {
			resolveSample = resolve;
		});
		sampleAndComputeMock.mockReturnValue(samplePromise);

		await getRoute(mapStub, "test-token");

		// A new, completely different routePath replaces the one elevation is
		// sampling. The result should be treated as stale.
		useRoutingStore.getState().setRoutePath([
			[10, 10],
			[11, 11],
		]);

		resolveSample({ gainMeters: 42, lossMeters: 10, profile: [] });
		await flushMicrotasks();

		expect(useRoutingStore.getState().elevationGain).toBeUndefined();
	});

	it("commits the prefs that produced a successful route onto the draft", async () => {
		useRoutingStore.getState().setWaypoints([wp([0, 0]), wp([0.01, 0])]);
		useRoutingStore.getState().setActivity("cycle");
		useRoutingStore.getState().setRoutingPreferences(null);

		computeRouteMock.mockResolvedValue({
			ok: true,
			routePath: [
				[0, 0],
				[0.01, 0],
			],
			distanceKm: 1.1,
			durationMinutes: 10,
		});
		sampleAndComputeMock.mockReturnValue(new Promise(() => {}));

		await getRoute(mapStub, "test-token");

		const after = useRoutingStore.getState();
		expect(after.routingPreferences).not.toBeNull();
		expect(after.routingPreferences?.surfacePreference).toBeDefined();
	});
});
