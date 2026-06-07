import { describe, expect, it } from "bun:test";
import { destinationPoint } from "../generation/fan";
import type { Coordinate, Waypoint } from "../types";
import { haversineDistance } from "./geospatial";
import { densifyWaypointsAlongPath } from "./routeGeneration";

const GHENT: Coordinate = [3.7174, 51.0543];

// A ~25km circular loop sampled every ~70m, like a generated RoutePath.
function loop(radiusKm = 4): Coordinate[] {
	const points: Coordinate[] = [];
	for (let deg = 0; deg <= 360; deg += 0.5) {
		points.push(destinationPoint(GHENT, deg, radiusKm));
	}
	return points;
}

function generatedWaypoints(path: Coordinate[]): Waypoint[] {
	const quarter = Math.floor(path.length / 4);
	return [
		{ coord: path[0], type: "routed" },
		{ coord: path[quarter], type: "routed" },
		{ coord: path[quarter * 2], type: "routed" },
		{ coord: path[quarter * 3], type: "routed" },
		{ coord: path[path.length - 1], type: "routed" },
	];
}

describe("densifyWaypointsAlongPath", () => {
	it("inserts waypoints along the path between sparse originals", () => {
		const path = loop();
		const sparse = generatedWaypoints(path);
		const { waypoints, insertedCount } = densifyWaypointsAlongPath(sparse, path);

		expect(insertedCount).toBeGreaterThan(4);
		expect(waypoints.length).toBe(sparse.length + insertedCount);
		// Every inserted waypoint lies on the path.
		for (const wp of waypoints) {
			const minKm = Math.min(...path.map((p) => haversineDistance(wp.coord, p)));
			expect(minKm).toBeLessThan(0.01);
		}
		// No segment between consecutive waypoints exceeds ~3km crow-flies.
		for (let i = 1; i < waypoints.length; i++) {
			expect(haversineDistance(waypoints[i - 1].coord, waypoints[i].coord)).toBeLessThan(3);
		}
	});

	it("preserves originals (position, name, type) and maps their indices", () => {
		const path = loop();
		const sparse = generatedWaypoints(path);
		sparse[1] = { ...sparse[1], name: "Bakery" };
		const { waypoints, indexMap } = densifyWaypointsAlongPath(sparse, path);

		expect(indexMap).toHaveLength(sparse.length);
		for (let i = 0; i < sparse.length; i++) {
			expect(waypoints[indexMap[i]]).toEqual(sparse[i]);
		}
		expect(waypoints[indexMap[1]].name).toBe("Bakery");
		// Order strictly increasing.
		for (let i = 1; i < indexMap.length; i++) {
			expect(indexMap[i]).toBeGreaterThan(indexMap[i - 1]);
		}
	});

	it("anchors a loop's closing waypoint at the path end, not the start", () => {
		const path = loop();
		const sparse = generatedWaypoints(path);
		const { waypoints, indexMap } = densifyWaypointsAlongPath(sparse, path);
		// Closing waypoint stays last; points were inserted before it.
		expect(indexMap[sparse.length - 1]).toBe(waypoints.length - 1);
		expect(indexMap[sparse.length - 1]).toBeGreaterThan(sparse.length - 1);
	});

	it("is idempotent once segments are short", () => {
		const path = loop();
		const first = densifyWaypointsAlongPath(generatedWaypoints(path), path);
		const second = densifyWaypointsAlongPath(first.waypoints, path);
		expect(second.insertedCount).toBe(0);
		expect(second.waypoints).toEqual(first.waypoints);
	});

	it("skips segments that arrive at a direct waypoint", () => {
		const path = loop();
		const sparse = generatedWaypoints(path);
		sparse[2] = { ...sparse[2], type: "direct" };
		const { waypoints } = densifyWaypointsAlongPath(sparse, path);
		// The segment between original 1 and the direct original 2 stays bare.
		const idx1 = waypoints.findIndex((wp) => wp.coord === sparse[1].coord);
		const idx2 = waypoints.findIndex((wp) => wp.coord === sparse[2].coord);
		expect(idx2).toBe(idx1 + 1);
	});

	it("returns identity for degenerate input", () => {
		const wp: Waypoint = { coord: GHENT, type: "routed" };
		expect(densifyWaypointsAlongPath([wp], loop()).insertedCount).toBe(0);
		expect(densifyWaypointsAlongPath([wp, wp], []).insertedCount).toBe(0);
	});
});
