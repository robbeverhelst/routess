import type { Coordinate } from "@routess/core";
import { destinationPoint, emptyHistory, encodePolyline6, haversineDistance, type Waypoint } from "@routess/core";
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

// A dense ~25km circular RoutePath, like a foreign track's exact geometry.
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

// The route mock answers with a STRAIGHT leg between exactly the requested
// locations, so any full recompute would visibly replace the loop's curves.
function straightLegRouting(routeCalls: Coordinate[][][]) {
	fetchMock.mockImplementation(async (url: string, init?: { body?: string }) => {
		if (!String(url).includes("/routing/route")) {
			// checkNearRoad probe: report no road so the raw coord is used.
			return { ok: true, json: async () => ({ code: "Ok", tracepoints: [null, null] }) };
		}
		const body = JSON.parse(init?.body ?? "{}") as { locations?: { lat: number; lon: number }[] };
		const coords: Coordinate[] = (body.locations ?? []).map((l) => [l.lon, l.lat]);
		routeCalls.push([coords]);
		const legs = [];
		for (let i = 0; i < coords.length - 1; i++) {
			legs.push({
				shape: encodePolyline6([coords[i], coords[i + 1]]),
				summary: { length: haversineDistance(coords[i], coords[i + 1]), time: 600 },
			});
		}
		return { ok: true, json: async () => ({ legs, locations: [] }) };
	});
}

describe("RouteDraftEditor — edit-local recomputation", () => {
	const mapStub = { getSource: () => undefined } as unknown as MapboxMap;
	const path = loop();
	const routeCalls: Coordinate[][][] = [];

	beforeEach(() => {
		routeCalls.length = 0;
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
			creationSource: "imported",
			history: emptyHistory<Waypoint[]>(),
			canUndo: false,
			canRedo: false,
		});
		sampleAndComputeMock.mockResolvedValue({ gainMeters: 0, lossMeters: 0, profile: [] });
		(global.fetch as unknown as typeof fetchMock) = fetchMock;
		straightLegRouting(routeCalls);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("addWaypoint routes one new leg and keeps the existing path verbatim", async () => {
		const editor = createRouteDraftEditor({ map: mapStub, accessToken: "test-token" });
		const target = destinationPoint(GHENT, 90, 9);
		const result = await editor.addWaypoint(target);
		expect(result.success).toBe(true);

		// Exactly one small routing call, two locations.
		const locationCounts = routeCalls.map((c) => c[0].length);
		expect(locationCounts).toEqual([2]);

		// The original loop geometry survives as a strict prefix.
		const newPath = useRoutingStore.getState().routePath;
		expect(newPath.length).toBeGreaterThan(path.length);
		for (let i = 0; i < path.length; i += 37) {
			expect(newPath[i]).toEqual(path[i]);
		}
	});

	it("moveWaypoint reroutes only the adjacent span; head and tail stay identical", async () => {
		const editor = createRouteDraftEditor({ map: mapStub, accessToken: "test-token" });
		// After densify the moved index maps; move the SECOND original control.
		const result = await editor.moveWaypoint(1, destinationPoint(GHENT, 90, 5));
		expect(result.success).toBe(true);

		// One routing call covering a 3-waypoint span (the two adjacent legs).
		expect(routeCalls.length).toBe(1);
		expect(routeCalls[0][0].length).toBe(3);

		const newPath = useRoutingStore.getState().routePath;
		// Head of the loop intact.
		expect(newPath[0]).toEqual(path[0]);
		expect(newPath[5]).toEqual(path[5]);
		// Tail of the loop intact.
		expect(newPath[newPath.length - 1]).toEqual(path[path.length - 1]);
		expect(newPath[newPath.length - 6]).toEqual(path[path.length - 6]);
	});

	it("undo after addWaypoint restores the exact previous geometry without routing", async () => {
		const editor = createRouteDraftEditor({ map: mapStub, accessToken: "test-token" });
		await editor.addWaypoint(destinationPoint(GHENT, 90, 9));
		const callsAfterAdd = routeCalls.length;

		const result = await editor.undo();
		expect(result.success).toBe(true);
		// Restore trims the previous path; no new routing call.
		expect(routeCalls.length).toBe(callsAfterAdd);
		const restored = useRoutingStore.getState().routePath;
		expect(restored.length).toBe(path.length);
		expect(restored[0]).toEqual(path[0]);
		expect(restored[restored.length - 1]).toEqual(path[path.length - 1]);
	});

	it("addWaypoint appended within anchor tolerance of the path still routes its leg", async () => {
		// Closely-spaced clicks: the new point lands < 100m from the path's end
		// (the previous waypoint). This must never be mistaken for a densify
		// insertion — the appended leg needs routing.
		useRoutingStore.setState({ creationSource: "manual" });
		const editor = createRouteDraftEditor({ map: mapStub, accessToken: "test-token" });
		const target = destinationPoint(path[path.length - 1], 90, 0.05);
		const result = await editor.addWaypoint(target);
		expect(result.success).toBe(true);

		expect(routeCalls.length).toBe(1);
		const newPath = useRoutingStore.getState().routePath;
		// Polyline6 round-trips at 1e-6 precision; compare within a metre.
		expect(haversineDistance(newPath[newPath.length - 1], target)).toBeLessThan(0.001);
	});

	it("removeWaypoint reroutes the joined span only", async () => {
		const editor = createRouteDraftEditor({ map: mapStub, accessToken: "test-token" });
		const result = await editor.removeWaypoint(2);
		expect(result.success).toBe(true);
		expect(routeCalls.length).toBe(1);
		expect(routeCalls[0][0].length).toBe(2);
		const newPath = useRoutingStore.getState().routePath;
		expect(newPath[0]).toEqual(path[0]);
		expect(newPath[newPath.length - 1]).toEqual(path[path.length - 1]);
	});
});
