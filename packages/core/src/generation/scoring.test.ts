import { describe, expect, it } from "bun:test";
import type { SurfaceBucket } from "../routing/types";
import type { Coordinate } from "../types";
import { destinationPoint } from "./fan";
import {
	distanceMatchScore,
	GENERATION_SCORE_WEIGHTS,
	generationScoreWeights,
	overlapFraction,
	STRICT_SURFACE_SCORE_WEIGHTS,
	scoreCandidate,
	shapeCompactness,
	surfaceFitScore,
} from "./scoring";
import type { CandidateEdge, RoutedCandidate } from "./types";

const GHENT: Coordinate = [3.7174, 51.0543];

const meters = (partial: Partial<Record<SurfaceBucket, number>>): Record<SurfaceBucket, number> => ({
	paved: 0,
	compacted: 0,
	unpaved: 0,
	path: 0,
	...partial,
});

describe("distanceMatchScore", () => {
	it("scores 1 inside the ±10% free band", () => {
		expect(distanceMatchScore(40, 40)).toBe(1);
		expect(distanceMatchScore(43.9, 40)).toBe(1);
		expect(distanceMatchScore(36.1, 40)).toBe(1);
	});

	it("decays smoothly outside the band", () => {
		const at20 = distanceMatchScore(48, 40);
		const at50 = distanceMatchScore(60, 40);
		expect(at20).toBeLessThan(1);
		expect(at50).toBeLessThan(at20);
		expect(at50).toBeLessThan(0.1);
	});

	it("handles degenerate inputs", () => {
		expect(distanceMatchScore(0, 40)).toBe(0);
		expect(distanceMatchScore(40, 0)).toBe(0);
	});
});

describe("overlapFraction", () => {
	it("scores 1 for a pure out-and-back (same ways both directions)", () => {
		const out: CandidateEdge[] = [
			{ wayId: 1, lengthKm: 2, beginHeadingDeg: 90, endHeadingDeg: 90 },
			{ wayId: 2, lengthKm: 3, beginHeadingDeg: 90, endHeadingDeg: 90 },
		];
		const back: CandidateEdge[] = [
			{ wayId: 2, lengthKm: 3, beginHeadingDeg: 270, endHeadingDeg: 270 },
			{ wayId: 1, lengthKm: 2, beginHeadingDeg: 270, endHeadingDeg: 270 },
		];
		expect(overlapFraction([...out, ...back])).toBe(1);
	});

	it("scores 1 for an out-and-back along a single long way (rail trail)", () => {
		const edges: CandidateEdge[] = [
			{ wayId: 7, lengthKm: 5, beginHeadingDeg: 88, endHeadingDeg: 92 },
			{ wayId: 7, lengthKm: 5, beginHeadingDeg: 92, endHeadingDeg: 90 },
			// U-turn at the apex: direction reverses on the same way.
			{ wayId: 7, lengthKm: 5, beginHeadingDeg: 270, endHeadingDeg: 268 },
			{ wayId: 7, lengthKm: 5, beginHeadingDeg: 268, endHeadingDeg: 272 },
		];
		expect(overlapFraction(edges)).toBe(1);
	});

	it("scores 0 for a clean loop (every way once)", () => {
		const edges: CandidateEdge[] = [
			{ wayId: 1, lengthKm: 2 },
			{ wayId: 2, lengthKm: 3 },
			{ wayId: 3, lengthKm: 2.5 },
		];
		expect(overlapFraction(edges)).toBe(0);
	});

	it("does not count one long pass over many edges of the same way as overlap", () => {
		const edges: CandidateEdge[] = [
			{ wayId: 1, lengthKm: 1 },
			{ wayId: 1, lengthKm: 1 },
			{ wayId: 1, lengthKm: 1 },
			{ wayId: 2, lengthKm: 3 },
		];
		expect(overlapFraction(edges)).toBe(0);
	});

	it("counts a spur into a dead-end and back", () => {
		const edges: CandidateEdge[] = [
			{ wayId: 1, lengthKm: 4 },
			// the spur: in and out over the same way
			{ wayId: 9, lengthKm: 1 },
			{ wayId: 9, lengthKm: 1 },
			{ wayId: 2, lengthKm: 4 },
		];
		// Two consecutive same-way edges read as one traversal; a real spur is
		// interrupted by the turnaround, so model it with a different way between.
		const spur: CandidateEdge[] = [
			{ wayId: 1, lengthKm: 4 },
			{ wayId: 9, lengthKm: 1 },
			{ wayId: 8, lengthKm: 0.1 },
			{ wayId: 9, lengthKm: 1 },
			{ wayId: 2, lengthKm: 4 },
		];
		expect(overlapFraction(spur)).toBeCloseTo(2 / 10.1, 5);
		// The uninterrupted version reads as one pass (acceptable approximation).
		expect(overlapFraction(edges)).toBe(0);
	});

	it("ignores edges without a wayId", () => {
		const edges: CandidateEdge[] = [{ lengthKm: 2 }, { wayId: 1, lengthKm: 3 }];
		expect(overlapFraction(edges)).toBe(0);
	});

	it("returns 0 for empty input", () => {
		expect(overlapFraction([])).toBe(0);
	});
});

describe("shapeCompactness", () => {
	it("scores near 1 for a circular loop", () => {
		const circle: Coordinate[] = [];
		for (let deg = 0; deg < 360; deg += 10) {
			circle.push(destinationPoint(GHENT, deg, 5));
		}
		expect(shapeCompactness(circle)).toBeGreaterThan(0.9);
	});

	it("scores near 0 for an out-and-back line", () => {
		const line: Coordinate[] = [];
		for (let km = 0; km <= 10; km++) line.push(destinationPoint(GHENT, 90, km));
		for (let km = 9; km >= 0; km--) line.push(destinationPoint(GHENT, 90, km));
		expect(shapeCompactness(line)).toBeLessThan(0.05);
	});

	it("returns 0 for degenerate geometry", () => {
		expect(shapeCompactness([])).toBe(0);
		expect(shapeCompactness([GHENT, GHENT])).toBe(0);
	});
});

describe("surfaceFitScore", () => {
	it("is 1 when everything matches the preference", () => {
		expect(surfaceFitScore(meters({ paved: 1000 }), "paved")).toBe(1);
	});

	it("is permissive for mixed", () => {
		expect(surfaceFitScore(meters({ paved: 500, path: 500 }), "mixed")).toBe(1);
	});

	it("penalises violating distance proportionally", () => {
		expect(surfaceFitScore(meters({ paved: 750, unpaved: 250 }), "paved")).toBeCloseTo(0.75, 5);
	});
});

describe("scoreCandidate", () => {
	const loopGeometry: Coordinate[] = [];
	for (let deg = 0; deg < 360; deg += 10) {
		loopGeometry.push(destinationPoint(GHENT, deg, 5));
	}

	const candidate: RoutedCandidate = {
		plan: { bearingDeg: 0, viaPoints: [] },
		geometry: loopGeometry,
		distanceKm: 40,
		durationSeconds: 5400,
		edges: [
			{ wayId: 1, lengthKm: 20, surface: "paved" },
			{ wayId: 2, lengthKm: 20, surface: "paved" },
		],
	};

	it("weights components per the preference-aware weights", () => {
		const score = scoreCandidate(candidate, 40, "paved", meters({ paved: 40000 }));
		expect(score.overlap).toBe(0);
		expect(score.distanceMatch).toBe(1);
		expect(score.surfaceFit).toBe(1);
		const w = generationScoreWeights("paved");
		const expected = w.overlap + w.distanceMatch + w.surfaceFit + w.shapeCompactness * score.shapeCompactness;
		expect(score.total).toBeCloseTo(expected, 10);
	});

	it("uses the default weights for mixed and the strict weights for paved/unpaved", () => {
		expect(generationScoreWeights("mixed")).toBe(GENERATION_SCORE_WEIGHTS);
		expect(generationScoreWeights("paved")).toBe(STRICT_SURFACE_SCORE_WEIGHTS);
		expect(generationScoreWeights("unpaved")).toBe(STRICT_SURFACE_SCORE_WEIGHTS);
	});

	it("both weight sets sum to 1", () => {
		for (const w of [GENERATION_SCORE_WEIGHTS, STRICT_SURFACE_SCORE_WEIGHTS]) {
			expect(w.overlap + w.distanceMatch + w.surfaceFit + w.shapeCompactness).toBeCloseTo(1, 10);
		}
	});

	it("ranks the gravellier loop first under an unpaved preference despite a worse shape", () => {
		// Same loop, but the gravelly version misses the distance band slightly;
		// the strict surfaceFit weight must still put it on top.
		const gravelly = scoreCandidate(
			{ ...candidate, distanceKm: 45 },
			40,
			"unpaved",
			meters({ unpaved: 36000, paved: 9000 }),
		);
		const mostlyPaved = scoreCandidate(candidate, 40, "unpaved", meters({ unpaved: 16000, paved: 24000 }));
		expect(gravelly.total).toBeGreaterThan(mostlyPaved.total);
	});

	it("ranks an out-and-back below a clean loop", () => {
		const outAndBack: RoutedCandidate = {
			...candidate,
			edges: [
				{ wayId: 1, lengthKm: 20 },
				{ wayId: 2, lengthKm: 0.1 },
				{ wayId: 1, lengthKm: 20 },
			],
		};
		const good = scoreCandidate(candidate, 40, "mixed", meters({ paved: 40000 }));
		const bad = scoreCandidate(outAndBack, 40, "mixed", meters({ paved: 40000 }));
		expect(bad.total).toBeLessThan(good.total);
		expect(bad.overlap).toBeGreaterThan(0.95);
	});
});
