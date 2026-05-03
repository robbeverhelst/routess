import type { Coordinate, Waypoint, WaypointType } from "@routess/core";
import { haversineDistance } from "@routess/core";
import { checkNearRoad, closestPointOnSegment } from "@/features/routing/utils/RoutingUtils";

// Pure decision functions for waypoint mutations. No store reads, no map
// mutations, no localStorage, no snapshots — those orchestration concerns
// live in WaypointManager.

const MAX_CLICK_DISTANCE_FROM_ROUTE_KM = 0.1;

export interface PreAddSnap {
	coord: Coordinate;
	type: WaypointType;
	checkNearRoadFailed: boolean;
}

// Decide what coord/type to push when adding a waypoint. For initial or
// "direct" adds, returns the input as-is. For routed subsequent points,
// snaps via checkNearRoad (49m); on failure, returns the raw coord with
// checkNearRoadFailed = true so the caller can react if route calculation
// later fails too.
export async function resolveAddCoord(
	coord: Coordinate,
	type: WaypointType,
	isFirstWaypoint: boolean,
	accessToken: string,
): Promise<PreAddSnap> {
	if (type === "direct" || isFirstWaypoint) {
		return { coord, type, checkNearRoadFailed: false };
	}
	const roadCheck = await checkNearRoad(coord, accessToken);
	if (roadCheck.isValid && roadCheck.snappedCoords) {
		return { coord: roadCheck.snappedCoords, type: "routed", checkNearRoadFailed: false };
	}
	return { coord, type: "routed", checkNearRoadFailed: true };
}

// Reverse a waypoint sequence, preserving segment-leading-to-each-waypoint
// type semantics: the type of the segment that *led to* the original
// waypoint i becomes the type of the segment leading to its mirrored
// position.
export function reverseWaypoints(waypoints: Waypoint[]): Waypoint[] {
	if (waypoints.length < 2) return [...waypoints];
	const reversedCoords = [...waypoints].reverse().map((wp) => wp.coord);
	const types = waypoints.map((wp) => wp.type);
	const reversedTypes = [...types.slice(1).reverse(), types[0]];
	return reversedCoords.map((coord, i) => ({ coord, type: reversedTypes[i] }));
}

export interface InsertOnRouteResult {
	waypoints: Waypoint[];
	insertIndex: number;
}

// Decide where to insert a new (routed) waypoint along the existing route
// path, given a click coordinate. Returns the updated waypoints array and
// the insert index, or null if the click is too far from the route.
export function insertWaypointOnRoute(
	waypoints: Waypoint[],
	routePath: Coordinate[],
	clickedCoord: Coordinate,
): InsertOnRouteResult | null {
	if (routePath.length < 2) return null;

	let minDistance = Infinity;
	let closestPointOnRoute: Coordinate = clickedCoord;
	let insertIndex = waypoints.length;

	const routeCoordToIndexMap = new Map<string, number>();
	for (let idx = 0; idx < routePath.length; idx++) {
		const c = routePath[idx];
		routeCoordToIndexMap.set(`${c[0]},${c[1]}`, idx);
	}

	for (let i = 0; i < routePath.length - 1; i++) {
		const start = routePath[i];
		const end = routePath[i + 1];
		const pointOnSegment = closestPointOnSegment(clickedCoord, start, end);
		const distanceToSegmentPoint = haversineDistance(clickedCoord, pointOnSegment);

		if (distanceToSegmentPoint < minDistance) {
			minDistance = distanceToSegmentPoint;
			closestPointOnRoute = pointOnSegment;

			for (let j = 0; j < waypoints.length - 1; j++) {
				const wpStartKey = `${waypoints[j].coord[0]},${waypoints[j].coord[1]}`;
				const wpStartIndexInPath = routeCoordToIndexMap.get(wpStartKey) ?? -1;
				const wpEndKey = `${waypoints[j + 1].coord[0]},${waypoints[j + 1].coord[1]}`;
				const wpEndIndexInPath = routeCoordToIndexMap.get(wpEndKey) ?? -1;

				if (wpStartIndexInPath !== -1 && wpEndIndexInPath !== -1 && i >= wpStartIndexInPath && i < wpEndIndexInPath) {
					insertIndex = j + 1;
					break;
				} else if (wpStartIndexInPath !== -1 && j === waypoints.length - 2 && i >= wpStartIndexInPath) {
					insertIndex = j + 1;
					break;
				}
			}
		}
	}

	if (minDistance > MAX_CLICK_DISTANCE_FROM_ROUTE_KM && waypoints.length >= 2) {
		return null;
	}

	const inserted: Waypoint = { coord: closestPointOnRoute, type: "routed" };
	const next: Waypoint[] = [...waypoints.slice(0, insertIndex), inserted, ...waypoints.slice(insertIndex)];
	return { waypoints: next, insertIndex };
}

export function setWaypointCoord(waypoints: Waypoint[], index: number, coord: Coordinate): Waypoint[] {
	return waypoints.map((wp, i) => (i === index ? { ...wp, coord } : wp));
}
