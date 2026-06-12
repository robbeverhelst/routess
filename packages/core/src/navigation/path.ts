import type { Coordinate } from "../types";
import { EARTH_RADIUS_KM, haversineDistance } from "../utils/geospatial";

// Path projection for navigation. Distances in meters throughout (the rest of
// core uses km; navigation thresholds are meter-scale, so meters here).

const DEG_TO_RAD = Math.PI / 180;
const METERS_PER_DEG_LAT = (EARTH_RADIUS_KM * 1000 * Math.PI) / 180;

export interface PathIndex {
	path: Coordinate[];
	/** Cumulative meters from the start to each point; same length as path. */
	cumulativeMeters: number[];
	totalMeters: number;
}

export interface PathProjection {
	/** Segment [i, i+1] the projection landed on. */
	segmentIndex: number;
	point: Coordinate;
	distanceAlongMeters: number;
	distanceFromPathMeters: number;
}

export function buildPathIndex(path: Coordinate[]): PathIndex {
	const cumulativeMeters: number[] = new Array(path.length);
	let total = 0;
	for (let i = 0; i < path.length; i++) {
		if (i > 0) total += haversineDistance(path[i - 1], path[i]) * 1000;
		cumulativeMeters[i] = total;
	}
	return { path, cumulativeMeters, totalMeters: total };
}

/** The coordinate at a given distance along the path, clamped to its ends. */
export function pointAtDistanceAlong(index: PathIndex, meters: number): Coordinate {
	const { path, cumulativeMeters } = index;
	if (path.length === 0) return [0, 0];
	if (meters <= 0) return path[0];
	if (meters >= index.totalMeters) return path[path.length - 1];
	let lo = 0;
	let hi = path.length - 1;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (cumulativeMeters[mid] < meters) lo = mid + 1;
		else hi = mid;
	}
	const i = Math.max(1, lo);
	const segLen = cumulativeMeters[i] - cumulativeMeters[i - 1];
	const t = segLen > 0 ? (meters - cumulativeMeters[i - 1]) / segLen : 0;
	const [lng1, lat1] = path[i - 1];
	const [lng2, lat2] = path[i];
	return [lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t];
}

interface SegmentHit {
	t: number;
	point: Coordinate;
	distanceMeters: number;
}

// Equirectangular projection around the query point: accurate to well under a
// meter at the ~100 m scales navigation cares about, and far cheaper than
// geodesic math per segment.
function projectOntoSegment(p: Coordinate, a: Coordinate, b: Coordinate): SegmentHit {
	const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos(p[1] * DEG_TO_RAD);
	const ax = (a[0] - p[0]) * metersPerDegLng;
	const ay = (a[1] - p[1]) * METERS_PER_DEG_LAT;
	const bx = (b[0] - p[0]) * metersPerDegLng;
	const by = (b[1] - p[1]) * METERS_PER_DEG_LAT;
	const dx = bx - ax;
	const dy = by - ay;
	const lenSq = dx * dx + dy * dy;
	const t = lenSq > 0 ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lenSq)) : 0;
	const x = ax + dx * t;
	const y = ay + dy * t;
	return {
		t,
		point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
		distanceMeters: Math.sqrt(x * x + y * y),
	};
}

/** Segments scanned on each side of the hint before falling back to a full scan. */
export const PROJECTION_WINDOW_SEGMENTS = 200;

/** A windowed hit farther than this triggers the full-scan fallback. */
const WINDOW_TRUST_METERS = 250;

/**
 * Nearest point on the path. With a segment hint, only a window around it is
 * scanned, which keeps a self-crossing loop from snapping to the far pass and
 * keeps per-fix cost bounded on long paths; a poor windowed hit falls back to
 * scanning everything (the rider may have been driven mid-route).
 */
export function projectOntoPath(index: PathIndex, coord: Coordinate, hintSegment?: number): PathProjection {
	const { path } = index;
	if (path.length === 0) {
		return { segmentIndex: 0, point: coord, distanceAlongMeters: 0, distanceFromPathMeters: Number.POSITIVE_INFINITY };
	}
	if (path.length === 1) {
		return {
			segmentIndex: 0,
			point: path[0],
			distanceAlongMeters: 0,
			distanceFromPathMeters: haversineDistance(coord, path[0]) * 1000,
		};
	}

	const scan = (from: number, to: number): PathProjection => {
		let best: PathProjection | null = null;
		for (let i = from; i < to; i++) {
			const hit = projectOntoSegment(coord, path[i], path[i + 1]);
			if (!best || hit.distanceMeters < best.distanceFromPathMeters) {
				const segLen = index.cumulativeMeters[i + 1] - index.cumulativeMeters[i];
				best = {
					segmentIndex: i,
					point: hit.point,
					distanceAlongMeters: index.cumulativeMeters[i] + segLen * hit.t,
					distanceFromPathMeters: hit.distanceMeters,
				};
			}
		}
		// from < to always holds for callers, so best is set.
		return best as PathProjection;
	};

	const lastSegment = path.length - 2;
	if (hintSegment !== undefined && lastSegment >= 0) {
		const from = Math.max(0, Math.min(hintSegment, lastSegment) - PROJECTION_WINDOW_SEGMENTS);
		const to = Math.min(lastSegment + 1, Math.max(hintSegment, 0) + PROJECTION_WINDOW_SEGMENTS + 1);
		const windowed = scan(from, to);
		if (windowed.distanceFromPathMeters <= WINDOW_TRUST_METERS || (from === 0 && to === lastSegment + 1)) {
			return windowed;
		}
	}
	return scan(0, lastSegment + 1);
}
