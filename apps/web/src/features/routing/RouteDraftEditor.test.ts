import type { Coordinate } from "@routess/core";
import { emptyHistory, type Waypoint } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sampleAndComputeMock, getDirectionsMock, fetchMock } = vi.hoisted(() => ({
	sampleAndComputeMock: vi.fn(async () => ({ gainMeters: 0, lossMeters: 0, profile: [] })),
	getDirectionsMock: vi.fn(),
	fetchMock: vi.fn(),
}));

vi.mock("./services/elevation", () => ({
	getDefaultElevationService: () => ({
		sampleAndCompute: sampleAndComputeMock,
	}),
}));

vi.mock("@/lib/utils/mapbox-api", () => ({
	getDirections: getDirectionsMock,
}));

import { useRoutingStore } from "@/stores/routingStore";
import { createRouteDraftEditor } from "./RouteDraftEditor";

const wp = (coord: Coordinate, type: "routed" | "direct" = "routed"): Waypoint => ({ coord, type });

const stubDirectionsOk = (route: Coordinate[]) => {
	getDirectionsMock.mockResolvedValue({
		success: true,
		data: {
			routes: [{ geometry: { coordinates: route }, distance: 1000, duration: 600 }],
			waypoints: [route[0], route[route.length - 1]].map((c) => ({ location: c })),
			code: "Ok",
		},
	});
};

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("RouteDraftEditor — undo behavior", () => {
	const accessToken = "test-token";
	const mapStub = {
		getSource: () => undefined,
	} as unknown as MapboxMap;

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
		getDirectionsMock.mockReset();
		sampleAndComputeMock.mockReset();
		sampleAndComputeMock.mockResolvedValue({ gainMeters: 0, lossMeters: 0, profile: [] });
		fetchMock.mockReset();
		// checkNearRoad path uses fetch directly. Default to "no road found"
		// so resolveAddCoord falls through to the raw coord.
		(global.fetch as unknown as typeof fetchMock) = fetchMock;
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({ code: "Ok", tracepoints: [null, null] }),
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("undoes a removeWaypoint with a single undo press", async () => {
		// Seed two Waypoints and a route directly so we don't have to drive
		// the editor through addWaypoint just to set up state.
		useRoutingStore.getState().setWaypoints([wp([0, 0], "direct"), wp([0.01, 0], "direct")]);
		useRoutingStore.getState().saveSnapshot();

		stubDirectionsOk([
			[0, 0],
			[0.01, 0],
		]);

		const editor = createRouteDraftEditor({ map: mapStub, accessToken });

		await editor.removeWaypoint(0);
		expect(useRoutingStore.getState().waypoints.length).toBe(1);

		await editor.undo();
		await flushMicrotasks();

		// Bug today: requires 2 undo presses because saveSnapshot is called
		// AFTER the mutation, so the first undo pops a snapshot identical to
		// current state and visibly nothing happens.
		expect(useRoutingStore.getState().waypoints.length).toBe(2);
	});

	it("undoes a moveWaypoint with a single undo press", async () => {
		useRoutingStore.getState().setWaypoints([wp([0, 0], "direct"), wp([0.01, 0], "direct")]);
		useRoutingStore.getState().saveSnapshot();

		stubDirectionsOk([
			[0, 0],
			[0.01, 0],
		]);

		const editor = createRouteDraftEditor({ map: mapStub, accessToken });

		await editor.moveWaypoint(1, [0.02, 0]);
		expect(useRoutingStore.getState().waypoints[1].coord).toEqual([0.02, 0]);

		await editor.undo();
		await flushMicrotasks();

		expect(useRoutingStore.getState().waypoints[1].coord).toEqual([0.01, 0]);
	});

	it("samples elevation when loading waypoints with stored geometry", async () => {
		// Stored geometry skips the Valhalla recompute that normally kicks off
		// elevation sampling; the exact path must be sampled directly.
		const editor = createRouteDraftEditor({ map: mapStub, accessToken });
		const exactRoutePath: Coordinate[] = [
			[0, 0],
			[0.005, 0],
			[0.01, 0],
		];

		await editor.loadWaypoints([wp([0, 0], "direct"), wp([0.01, 0], "direct")], { exactRoutePath });
		await flushMicrotasks();

		expect(getDirectionsMock).not.toHaveBeenCalled();
		expect(sampleAndComputeMock).toHaveBeenCalledWith(exactRoutePath, expect.anything());
	});

	it("undoes a reverse with a single undo press", async () => {
		const original: Waypoint[] = [wp([0, 0], "direct"), wp([0.01, 0], "direct"), wp([0.02, 0], "direct")];
		useRoutingStore.getState().setWaypoints(original);
		useRoutingStore.getState().saveSnapshot();

		stubDirectionsOk([
			[0, 0],
			[0.02, 0],
		]);

		const editor = createRouteDraftEditor({ map: mapStub, accessToken });

		await editor.reverse();
		expect(useRoutingStore.getState().waypoints[0].coord).toEqual([0.02, 0]);

		await editor.undo();
		await flushMicrotasks();

		expect(useRoutingStore.getState().waypoints[0].coord).toEqual([0, 0]);
	});
});
