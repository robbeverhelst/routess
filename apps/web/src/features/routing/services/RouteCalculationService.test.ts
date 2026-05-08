import type { Coordinate } from "@routess/core";
import { emptyHistory, type Waypoint } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sampleAndComputeMock, getDirectionsMock } = vi.hoisted(() => ({
	sampleAndComputeMock: vi.fn(),
	getDirectionsMock: vi.fn(),
}));

vi.mock("./elevation", () => ({
	getDefaultElevationService: () => ({
		sampleAndCompute: sampleAndComputeMock,
	}),
}));

vi.mock("@/lib/utils/mapbox-api", () => ({
	getDirections: getDirectionsMock,
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
			history: emptyHistory<Waypoint[]>(),
			canUndo: false,
			canRedo: false,
		});
		sampleAndComputeMock.mockReset();
		getDirectionsMock.mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("delivers ElevationGain to the store even when Mapbox snapped the Waypoints", async () => {
		// User clicked two points slightly off the road network. Mapbox returns
		// a route, with snapped waypoint locations that differ from the input.
		const userClicks: Waypoint[] = [wp([0, 0]), wp([0.01, 0])];
		const snappedFromMapbox: Coordinate[] = [
			[0.0001, 0],
			[0.0099, 0],
		];
		const routeGeometry: Coordinate[] = [
			[0.0001, 0],
			[0.005, 0],
			[0.0099, 0],
		];

		useRoutingStore.getState().setWaypoints(userClicks);

		getDirectionsMock.mockResolvedValue({
			success: true,
			data: {
				routes: [{ geometry: { coordinates: routeGeometry }, distance: 1100, duration: 600 }],
				waypoints: snappedFromMapbox.map((c) => ({ location: c })),
				code: "Ok",
			},
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
		// RouteDraftEditor.recompute lines 96-98.
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
		// Inverse case: the staleness guard must still work when a real new
		// route calculation has overwritten routePath underneath us.
		const initialClicks: Waypoint[] = [wp([0, 0]), wp([0.01, 0])];
		useRoutingStore.getState().setWaypoints(initialClicks);

		getDirectionsMock.mockResolvedValue({
			success: true,
			data: {
				routes: [
					{
						geometry: {
							coordinates: [
								[0, 0],
								[0.005, 0],
								[0.01, 0],
							],
						},
						distance: 1100,
						duration: 600,
					},
				],
				waypoints: [{ location: [0, 0] }, { location: [0.01, 0] }],
				code: "Ok",
			},
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
});
