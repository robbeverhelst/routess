import type { Coordinate } from "../types";
import { EARTH_RADIUS_KM } from "../utils/geospatial";
import type { CandidatePlan, Heading } from "./types";

// The geometric candidate fan (v1 candidate tactic, ADR-0029): for each
// bearing, place via points on a circle sized so the routed loop lands near
// the target distance. Via points are later snap-validated against the road
// network by the API before routing.

/** Road distance ÷ crow-flies distance, observed ~1.2–1.5 on EU networks. */
export const CIRCUITY_FACTOR = 1.3;

/** Via points per candidate loop (start + vias = inscribed polygon corners). */
export const VIA_POINT_COUNT = 3;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;
const toDegrees = (rad: number): number => (rad * 180) / Math.PI;

export const normalizeBearing = (deg: number): number => ((deg % 360) + 360) % 360;

/** Forward geodesic: the point `distanceKm` from `start` along `bearingDeg`. */
export function destinationPoint(start: Coordinate, bearingDeg: number, distanceKm: number): Coordinate {
	const [lon, lat] = start;
	const angular = distanceKm / EARTH_RADIUS_KM;
	const bearing = toRadians(bearingDeg);
	const lat1 = toRadians(lat);
	const lon1 = toRadians(lon);

	const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
	const lon2 =
		lon1 +
		Math.atan2(
			Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
			Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
		);

	return [((toDegrees(lon2) + 540) % 360) - 180, toDegrees(lat2)];
}

const HEADING_CENTER: Record<Exclude<Heading, "any">, number> = {
	north: 0,
	east: 90,
	south: 180,
	west: 270,
};

/**
 * The bearings the fan tries. `any` sweeps the full circle; a compass Heading
 * restricts to a ±45° arc around it (soft preference, never a guarantee).
 */
export function bearingsForHeading(heading: Heading): number[] {
	if (heading === "any") {
		return [0, 45, 90, 135, 180, 225, 270, 315];
	}
	const center = HEADING_CENTER[heading];
	return [-45, -22.5, 0, 22.5, 45].map((offset) => normalizeBearing(center + offset));
}

/**
 * Circle radius for a target loop distance: the loop visits the corners of a
 * regular (vias+1)-gon inscribed in a circle through the start; chord
 * perimeter × circuity ≈ routed distance.
 */
export function loopRadiusKm(targetDistanceKm: number, viaCount: number = VIA_POINT_COUNT): number {
	const corners = viaCount + 1;
	const chordPerimeterFactor = 2 * corners * Math.sin(Math.PI / corners);
	return targetDistanceKm / (chordPerimeterFactor * CIRCUITY_FACTOR);
}

/**
 * Via points for one candidate: corners of the inscribed polygon, walked
 * around the circle whose near edge touches the start and whose center lies
 * `radius` away along the candidate bearing.
 */
export function planCandidate(
	start: Coordinate,
	bearingDeg: number,
	targetDistanceKm: number,
	viaCount: number = VIA_POINT_COUNT,
): CandidatePlan {
	const radius = loopRadiusKm(targetDistanceKm, viaCount);
	const center = destinationPoint(start, bearingDeg, radius);
	// Angle from center back to start; vias follow at equal steps around.
	const startAngle = normalizeBearing(bearingDeg + 180);
	const step = 360 / (viaCount + 1);
	const viaPoints: Coordinate[] = [];
	for (let k = 1; k <= viaCount; k++) {
		viaPoints.push(destinationPoint(center, normalizeBearing(startAngle + k * step), radius));
	}
	return { bearingDeg, viaPoints };
}

/**
 * Via count for knooppunt mode: more polygon corners means more vias to snap
 * onto Nodes, which is what actually drags the loop along the network (the
 * router never follows signed routes between two distant points on its own).
 * Still bounded: too many `through` points starts defeating the router.
 */
export const NODE_NETWORK_VIA_COUNT = 5;

/** The full fan for a request, minus bearings the user has already seen. */
export function planCandidateFan(
	start: Coordinate,
	heading: Heading,
	targetDistanceKm: number,
	excludeBearings: number[] = [],
	viaCount: number = VIA_POINT_COUNT,
): CandidatePlan[] {
	const excluded = new Set(excludeBearings.map(normalizeBearing));
	return bearingsForHeading(heading)
		.filter((bearing) => !excluded.has(bearing))
		.map((bearing) => planCandidate(start, bearing, targetDistanceKm, viaCount));
}

/**
 * Surface wave (second-wave candidate tactic): when the fan's best candidate
 * still misses a strict surface preference, probe the bearings adjacent to
 * the best-fitting one. Unpaved networks cluster, so the neighbours of the
 * gravelliest bearing are where the fan's coarse spacing most likely skipped
 * over the good stuff.
 */
export const SURFACE_WAVE_BEARING_OFFSETS = [-22.5, 22.5] as const;

/** Best surfaceFit below this triggers the surface wave. */
export const SURFACE_WAVE_TRIGGER_FIT = 0.85;

export function planSurfaceWave(
	start: Coordinate,
	bestBearingDeg: number,
	targetDistanceKm: number,
	usedBearings: number[] = [],
): CandidatePlan[] {
	const used = new Set(usedBearings.map(normalizeBearing));
	return SURFACE_WAVE_BEARING_OFFSETS.map((offset) => normalizeBearing(bestBearingDeg + offset))
		.filter((bearing) => !used.has(bearing))
		.map((bearing) => planCandidate(start, bearing, targetDistanceKm));
}

/**
 * One-shot radius refinement: if a routed candidate's distance misses the
 * target badly, rescale the circle by the miss ratio and re-plan the same
 * bearing. Pure; the caller decides whether to re-route the new plan.
 */
export const REFINE_MISS_RATIO = 0.25;

export function refinePlanForDistance(
	start: Coordinate,
	plan: CandidatePlan,
	targetDistanceKm: number,
	actualDistanceKm: number,
	viaCount: number = VIA_POINT_COUNT,
): CandidatePlan | null {
	if (actualDistanceKm <= 0) return null;
	const missRatio = Math.abs(actualDistanceKm - targetDistanceKm) / targetDistanceKm;
	if (missRatio <= REFINE_MISS_RATIO) return null;
	const scaledTarget = targetDistanceKm * (targetDistanceKm / actualDistanceKm);
	return planCandidate(start, plan.bearingDeg, scaledTarget, viaCount);
}
