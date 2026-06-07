import { describe, expect, it } from "bun:test";
import { destinationPoint } from "../generation/fan";
import type { Coordinate, Waypoint } from "../types";
import { haversineDistance } from "./geospatial";
import { DENSIFY_MAX_TOTAL_WAYPOINTS, densifyWaypointsAlongPath } from "./routeGeneration";

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

	it("never exceeds the routing API location cap, even on huge loops", () => {
		// ~100km loop: naive 2km spacing would want ~50 waypoints.
		const path = loop(16);
		const sparse = generatedWaypoints(path);
		const { waypoints } = densifyWaypointsAlongPath(sparse, path);
		expect(waypoints.length).toBeLessThanOrEqual(DENSIFY_MAX_TOTAL_WAYPOINTS);
		expect(waypoints.length).toBeGreaterThan(sparse.length);
		// Originals survive thinning.
		for (const original of sparse) {
			expect(waypoints.some((wp) => wp.coord === original.coord)).toBe(true);
		}
		// Thinning stays roughly even: no neighbour gap above ~3x the mean.
		const gaps: number[] = [];
		for (let i = 1; i < waypoints.length; i++) {
			gaps.push(haversineDistance(waypoints[i - 1].coord, waypoints[i].coord));
		}
		const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
		expect(Math.max(...gaps)).toBeLessThan(mean * 3.5);
	});

	it("inserts nothing when the draft already has 25+ waypoints", () => {
		const path = loop();
		const step = Math.floor(path.length / 26);
		const many: Waypoint[] = Array.from({ length: 26 }, (_, i) => ({
			coord: path[Math.min(i * step, path.length - 1)],
			type: "routed" as const,
		}));
		expect(densifyWaypointsAlongPath(many, path).insertedCount).toBe(0);
	});
});
