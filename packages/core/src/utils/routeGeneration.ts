import type { Coordinate, Waypoint } from "../types";
import { haversineDistance } from "./geospatial";

// Heuristic strategy for compressing a dense track of GPS points down
// to a small set of "smart" waypoints. Detects significant direction
// changes (using a windowed bearing) and emits waypoints at each
// turn, plus periodic distance markers. Caps the result so the user
// can still hand-edit the route.

export interface SmartWaypointThresholds {
	// Minimum bearing change (degrees) over the surrounding window for a
	// point to count as a turn.
	directionChangeThresholdDeg: number;
	// Distance the cumulative track has to advance before forcing another
	// waypoint, even on a straight stretch.
	maxDistanceIntervalKm: number;
	// Drop candidates closer than this to the most recently emitted waypoint.
	minDistanceBetweenWaypointsKm: number;
	// Hard cap on the total waypoints returned, including start and end.
	maxWaypoints: number;
}

export const DEFAULT_SMART_WAYPOINT_THRESHOLDS: SmartWaypointThresholds = {
	directionChangeThresholdDeg: 30,
	maxDistanceIntervalKm: 2.0,
	minDistanceBetweenWaypointsKm: 0.1,
	maxWaypoints: 15,
};

function calculateBearing(a: Coordinate, b: Coordinate): number {
	const lat1 = (a[1] * Math.PI) / 180;
	const lat2 = (b[1] * Math.PI) / 180;
	const deltaLon = ((b[0] - a[0]) * Math.PI) / 180;
	const y = Math.sin(deltaLon) * Math.cos(lat2);
	const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
	const bearing = (Math.atan2(y, x) * 180) / Math.PI;
	return (bearing + 360) % 360;
}

function angleDifference(a: number, b: number): number {
	let diff = Math.abs(a - b);
	if (diff > 180) diff = 360 - diff;
	return diff;
}

function reduceToCap(waypoints: Coordinate[], cap: number): Coordinate[] {
	if (waypoints.length <= cap) return waypoints;
	const reduced: Coordinate[] = [waypoints[0]];
	const middleSlots = cap - 2;
	const step = Math.max(1, Math.floor((waypoints.length - 2) / middleSlots));
	for (let i = step; i < waypoints.length - 1; i += step) {
		if (reduced.length < cap - 1) reduced.push(waypoints[i]);
	}
	reduced.push(waypoints[waypoints.length - 1]);
	return reduced;
}

// Pure function — given a dense track, return a sparse set of smart
// waypoints by detecting turns and periodic distance milestones.
export function selectSmartWaypoints(
	trackPoints: Coordinate[],
	thresholds: SmartWaypointThresholds = DEFAULT_SMART_WAYPOINT_THRESHOLDS,
): Coordinate[] {
	if (trackPoints.length < 2) return [...trackPoints];

	const waypoints: Coordinate[] = [trackPoints[0]];
	let lastWaypointIndex = 0;
	let cumulativeDistance = 0;

	for (let i = 1; i < trackPoints.length - 1; i++) {
		const currentPoint = trackPoints[i];
		const prevPoint = trackPoints[i - 1];
		const lastWaypoint = trackPoints[lastWaypointIndex];

		const distanceFromLastWaypoint = haversineDistance(lastWaypoint, currentPoint);
		const segmentDistance = haversineDistance(prevPoint, currentPoint);
		cumulativeDistance += segmentDistance;

		if (distanceFromLastWaypoint < thresholds.minDistanceBetweenWaypointsKm) continue;

		let shouldAdd = false;

		if (i >= 2 && i < trackPoints.length - 2) {
			const windowSize = Math.min(3, Math.floor(trackPoints.length / 20));
			const beforeIndex = Math.max(0, i - windowSize);
			const afterIndex = Math.min(trackPoints.length - 1, i + windowSize);
			const bearingBefore = calculateBearing(trackPoints[beforeIndex], currentPoint);
			const bearingAfter = calculateBearing(currentPoint, trackPoints[afterIndex]);
			if (angleDifference(bearingBefore, bearingAfter) >= thresholds.directionChangeThresholdDeg) {
				shouldAdd = true;
			}
		}

		if (cumulativeDistance >= thresholds.maxDistanceIntervalKm) {
			shouldAdd = true;
			cumulativeDistance = 0;
		}

		if (shouldAdd) {
			waypoints.push(currentPoint);
			lastWaypointIndex = i;
		}
	}

	const last = trackPoints[trackPoints.length - 1];
	const distanceToEnd = haversineDistance(waypoints[waypoints.length - 1], last);
	if (distanceToEnd >= thresholds.minDistanceBetweenWaypointsKm) {
		waypoints.push(last);
	}

	return reduceToCap(waypoints, thresholds.maxWaypoints);
}

// ===== Lazy densify (generated drafts) =====
//
// A generated Route's geometry carries more information than its sparse
// control waypoints: between vias 10 km apart the loop took one specific
// road sequence, but "shortest path between the vias" is a different answer,
// so the first recalculation would unravel the loop. Before the first
// mutating edit, the editor densifies: smart waypoints are inserted along
// the CURRENT RoutePath between the existing waypoints, pinning the shape
// so each leg is short enough to have only one sane routing answer.

export interface DensifyResult {
	waypoints: Waypoint[];
	/** New index of each original waypoint (originals are never removed). */
	indexMap: number[];
	insertedCount: number;
}

export const DENSIFY_THRESHOLDS: SmartWaypointThresholds = {
	directionChangeThresholdDeg: 35,
	maxDistanceIntervalKm: 2.0,
	minDistanceBetweenWaypointsKm: 0.4,
	// Per-segment cap; segments are short, so this is rarely hit.
	maxWaypoints: 8,
};

function nearestPathIndex(point: Coordinate, path: Coordinate[], from: number): number {
	let best = from;
	let bestKm = Infinity;
	for (let i = from; i < path.length; i++) {
		const km = haversineDistance(point, path[i]);
		if (km < bestKm) {
			bestKm = km;
			best = i;
		}
	}
	return best;
}

/**
 * Insert smart waypoints along `routePath` between the existing waypoints.
 * Originals keep their position, name, and Type; insertions are `routed`.
 * Segments whose endpoint is `direct` are skipped (a straight line is
 * already fully reproducible). Idempotent once segments are short.
 */
export function densifyWaypointsAlongPath(
	waypoints: Waypoint[],
	routePath: Coordinate[],
	thresholds: SmartWaypointThresholds = DENSIFY_THRESHOLDS,
): DensifyResult {
	const identity = () => ({
		waypoints,
		indexMap: waypoints.map((_, i) => i),
		insertedCount: 0,
	});
	if (waypoints.length < 2 || routePath.length < 2) return identity();

	// Anchor each waypoint to the path, walking forward so a loop's closing
	// waypoint anchors at the END of the path, not back at the start.
	const anchors: number[] = [];
	const anchorKm: number[] = [];
	let cursor = 0;
	for (const wp of waypoints) {
		const anchor = nearestPathIndex(wp.coord, routePath, cursor);
		anchors.push(anchor);
		anchorKm.push(haversineDistance(wp.coord, routePath[anchor]));
		cursor = anchor;
	}

	// A waypoint this far from the path is not a faithful control point of it
	// (e.g. it was just dragged); its adjacent segments must not be pinned to
	// the stale geometry.
	const ON_PATH_TOLERANCE_KM = 0.1;

	const result: Waypoint[] = [];
	const indexMap: number[] = [];
	let insertedCount = 0;

	// Guard insertions against EVERY existing waypoint, not just the segment
	// endpoints: after an edit drags a waypoint off the old path, anchoring
	// degrades and a segment's sub-path can sweep past other waypoints —
	// without this, re-densifying would duplicate them.
	const tooCloseToExisting = (coord: Coordinate): boolean =>
		waypoints.some((wp) => haversineDistance(coord, wp.coord) < thresholds.minDistanceBetweenWaypointsKm);

	for (let i = 0; i < waypoints.length; i++) {
		indexMap.push(result.length);
		result.push(waypoints[i]);
		if (i === waypoints.length - 1) break;

		// Per-waypoint Type describes the segment ARRIVING at it: skip
		// densifying segments that end in a `direct` waypoint.
		if (waypoints[i + 1].type === "direct") continue;
		if (anchorKm[i] > ON_PATH_TOLERANCE_KM || anchorKm[i + 1] > ON_PATH_TOLERANCE_KM) continue;

		const subPath = routePath.slice(anchors[i], anchors[i + 1] + 1);
		if (subPath.length < 3) continue;

		// Interior smart points only; the originals bound the segment.
		const smart = selectSmartWaypoints(subPath, thresholds).slice(1, -1);
		for (const coord of smart) {
			if (tooCloseToExisting(coord)) continue;
			result.push({ coord, type: "routed" });
			insertedCount++;
		}
	}

	return { waypoints: result, indexMap, insertedCount };
}
