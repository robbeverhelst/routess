import type { Coordinate } from "../types";
import { calculateBearing, haversineDistance } from "../utils/geospatial";
import { bearingsForHeading, normalizeBearing } from "./fan";
import type { CandidatePlan, Heading } from "./types";

// The isochrone fallback tactic (generation v2): when the geometric fan
// yields zero routable candidates (coasts, canal belts, sparse networks),
// place vias on the /isochrone frontier instead — by construction those
// points are reachable at a known road distance, no matter how distorted
// the network is around the start.

/**
 * Contour distance for a loop: the frontier is road distance, so circuity is
 * already paid. A two-via loop start → A → B → start covers roughly
 * 2.6 × contour (out, across, back), hence target ÷ 2.6.
 */
export const ISOCHRONE_CONTOUR_DIVISOR = 2.6;

export function isochroneContourKm(targetDistanceKm: number): number {
	return targetDistanceKm / ISOCHRONE_CONTOUR_DIVISOR;
}

/** Angular spread between the two frontier vias of one candidate. */
export const ISOCHRONE_VIA_SPREAD_DEG = 50;

/** Frontier vias closer together than this are the same point; skip the plan. */
const MIN_VIA_SEPARATION_KM = 0.2;

function nearestFrontierPoint(start: Coordinate, frontier: Coordinate[], bearingDeg: number): Coordinate | null {
	let best: Coordinate | null = null;
	let bestDelta = Infinity;
	for (const point of frontier) {
		const delta = Math.abs(normalizeBearing(calculateBearing(start, point) - bearingDeg));
		const wrapped = delta > 180 ? 360 - delta : delta;
		if (wrapped < bestDelta) {
			bestDelta = wrapped;
			best = point;
		}
	}
	// A frontier that does not extend toward the bearing at all (the sea side
	// of a coastal start) yields only far-off matches; reject those plans.
	return bestDelta <= ISOCHRONE_VIA_SPREAD_DEG ? best : null;
}

/**
 * Two-via candidates from the isochrone frontier: per fan bearing, one via
 * toward each side of it. The loop rides out to the frontier, along it, and
 * back — the most loop-like shape a hostile network still allows.
 */
export function planIsochroneCandidates(
	start: Coordinate,
	frontier: Coordinate[],
	heading: Heading,
	excludeBearings: number[] = [],
): CandidatePlan[] {
	if (frontier.length < 3) return [];
	const excluded = new Set(excludeBearings.map(normalizeBearing));
	const plans: CandidatePlan[] = [];
	for (const bearing of bearingsForHeading(heading)) {
		if (excluded.has(bearing)) continue;
		const a = nearestFrontierPoint(start, frontier, normalizeBearing(bearing - ISOCHRONE_VIA_SPREAD_DEG / 2));
		const b = nearestFrontierPoint(start, frontier, normalizeBearing(bearing + ISOCHRONE_VIA_SPREAD_DEG / 2));
		if (!a || !b || haversineDistance(a, b) < MIN_VIA_SEPARATION_KM) continue;
		// Identical via pairs from adjacent bearings collapse to one plan.
		const duplicate = plans.some(
			(plan) =>
				haversineDistance(plan.viaPoints[0], a) < MIN_VIA_SEPARATION_KM &&
				haversineDistance(plan.viaPoints[1], b) < MIN_VIA_SEPARATION_KM,
		);
		if (!duplicate) plans.push({ bearingDeg: bearing, viaPoints: [a, b] });
	}
	return plans;
}
