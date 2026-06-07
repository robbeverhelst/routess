import { describe, expect, it } from "bun:test";
import type { Coordinate } from "../types";
import { downsampleCoordinates, routeBoundingBox } from "./geospatial";

describe("routeBoundingBox", () => {
	it("returns null for an empty path", () => {
		expect(routeBoundingBox([])).toBeNull();
	});

	it("collapses a single point to a degenerate box", () => {
		expect(routeBoundingBox([[3.72, 51.05]])).toEqual({ minLat: 51.05, maxLat: 51.05, minLng: 3.72, maxLng: 3.72 });
	});

	it("computes min/max over a path", () => {
		const path: Coordinate[] = [
			[3.72, 51.05],
			[3.6, 51.1],
			[3.8, 50.9],
		];
		expect(routeBoundingBox(path)).toEqual({ minLat: 50.9, maxLat: 51.1, minLng: 3.6, maxLng: 3.8 });
	});

	it("skips invalid coordinates", () => {
		const path = [
			[3.72, 51.05],
			[Number.NaN, 51.2],
			[200, 51.3],
		] as Coordinate[];
		expect(routeBoundingBox(path)).toEqual({ minLat: 51.05, maxLat: 51.05, minLng: 3.72, maxLng: 3.72 });
	});

	it("returns null when no coordinate is valid", () => {
		expect(routeBoundingBox([[Number.NaN, Number.NaN]] as Coordinate[])).toBeNull();
	});
});

describe("downsampleCoordinates", () => {
	const path = (n: number): Coordinate[] => Array.from({ length: n }, (_, i) => [i, i] as Coordinate);

	it("returns the path unchanged when already small enough", () => {
		const p = path(5);
		expect(downsampleCoordinates(p, 10)).toBe(p);
	});

	it("keeps first and last points", () => {
		const result = downsampleCoordinates(path(100), 10);
		expect(result).toHaveLength(10);
		expect(result[0]).toEqual([0, 0]);
		expect(result[9]).toEqual([99, 99]);
	});

	it("samples monotonically", () => {
		const result = downsampleCoordinates(path(1000), 50);
		for (let i = 1; i < result.length; i++) {
			expect(result[i][0]).toBeGreaterThan(result[i - 1][0]);
		}
	});

	it("returns the path unchanged for maxPoints below 2", () => {
		const p = path(5);
		expect(downsampleCoordinates(p, 1)).toBe(p);
	});
});
