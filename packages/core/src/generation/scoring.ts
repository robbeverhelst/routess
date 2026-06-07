import { surfaceMismatchFraction } from "../routing/surface";
import type { SurfaceBucket, SurfaceType } from "../routing/types";
import type { Coordinate } from "../types";
import type { CandidateEdge, CandidateScore, RoutedCandidate } from "./types";

// Scoring (ADR-0029): every past failure mode becomes a measured penalty.
// Overlap carries the heaviest weight because out-and-back was the killer.
// Elevation is deliberately NOT scored — v1 has no hilliness input, so an
// elevation term would bake in a flatness bias the user never asked for.
export const GENERATION_SCORE_WEIGHTS = {
	overlap: 0.4,
	distanceMatch: 0.25,
	surfaceFit: 0.2,
	shapeCompactness: 0.15,
} as const;

/** Distance within ±10% of target scores 1; beyond, a gaussian falloff. */
const DISTANCE_FREE_BAND = 0.1;
const DISTANCE_FALLOFF_SIGMA = 0.25;

export function distanceMatchScore(actualKm: number, targetKm: number): number {
	if (targetKm <= 0 || actualKm <= 0) return 0;
	const missRatio = Math.abs(actualKm - targetKm) / targetKm;
	if (missRatio <= DISTANCE_FREE_BAND) return 1;
	const over = (missRatio - DISTANCE_FREE_BAND) / DISTANCE_FALLOFF_SIGMA;
	return Math.exp(-(over * over));
}

/** Direction change at an edge joint above this reads as a U-turn. */
const U_TURN_HEADING_DELTA = 120;

const headingDelta = (a: number, b: number): number => {
	const diff = Math.abs(a - b) % 360;
	return diff > 180 ? 360 - diff : diff;
};

/**
 * Overlap: the fraction of distance traversing the same OSM way more than
 * once. Consecutive edges on the same way collapse into one traversal first
 * (a single pass along a long road is many edges, not many traversals) —
 * unless travel direction reverses at the joint, which is a U-turn back onto
 * the same way (the rail-trail out-and-back case). Ways with two or more
 * traversals count all their traversed length as overlap. A pure out-and-back
 * scores ~1, a clean loop ~0.
 */
export function overlapFraction(edges: CandidateEdge[]): number {
	let totalKm = 0;
	const traversals = new Map<number, { count: number; lengthKm: number }>();
	let previous: CandidateEdge | undefined;

	for (const edge of edges) {
		totalKm += edge.lengthKm;
		if (typeof edge.wayId !== "number") {
			previous = undefined;
			continue;
		}
		const reversed =
			previous?.endHeadingDeg !== undefined &&
			edge.beginHeadingDeg !== undefined &&
			headingDelta(previous.endHeadingDeg, edge.beginHeadingDeg) >= U_TURN_HEADING_DELTA;
		const continuesSamePass = edge.wayId === previous?.wayId && !reversed;

		const entry = traversals.get(edge.wayId) ?? { count: 0, lengthKm: 0 };
		if (!continuesSamePass) entry.count += 1;
		entry.lengthKm += edge.lengthKm;
		traversals.set(edge.wayId, entry);
		previous = edge;
	}

	if (totalKm <= 0) return 0;
	let overlapKm = 0;
	for (const entry of traversals.values()) {
		if (entry.count >= 2) overlapKm += entry.lengthKm;
	}
	return Math.min(1, overlapKm / totalKm);
}

/**
 * Isoperimetric quotient (4πA/P²) of the loop polygon in a local planar
 * projection. A circle scores 1; a degenerate out-and-back sliver scores ~0.
 */
export function shapeCompactness(geometry: Coordinate[]): number {
	if (geometry.length < 4) return 0;
	const lat0 = (geometry[0][1] * Math.PI) / 180;
	const kx = Math.cos(lat0);
	// Equirectangular projection in degree units; the quotient is scale-free.
	const points = geometry.map(([lon, lat]) => [lon * kx, lat] as const);

	let area2 = 0;
	let perimeter = 0;
	for (let i = 0; i < points.length; i++) {
		const [x1, y1] = points[i];
		const [x2, y2] = points[(i + 1) % points.length];
		area2 += x1 * y2 - x2 * y1;
		perimeter += Math.hypot(x2 - x1, y2 - y1);
	}
	if (perimeter <= 0) return 0;
	const area = Math.abs(area2) / 2;
	return Math.min(1, (4 * Math.PI * area) / (perimeter * perimeter));
}

export function surfaceFitScore(metersByBucket: Record<SurfaceBucket, number>, pref: SurfaceType): number {
	return 1 - surfaceMismatchFraction(metersByBucket, pref);
}

export function scoreCandidate(
	candidate: RoutedCandidate,
	targetDistanceKm: number,
	surfacePreference: SurfaceType,
	metersByBucket: Record<SurfaceBucket, number>,
): CandidateScore {
	const overlap = overlapFraction(candidate.edges);
	const distanceMatch = distanceMatchScore(candidate.distanceKm, targetDistanceKm);
	const surfaceFit = surfaceFitScore(metersByBucket, surfacePreference);
	const compactness = shapeCompactness(candidate.geometry);

	const w = GENERATION_SCORE_WEIGHTS;
	const total =
		w.overlap * (1 - overlap) +
		w.distanceMatch * distanceMatch +
		w.surfaceFit * surfaceFit +
		w.shapeCompactness * compactness;

	return {
		total,
		overlap,
		distanceMatch,
		surfaceFit,
		shapeCompactness: compactness,
	};
}
