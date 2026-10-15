import { describe, expect, it } from "bun:test";

import type { Coordinate } from "../types";
import { pathJumpStats, stitchLooseSegments } from "./stitch";

describe("stitchLooseSegments", () => {
	it("returns an empty path when no piece has two points", () => {
		expect(stitchLooseSegments([])).toEqual([]);
		expect(stitchLooseSegments([[[0, 0]], []])).toEqual([]);
	});

	it("chains pieces that already run head to tail, dropping the shared joint", () => {
		const path = stitchLooseSegments([
			[
				[0, 0],
				[1, 0],
			],
			[
				[1, 0],
				[2, 0],
			],
		]);
		expect(path).toEqual([
			[0, 0],
			[1, 0],
			[2, 0],
		]);
	});

	it("reverses a piece whose far end is nearest to the current tail", () => {
		const path = stitchLooseSegments([
			[
				[0, 0],
				[1, 0],
			],
			[
				[2, 0],
				[1, 0],
			],
		]);
		expect(path).toEqual([
			[0, 0],
			[1, 0],
			[2, 0],
		]);
	});

	it("picks the nearest piece next, not the next one in input order", () => {
		const path = stitchLooseSegments([
			[
				[0, 0],
				[1, 0],
			],
			[
				[5, 0],
				[6, 0],
			],
			[
				[1, 0],
				[2, 0],
			],
		]);
		expect(path).toEqual([
			[0, 0],
			[1, 0],
			[2, 0],
			[5, 0],
			[6, 0],
		]);
	});

	it("keeps both endpoints across a gap between disconnected pieces", () => {
		const path = stitchLooseSegments([
			[
				[0, 0],
				[1, 0],
			],
			[
				[1.5, 0],
				[2, 0],
			],
		]);
		expect(path).toEqual([
			[0, 0],
			[1, 0],
			[1.5, 0],
			[2, 0],
		]);
	});

	it("does not mutate the input pieces", () => {
		const pieces: Coordinate[][] = [
			[
				[0, 0],
				[1, 0],
			],
			[
				[2, 0],
				[1, 0],
			],
		];
		const copy = structuredClone(pieces);
		stitchLooseSegments(pieces);
		expect(pieces).toEqual(copy);
	});
});

describe("pathJumpStats", () => {
	// ~111 m per 0.001 degree of latitude.
	const north = (meters: number): number => meters / 111_320;

	it("is all zeros for an empty or single-point path", () => {
		expect(pathJumpStats([])).toEqual({ lengthMeters: 0, jumpMeters: 0, maxJumpMeters: 0 });
		expect(pathJumpStats([[4, 51]])).toEqual({ lengthMeters: 0, jumpMeters: 0, maxJumpMeters: 0 });
	});

	it("sums the path length and counts no jumps below the threshold", () => {
		const stats = pathJumpStats([
			[4, 51],
			[4, 51 + north(100)],
			[4, 51 + north(200)],
		]);
		expect(stats.lengthMeters).toBeCloseTo(200, 3);
		expect(stats.jumpMeters).toBe(0);
		expect(stats.maxJumpMeters).toBe(0);
	});

	it("counts steps above the default 150 m threshold as jumps", () => {
		const stats = pathJumpStats([
			[4, 51],
			[4, 51 + north(100)],
			[4, 51 + north(400)],
			[4, 51 + north(1000)],
		]);
		expect(stats.lengthMeters).toBeCloseTo(1000, 3);
		expect(stats.jumpMeters).toBeCloseTo(900, 3);
		expect(stats.maxJumpMeters).toBeCloseTo(600, 3);
	});

	it("honours a custom threshold", () => {
		const path: Coordinate[] = [
			[4, 51],
			[4, 51 + north(100)],
		];
		expect(pathJumpStats(path, 50).jumpMeters).toBeCloseTo(100, 3);
		expect(pathJumpStats(path, 150).jumpMeters).toBe(0);
	});

	it("scales east-west distance by latitude", () => {
		const atEquator = pathJumpStats([
			[0, 0],
			[0.001, 0],
		]).lengthMeters;
		const atSixty = pathJumpStats([
			[0, 60],
			[0.001, 60],
		]).lengthMeters;
		expect(atSixty).toBeCloseTo(atEquator / 2, 3);
	});
});
