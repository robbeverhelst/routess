import type { Coordinate } from "@routess/core";
import { destinationPoint, emptyHistory, encodePolyline6, type Waypoint } from "@routess/core";
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

const GHENT: Coordinate = [3.7174, 51.0543];

// A dense ~25km circular RoutePath, like a generated loop's geometry.
function loop(): Coordinate[] {
	const points: Coordinate[] = [];
	for (let deg = 0; deg <= 360; deg += 0.5) {
		points.push(destinationPoint(GHENT, deg, 4));
	}
	return points;
}

function sparseWaypoints(path: Coordinate[]): Waypoint[] {
	const quarter = Math.floor(path.length / 4);
	return [
		{ coord: path[0], type: "routed" },
		{ coord: path[quarter], type: "routed" },
		{ coord: path[quarter * 2], type: "routed" },
		{ coord: path[quarter * 3], type: "routed" },
		{ coord: path[path.length - 1], type: "routed" },
	];
}

describe("RouteDraftEditor — lazy densify of generated drafts", () => {
	const mapStub = { getSource: () => undefined } as unknown as MapboxMap;
	const path = loop();

	beforeEach(() => {
		useRoutingStore.setState({
			waypoints: sparseWaypoints(path),
			routePath: path,
			distanceMeters: 25000,
			durationSeconds: 5400,
			isOfflineRoute: false,
			hasRoute: true,
			isComputingElevation: false,
			isMapLocked: false,
			mode: { kind: "unsaved" },
			creationSource: "generated",
			history: emptyHistory<Waypoint[]>(),
			canUndo: false,
			canRedo: false,
		});
		sampleAndComputeMock.mockResolvedValue({ gainMeters: 0, lossMeters: 0, profile: [] });
		(global.fetch as unknown as typeof fetchMock) = fetchMock;
		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes("/routing/route")) {
				return {
					ok: true,
					json: async () => ({
						legs: [{ shape: encodePolyline6(path), summary: { length: 25, time: 5400 } }],
						locations: [],
					}),
				};
			}
			// checkNearRoad fallback: no road found, raw coord used.
			return { ok: true, json: async () => ({ code: "Ok", tracepoints: [null, null] }) };
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("densifies before a move and applies the move to the right waypoint", async () => {
		const editor = createRouteDraftEditor({ map: mapStub, accessToken: "test-token" });
		const originalCount = useRoutingStore.getState().waypoints.length;
		const movedOriginal = useRoutingStore.getState().waypoints[2];
		const target: Coordinate = [movedOriginal.coord[0] + 0.002, movedOriginal.coord[1]];

		const result = await editor.moveWaypoint(2, target);
		expect(result.success).toBe(true);

		const after = useRoutingStore.getState().waypoints;
		// Smart waypoints were inserted along the generated geometry.
		expect(after.length).toBeGreaterThan(originalCount + 4);
		// The waypoint the user grabbed (original index 2) is the one that moved.
		expect(after.some((wp) => wp.coord[0] === target[0] && wp.coord[1] === target[1])).toBe(true);
		expect(after.some((wp) => wp.coord === movedOriginal.coord)).toBe(false);
	});

	it("densifies imported drafts (GPX and external routes) the same way", async () => {
		useRoutingStore.setState({ creationSource: "imported" });
		const editor = createRouteDraftEditor({ map: mapStub, accessToken: "test-token" });
		const originalCount = useRoutingStore.getState().waypoints.length;
		await editor.moveWaypoint(1, [4.6, 51.0]);
		expect(useRoutingStore.getState().waypoints.length).toBeGreaterThan(originalCount);
	});

	it("does not densify manual drafts", async () => {
		useRoutingStore.setState({ creationSource: "manual" });
		const editor = createRouteDraftEditor({ map: mapStub, accessToken: "test-token" });

		await editor.moveWaypoint(2, [GHENT[0] + 0.002, GHENT[1]]);
		// 5 originals, nothing inserted.
		expect(useRoutingStore.getState().waypoints.length).toBe(5);
	});

	it("densifies exactly once (idempotent across consecutive edits)", async () => {
		const editor = createRouteDraftEditor({ map: mapStub, accessToken: "test-token" });
		await editor.moveWaypoint(1, [GHENT[0] + 0.001, GHENT[1] + 0.03]);
		const afterFirst = useRoutingStore.getState().waypoints.length;

		await editor.moveWaypoint(3, [GHENT[0] - 0.001, GHENT[1] - 0.03]);
		const afterSecond = useRoutingStore.getState().waypoints.length;
		expect(afterSecond).toBe(afterFirst);
	});

	it("undo after the first edit restores the densified shape, not the sparse one", async () => {
		const editor = createRouteDraftEditor({ map: mapStub, accessToken: "test-token" });
		await editor.moveWaypoint(2, [GHENT[0] + 0.002, GHENT[1]]);
		const densifiedCount = useRoutingStore.getState().waypoints.length;

		await editor.undo();
		// Undo reverts the move but keeps the densified control points, so the
		// recalculated shape stays faithful to the generated geometry.
		expect(useRoutingStore.getState().waypoints.length).toBe(densifiedCount);
	});
});
