import { describe, expect, it } from "bun:test";

import type { Coordinate } from "../types";
import { DEFAULT_SMART_WAYPOINT_THRESHOLDS, selectSmartWaypoints } from "./routeGeneration";

// ~111 m per 0.001 degree of latitude; longitude steps at the equator match.
const STEP = 0.001;

function line(from: Coordinate, dLon: number, dLat: number, count: number): Coordinate[] {
	return Array.from({ length: count }, (_, i) => [from[0] + dLon * (i + 1), from[1] + dLat * (i + 1)] as Coordinate);
}

describe("selectSmartWaypoints", () => {
	it("returns short tracks unchanged", () => {
		expect(selectSmartWaypoints([])).toEqual([]);
		expect(selectSmartWaypoints([[0, 0]])).toEqual([[0, 0]]);
	});

	it("keeps only the endpoints of a short straight track", () => {
		const track: Coordinate[] = [[0, 0], ...line([0, 0], STEP, 0, 10)];
		expect(selectSmartWaypoints(track)).toEqual([track[0], track[track.length - 1]]);
	});

	it("adds waypoints around a right-angle turn", () => {
		const east: Coordinate[] = [[0, 0], ...line([0, 0], STEP, 0, 20)];
		const corner = east[east.length - 1];
		const track = [...east, ...line(corner, 0, STEP, 20)];
		// Indices into the track: start, the windowed turn around the corner
		// (index 20), a distance marker and the end.
		expect(selectSmartWaypoints(track)).toEqual([0, 18, 19, 20, 21, 36, 40].map((i) => track[i]));
	});

	it("drops periodic markers every maxDistanceIntervalKm on a long straight", () => {
		const track: Coordinate[] = [[0, 0], ...line([0, 0], STEP, 0, 100)];
		const waypoints = selectSmartWaypoints(track);
		// ~11 km straight: start, markers roughly every 2 km, end.
		expect(waypoints.length).toBe(7);
		for (let i = 1; i < waypoints.length - 1; i++) {
			const km = (waypoints[i][0] - waypoints[i - 1][0]) * 111.32;
			expect(km).toBeGreaterThan(1.9);
			expect(km).toBeLessThan(2.2);
		}
	});

	it("never returns more than maxWaypoints and keeps both ends", () => {
		const zigzag: Coordinate[] = [];
		for (let i = 0; i < 400; i++) zigzag.push([i * STEP * 2, (i % 2) * STEP * 2]);
		const waypoints = selectSmartWaypoints(zigzag, { ...DEFAULT_SMART_WAYPOINT_THRESHOLDS, maxWaypoints: 6 });
		expect(waypoints.length).toBeLessThanOrEqual(6);
		expect(waypoints[0]).toEqual(zigzag[0]);
		expect(waypoints[waypoints.length - 1]).toEqual(zigzag[zigzag.length - 1]);
	});
});
