import type { Coordinate } from "../types";
import { calculateBearing, closestPointOnSegment, haversineDistance } from "../utils/geospatial";
import { CIRCUITY_FACTOR, destinationPoint, normalizeBearing } from "./fan";
import type { CandidatePlan } from "./types";

// A-to-B generation (generation v2): stretch the shortest path toward a
// target distance with detour vias placed perpendicular to the corridor.
// The bearing of each plan is the direction its detour extends — the same
// regenerate/exclude token the loop fan uses.

/** Detour offsets below this are noise; the direct route is the candidate. */
const MIN_DETOUR_OFFSET_KM = 0.3;

/** Crow-flies length budget the routed target affords (circuity paid). */
const crowBudgetKm = (targetDistanceKm: number): number => targetDistanceKm / CIRCUITY_FACTOR;

/**
 * Single-via detour: via at the corridor midpoint, offset perpendicular so
 * start → via → end crow-flies spends the whole budget.
 */
export function singleDetourOffsetKm(corridorKm: number, targetDistanceKm: number): number {
	const half = crowBudgetKm(targetDistanceKm) / 2;
	return Math.sqrt(Math.max(0, half * half - (corridorKm / 2) * (corridorKm / 2)));
}

/**
 * Two-via detour: vias above the corridor's 1/3 and 2/3 points, the middle
 * leg riding parallel; both offset so the three legs spend the budget.
 */
export function doubleDetourOffsetKm(corridorKm: number, targetDistanceKm: number): number {
	const third = corridorKm / 3;
	const legHalf = (crowBudgetKm(targetDistanceKm) - third) / 2;
	return Math.sqrt(Math.max(0, legHalf * legHalf - third * third));
}

/**
 * The a-to-b candidate plans: the direct path plus single- and two-via
 * detours to each side of the corridor. Bearings are detour directions
 * (single: ±90° off the corridor; double: ±112.5° as a distinct token).
 */
export function planAtoBCandidates(
	start: Coordinate,
	end: Coordinate,
	targetDistanceKm: number,
	excludeBearings: number[] = [],
): CandidatePlan[] {
	const corridorKm = haversineDistance(start, end);
	if (corridorKm <= 0) return [];
	const heading = calculateBearing(start, end);
	const excluded = new Set(excludeBearings.map(normalizeBearing));

	const plans: CandidatePlan[] = [];
	const push = (bearingDeg: number, viaPoints: Coordinate[]) => {
		const normalized = normalizeBearing(bearingDeg);
		if (!excluded.has(normalized)) plans.push({ bearingDeg: normalized, viaPoints });
	};

	// The direct path: the honest baseline (and the only plan when the target
	// barely exceeds the shortest path).
	push(heading, []);

	const single = singleDetourOffsetKm(corridorKm, targetDistanceKm);
	if (single >= MIN_DETOUR_OFFSET_KM) {
		const midpoint = destinationPoint(start, heading, corridorKm / 2);
		for (const side of [90, -90]) {
			push(heading + side, [destinationPoint(midpoint, normalizeBearing(heading + side), single)]);
		}
	}

	const double = doubleDetourOffsetKm(corridorKm, targetDistanceKm);
	if (double >= MIN_DETOUR_OFFSET_KM) {
		const oneThird = destinationPoint(start, heading, corridorKm / 3);
		const twoThirds = destinationPoint(start, heading, (2 * corridorKm) / 3);
		for (const side of [112.5, -112.5]) {
			const offsetBearing = normalizeBearing(heading + (side > 0 ? 90 : -90));
			push(heading + side, [
				destinationPoint(oneThird, offsetBearing, double),
				destinationPoint(twoThirds, offsetBearing, double),
			]);
		}
	}

	return plans;
}

/**
 * Corridor sanity (replaces shape compactness for a-to-b): 1 while the path
 * never strays beyond the deviation its target justifies, decaying to 0 at
 * twice that. Catches routes that wander off sideways or overshoot the ends.
 */
export function corridorSanity(
	geometry: Coordinate[],
	start: Coordinate,
	end: Coordinate,
	targetDistanceKm: number,
): number {
	if (geometry.length === 0) return 0;
	const corridorKm = haversineDistance(start, end);
	const allowedKm = Math.max(1, singleDetourOffsetKm(corridorKm, targetDistanceKm) * 1.25);

	let maxDeviationKm = 0;
	for (const point of geometry) {
		const onCorridor = closestPointOnSegment(point, start, end);
		const deviation = haversineDistance(point, onCorridor);
		if (deviation > maxDeviationKm) maxDeviationKm = deviation;
	}
	return Math.min(1, Math.max(0, 2 - maxDeviationKm / allowedKm));
}
