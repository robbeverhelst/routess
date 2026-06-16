import { describe, expect, it } from "bun:test";
import type { Coordinate } from "../types";
import { buildPathIndex, pointAtDistanceAlong, projectOntoPath } from "./path";

// Straight west→east path at lat 51 (Belgium-ish). One degree of longitude at
// lat 51 is ~70 km, so 0.001° ≈ 70 m.
const LAT = 51;
const DEG_LNG_METERS = 111195 * Math.cos((LAT * Math.PI) / 180);

function straightPath(points: number, stepDegrees = 0.001): Coordinate[] {
	return Array.from({ length: points }, (_, i) => [4 + i * stepDegrees, LAT] as Coordinate);
}

describe("buildPathIndex", () => {
	it("accumulates distances monotonically", () => {
		const index = buildPathIndex(straightPath(5));
		expect(index.cumulativeMeters[0]).toBe(0);
		for (let i = 1; i < index.cumulativeMeters.length; i++) {
			expect(index.cumulativeMeters[i]).toBeGreaterThan(index.cumulativeMeters[i - 1]);
		}
		expect(index.totalMeters).toBeCloseTo(4 * 0.001 * DEG_LNG_METERS, -1);
	});
});

describe("pointAtDistanceAlong", () => {
	it("clamps to the ends", () => {
		const index = buildPathIndex(straightPath(3));
		expect(pointAtDistanceAlong(index, -10)).toEqual(index.path[0]);
		expect(pointAtDistanceAlong(index, index.totalMeters + 10)).toEqual(index.path[2]);
	});

	it("interpolates inside a segment", () => {
		const index = buildPathIndex(straightPath(2));
		const mid = pointAtDistanceAlong(index, index.totalMeters / 2);
		expect(mid[0]).toBeCloseTo(4.0005, 5);
		expect(mid[1]).toBeCloseTo(LAT, 6);
	});
});

describe("projectOntoPath", () => {
	it("projects a nearby point onto the correct segment", () => {
		const index = buildPathIndex(straightPath(10));
		// Just north of the path, between points 3 and 4.
		const projection = projectOntoPath(index, [4.0035, LAT + 0.0002]);
		expect(projection.segmentIndex).toBe(3);
		expect(projection.distanceFromPathMeters).toBeCloseTo(0.0002 * 111195, 0);
		expect(projection.distanceAlongMeters).toBeCloseTo(3.5 * 0.001 * DEG_LNG_METERS, -1);
	});

	it("prefers the windowed match near the hint on a self-crossing path", () => {
		// An out-and-back: the same coordinates appear twice. With a hint deep
		// into the return leg, the projection must land on the return leg.
		const out = straightPath(300);
		const back = [...out].reverse();
		const index = buildPathIndex([...out, ...back.slice(1)]);
		const query: Coordinate = [4.05, LAT + 0.0001];
		const early = projectOntoPath(index, query, 10);
		const late = projectOntoPath(index, query, index.path.length - 60);
		expect(early.distanceAlongMeters).toBeLessThan(index.totalMeters / 2);
		expect(late.distanceAlongMeters).toBeGreaterThan(index.totalMeters / 2);
	});

	it("falls back to a full scan when the windowed match is poor", () => {
		const index = buildPathIndex(straightPath(1000));
		// Hint at the start, query near the far end: a 200-segment window around
		// the hint misses by kilometers, so the full scan must kick in.
		const projection = projectOntoPath(index, [4 + 0.9, LAT], 0);
		expect(projection.distanceFromPathMeters).toBeLessThan(5);
		expect(projection.segmentIndex).toBeGreaterThan(800);
	});
});
