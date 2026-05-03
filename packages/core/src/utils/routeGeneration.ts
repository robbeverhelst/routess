import { haversineDistance } from "./geospatial";
import type { Coordinate } from "../types";

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
