import { bucketFromValhallaSurface, bucketMatchesPreference } from "../routing/surface";
import type { SurfaceType } from "../routing/types";
import type { Coordinate } from "../types";
import { haversineDistance } from "../utils/geospatial";
import { CIRCUITY_FACTOR, loopRadiusKm, normalizeBearing } from "./fan";
import type { CandidatePlan, RoutedCandidate } from "./types";

// Surface-anchored wave (second-wave candidate tactic): the geometric fan is
// surface-blind, and the routing engine never detours for surface (edge costs
// cannot reward, only stop penalising; /locate snapping is clamped to ~200m
// by loki's max_radius). But the fan's own /trace_attributes results tell us
// exactly where the preferred surface IS. So when a strict preference fits
// poorly, harvest the matching runs the fan crossed and build a candidate
// whose vias sit on them — the one lever that genuinely moves the loop.

/** A run of preferred-surface distance discovered on a routed candidate. */
export interface SurfaceAnchor {
	point: Coordinate;
	lengthKm: number;
}

/**
 * Runs shorter than this are stubs: anchoring a `through` via on a short gravel
 * branch forces the loop to spur in and back out (a dead-end). Longer runs are
 * far likelier to be through-connectable, so the loop passes along them.
 */
export const SURFACE_ANCHOR_MIN_RUN_KM = 0.6;

/** Anchors closer together than this are the same cluster; keep the longest. */
const ANCHOR_DEDUPE_KM = 0.4;

const MAX_ANCHORS_KEPT = 12;

/** Vias per anchored candidate; more anchors than this add little and slow routing. */
export const SURFACE_ANCHOR_MAX_VIAS = 6;

/** Chord-perimeter headroom over the target before an anchor stops fitting. */
const CHORD_BUDGET_FACTOR = 1.15;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;
const toDegrees = (rad: number): number => (rad * 180) / Math.PI;

/** Bearing (0..360) from `from` to `to`, equirectangular approximation. */
function bearingTo(from: Coordinate, to: Coordinate): number {
	const kx = Math.cos(toRadians(from[1]));
	const dx = (to[0] - from[0]) * kx;
	const dy = to[1] - from[1];
	return normalizeBearing(toDegrees(Math.atan2(dx, dy)));
}

/**
 * Harvest SurfaceAnchors from routed candidates: consecutive edges matching
 * the preference collapse into runs; each run anchors at the edge holding its
 * halfway point. Returned longest-first, deduped by proximity, and filtered
 * to distances from the start where a target-sized loop can plausibly visit.
 */
export function collectSurfaceAnchors(
	candidates: Pick<RoutedCandidate, "edges">[],
	pref: SurfaceType,
	start: Coordinate,
	targetDistanceKm: number,
): SurfaceAnchor[] {
	const radius = loopRadiusKm(targetDistanceKm);
	const minKm = 0.15 * radius;
	const maxKm = 2.5 * radius;

	const runs: SurfaceAnchor[] = [];
	for (const candidate of candidates) {
		let run: { lengthKm: number; midpoint: Coordinate }[] = [];
		const flush = () => {
			const lengthKm = run.reduce((sum, e) => sum + e.lengthKm, 0);
			if (lengthKm >= SURFACE_ANCHOR_MIN_RUN_KM) {
				let acc = 0;
				let point = run[0].midpoint;
				for (const e of run) {
					acc += e.lengthKm;
					if (acc >= lengthKm / 2) {
						point = e.midpoint;
						break;
					}
				}
				runs.push({ point, lengthKm });
			}
			run = [];
		};
		for (const edge of candidate.edges) {
			if (edge.midpoint && bucketMatchesPreference(bucketFromValhallaSurface(edge.surface), pref)) {
				run.push({ lengthKm: edge.lengthKm, midpoint: edge.midpoint });
			} else {
				flush();
			}
		}
		flush();
	}

	const inRange = runs.filter((r) => {
		const km = haversineDistance(start, r.point);
		return km >= minKm && km <= maxKm;
	});
	inRange.sort((a, b) => b.lengthKm - a.lengthKm);

	const kept: SurfaceAnchor[] = [];
	for (const run of inRange) {
		if (kept.length >= MAX_ANCHORS_KEPT) break;
		if (kept.every((k) => haversineDistance(k.point, run.point) >= ANCHOR_DEDUPE_KM)) kept.push(run);
	}
	return kept;
}

/** Vias in loop-visiting order: by angle around the centroid, starting after the start. */
function orderAroundLoop(start: Coordinate, vias: Coordinate[]): Coordinate[] {
	const all = [start, ...vias];
	const kx = Math.cos(toRadians(start[1]));
	const cx = all.reduce((s, p) => s + p[0] * kx, 0) / all.length;
	const cy = all.reduce((s, p) => s + p[1], 0) / all.length;
	const angle = (p: Coordinate) => Math.atan2(p[1] - cy, p[0] * kx - cx);
	const startAngle = angle(start);
	const after = (p: Coordinate) => {
		const a = angle(p) - startAngle;
		return a < 0 ? a + 2 * Math.PI : a;
	};
	return [...vias].sort((a, b) => after(a) - after(b));
}

function chordPerimeterKm(start: Coordinate, vias: Coordinate[]): number {
	const loop = [start, ...orderAroundLoop(start, vias), start];
	let km = 0;
	for (let i = 0; i + 1 < loop.length; i++) km += haversineDistance(loop[i], loop[i + 1]);
	return km;
}

/**
 * Candidates whose vias sit on the longest anchors that still fit the distance
 * budget: greedily admit anchors (longest first) while the chord perimeter
 * stays under target ÷ circuity, then visit them in angular order. Returns a
 * cascade of plans with decreasing via counts (the full set, then progressively
 * fewer) so the caller can fall back when many `through` points fail to route.
 */
export function planSurfaceAnchoredCandidates(
	start: Coordinate,
	anchors: SurfaceAnchor[],
	targetDistanceKm: number,
): CandidatePlan[] {
	if (anchors.length === 0) return [];
	const budgetKm = (targetDistanceKm / CIRCUITY_FACTOR) * CHORD_BUDGET_FACTOR;

	let selected: SurfaceAnchor[] = [];
	for (const anchor of anchors) {
		if (selected.length >= SURFACE_ANCHOR_MAX_VIAS) break;
		const trial = [...selected, anchor];
		if (
			chordPerimeterKm(
				start,
				trial.map((a) => a.point),
			) <= budgetKm
		)
			selected = trial;
	}
	if (selected.length === 0) selected = [anchors[0]];

	const planFor = (chosen: SurfaceAnchor[]): CandidatePlan => {
		const viaPoints = orderAroundLoop(
			start,
			chosen.map((a) => a.point),
		);
		const centroid: Coordinate = [
			viaPoints.reduce((s, p) => s + p[0], 0) / viaPoints.length,
			viaPoints.reduce((s, p) => s + p[1], 0) / viaPoints.length,
		];
		return { bearingDeg: bearingTo(start, centroid), viaPoints };
	};

	// Full set first, then halve toward a single via: more vias hug more gravel
	// but strain the router; the caller takes the first that routes.
	const plans: CandidatePlan[] = [];
	for (let count = selected.length; count >= 1; count = Math.floor(count / 2)) {
		plans.push(planFor(selected.slice(0, count)));
		if (count === 1) break;
	}
	return plans;
}
