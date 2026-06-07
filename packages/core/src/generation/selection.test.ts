import { describe, expect, it } from "bun:test";
import type { SurfaceBucket } from "../routing/types";
import {
	CANDIDATE_SIMILARITY_LIMIT,
	candidateSimilarity,
	isLowQuality,
	isUsable,
	OVERLAP_UNUSABLE_LIMIT,
	OVERLAP_WARN_LIMIT,
	selectDiverseCandidates,
} from "./selection";
import type { ScoredCandidate } from "./types";

const noMeters: Record<SurfaceBucket, number> = { paved: 0, compacted: 0, unpaved: 0, path: 0 };

function candidate(total: number, overlap: number, wayIds: number[]): ScoredCandidate {
	return {
		plan: { bearingDeg: 0, viaPoints: [] },
		geometry: [],
		distanceKm: 40,
		durationSeconds: 5400,
		edges: wayIds.map((wayId) => ({ wayId, lengthKm: 1 })),
		score: { total, overlap, distanceMatch: 1, surfaceFit: 1, shapeCompactness: 1 },
		metersByBucket: noMeters,
		lowQuality: isLowQuality(overlap),
	};
}

describe("quality gates", () => {
	it("drops candidates above the unusable overlap limit", () => {
		expect(isUsable(candidate(0.9, OVERLAP_UNUSABLE_LIMIT + 0.01, [1]))).toBe(false);
		expect(isUsable(candidate(0.9, OVERLAP_UNUSABLE_LIMIT, [1]))).toBe(true);
	});

	it("flags mediocre overlap as low quality, not unusable", () => {
		const overlap = (OVERLAP_WARN_LIMIT + OVERLAP_UNUSABLE_LIMIT) / 2;
		expect(isLowQuality(overlap)).toBe(true);
		expect(isUsable(candidate(0.7, overlap, [1]))).toBe(true);
		expect(isLowQuality(OVERLAP_WARN_LIMIT)).toBe(false);
	});
});

describe("candidateSimilarity", () => {
	it("is 1 for identical way sets and 0 for disjoint ones", () => {
		const a = candidate(0.9, 0, [1, 2, 3]);
		expect(candidateSimilarity(a, candidate(0.8, 0, [1, 2, 3]))).toBe(1);
		expect(candidateSimilarity(a, candidate(0.8, 0, [4, 5, 6]))).toBe(0);
	});

	it("is fractional for partial overlap", () => {
		const a = candidate(0.9, 0, [1, 2, 3, 4]);
		const b = candidate(0.8, 0, [3, 4, 5, 6]);
		expect(candidateSimilarity(a, b)).toBeCloseTo(2 / 6, 5);
	});
});

describe("selectDiverseCandidates", () => {
	it("returns the best candidates ordered by score", () => {
		const selected = selectDiverseCandidates([
			candidate(0.5, 0, [1, 2]),
			candidate(0.9, 0, [3, 4]),
			candidate(0.7, 0, [5, 6]),
		]);
		expect(selected.map((c) => c.score.total)).toEqual([0.9, 0.7, 0.5]);
	});

	it("caps the selection at 3", () => {
		const selected = selectDiverseCandidates([
			candidate(0.9, 0, [1]),
			candidate(0.8, 0, [2]),
			candidate(0.7, 0, [3]),
			candidate(0.6, 0, [4]),
		]);
		expect(selected).toHaveLength(3);
	});

	it("dedupes near-identical shapes, keeping the better one", () => {
		const selected = selectDiverseCandidates([
			candidate(0.9, 0, [1, 2, 3, 4]),
			candidate(0.85, 0, [1, 2, 3, 4]), // same loop, slightly worse
			candidate(0.7, 0, [7, 8, 9]),
		]);
		expect(selected).toHaveLength(2);
		expect(selected[0].score.total).toBe(0.9);
	});

	it("keeps shapes just under the similarity limit", () => {
		// 2 shared of 6 union = 0.33 < limit.
		const a = candidate(0.9, 0, [1, 2, 3, 4]);
		const b = candidate(0.8, 0, [3, 4, 5, 6]);
		expect(candidateSimilarity(a, b)).toBeLessThan(CANDIDATE_SIMILARITY_LIMIT);
		expect(selectDiverseCandidates([a, b])).toHaveLength(2);
	});

	it("filters unusable candidates entirely", () => {
		const selected = selectDiverseCandidates([
			candidate(0.9, 0.8, [1, 2]), // out-and-back, high score by accident
			candidate(0.5, 0.05, [3, 4]),
		]);
		expect(selected).toHaveLength(1);
		expect(selected[0].score.overlap).toBe(0.05);
	});

	it("returns empty for no usable candidates", () => {
		expect(selectDiverseCandidates([candidate(0.9, 0.9, [1])])).toEqual([]);
	});
});
