import type { Coordinate } from "../types";
import { haversineDistance } from "../utils/geospatial";

// Spur repair: the failure mode no snap-time filter can catch. A via that
// sits partway along a side road forces the router to leave the natural loop
// at a junction, ride to the via, and ride back — visible only AFTER routing
// as a "pinch": two points close together in space but far apart along the
// path, with the via inside the excursion. The repair moves the via to the
// pinch junction so the loop passes through it naturally on the next routing.

/** Two path points closer than this (crow-flies) form a pinch. */
export const SPUR_PINCH_GAP_KM = 0.045;

/** Excursions shorter than this are not worth a repair round trip. */
export const SPUR_MIN_EXCURSION_KM = 0.2;

// How far along the path (each side of the via) to look for the pinch.
const WINDOW_FRACTION_OF_TARGET = 0.15;
const WINDOW_MIN_KM = 0.5;
const WINDOW_MAX_KM = 3;

/** Examine path points roughly this far apart; full density is overkill. */
const SCAN_STRIDE_KM = 0.02;

export function nearestVertexIndex(point: Coordinate, polyline: Coordinate[]): number {
	let nearest = 0;
	let nearestKm = Infinity;
	for (let i = 0; i < polyline.length; i++) {
		const km = haversineDistance(point, polyline[i]);
		if (km < nearestKm) {
			nearestKm = km;
			nearest = i;
		}
	}
	return nearest;
}

export interface SpurRepair {
	/** Index into the viaPoints array. */
	viaIndex: number;
	/** Where the spur leaves and rejoins the loop; the via's new position. */
	junction: Coordinate;
	excursionKm: number;
}

interface StridedPoint {
	index: number;
	cumKm: number;
}

function cumulativeKm(geometry: Coordinate[]): number[] {
	const cum = new Array<number>(geometry.length);
	cum[0] = 0;
	for (let i = 1; i < geometry.length; i++) {
		cum[i] = cum[i - 1] + haversineDistance(geometry[i - 1], geometry[i]);
	}
	return cum;
}

function stridedRange(cum: number[], from: number, to: number): StridedPoint[] {
	const points: StridedPoint[] = [];
	let lastKm = -Infinity;
	for (let i = from; i <= to; i++) {
		if (cum[i] - lastKm >= SCAN_STRIDE_KM) {
			points.push({ index: i, cumKm: cum[i] });
			lastKm = cum[i];
		}
	}
	return points;
}

/**
 * Detect the widest pinch around each via: points `a` (before) and `b`
 * (after) within the window, nearly touching in space, with a real excursion
 * between them along the path. Returns one repair per affected via.
 */
export function detectSpurVias(
	geometry: Coordinate[],
	viaPoints: Coordinate[],
	targetDistanceKm: number,
): SpurRepair[] {
	if (geometry.length < 4) return [];
	const cum = cumulativeKm(geometry);
	const total = cum[cum.length - 1];
	const windowKm = Math.min(WINDOW_MAX_KM, Math.max(WINDOW_MIN_KM, targetDistanceKm * WINDOW_FRACTION_OF_TARGET));

	const repairs: SpurRepair[] = [];
	for (let viaIndex = 0; viaIndex < viaPoints.length; viaIndex++) {
		const at = nearestVertexIndex(viaPoints[viaIndex], geometry);

		let from = at;
		while (from > 0 && cum[at] - cum[from - 1] <= windowKm) from--;
		let to = at;
		while (to < geometry.length - 1 && cum[to + 1] - cum[at] <= windowKm) to++;
		// Never wrap past the loop ends: the start point legitimately closes
		// the loop and must not read as a pinch.
		if (from === 0) from = 1;
		if (to === geometry.length - 1) to = geometry.length - 2;
		if (from >= at || to <= at) continue;

		const before = stridedRange(cum, from, at);
		const after = stridedRange(cum, at, to);

		let best: SpurRepair | null = null;
		for (const a of before) {
			for (const b of after) {
				const excursionKm = b.cumKm - a.cumKm;
				if (excursionKm < SPUR_MIN_EXCURSION_KM) continue;
				// Genuine loop sections also pass near themselves; require the
				// excursion to dwarf the gap so only real spurs qualify.
				if (excursionKm < total && excursionKm > total - SPUR_MIN_EXCURSION_KM) continue;
				const gapKm = haversineDistance(geometry[a.index], geometry[b.index]);
				if (gapKm > SPUR_PINCH_GAP_KM) continue;
				if (excursionKm < gapKm * 5) continue;
				if (!best || excursionKm > best.excursionKm) {
					const [lonA, latA] = geometry[a.index];
					const [lonB, latB] = geometry[b.index];
					best = {
						viaIndex,
						junction: [(lonA + lonB) / 2, (latA + latB) / 2],
						excursionKm,
					};
				}
			}
		}
		if (best) repairs.push(best);
	}
	return repairs;
}

/** Apply repairs: vias inside a spur move to the spur's junction. */
export function repairSpurVias(
	geometry: Coordinate[],
	viaPoints: Coordinate[],
	targetDistanceKm: number,
): { viaPoints: Coordinate[]; movedCount: number } {
	const repairs = detectSpurVias(geometry, viaPoints, targetDistanceKm);
	if (repairs.length === 0) return { viaPoints, movedCount: 0 };
	const next = [...viaPoints];
	for (const repair of repairs) {
		next[repair.viaIndex] = repair.junction;
	}
	return { viaPoints: next, movedCount: repairs.length };
}
