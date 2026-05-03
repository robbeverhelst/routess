import type { Coordinate, Waypoint, WaypointType } from "@routess/core";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import {
	insertWaypointOnRoute,
	resolveAddCoord,
	reverseWaypoints,
	setWaypointCoord,
} from "@/features/routing/managers/WaypointCoordinator";
import {
	clearCurrentRoutePath,
	getCurrentRoutePath,
	getRoute as getRouteFromService,
	type RouteResult,
} from "@/features/routing/services/RouteCalculationService";
import { checkNearRoad } from "@/features/routing/utils/RoutingUtils";
import { Logger } from "@/lib/logger";
import { useRoutingStore } from "@/stores/routingStore";

// Glue layer between the pure WaypointCoordinator decisions, the Zustand
// routing store, and route-calculation side effects. Map layers are kept
// in sync automatically by MapViewAdapter, so this module no longer
// touches them directly.

const getWaypoints = (): Waypoint[] => useRoutingStore.getState().waypoints;
const getWaypointCoords = (): Coordinate[] => getWaypoints().map((wp) => wp.coord);

const setWaypointsList = (waypoints: Waypoint[]) => {
	const current = useRoutingStore.getState().waypoints;
	if (waypoints.length === 0 && current.length > 0) {
		Logger.warn("[WaypointManager.setWaypointsList] Clearing existing waypoints. Current count:", current.length);
	}
	useRoutingStore.getState().setWaypoints(waypoints);
};

const clearComputedRouteUi = (
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
) => {
	setRouteDistance("");
	setRouteDuration("");
	setHasRoute(false);
	clearCurrentRoutePath();
};

// Recompute the route via the calculation service and apply any waypoint
// snapping the API returned. Returns the original RouteResult so callers
// can branch on success/failure.
const recomputeAndApplySnap = async (
	map: MapboxMap,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
): Promise<RouteResult> => {
	const result = await getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
	if (result.success && result.waypointsSnapped && result.snappedWaypoints) {
		setWaypointsList(result.snappedWaypoints);
	}
	return result;
};

export const addWaypoint = async (
	map: MapboxMap,
	coord: Coordinate,
	type: WaypointType,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
	handleWaypointError: (message: string | null) => void,
	_isMapLocked: boolean,
): Promise<boolean> => {
	const initialWaypointCount = getWaypoints().length;
	useRoutingStore.getState().saveSnapshot();

	const resolved = await resolveAddCoord(coord, type, initialWaypointCount === 0, accessToken);
	useRoutingStore.getState().addWaypoint(resolved.coord, resolved.type);

	if (getWaypoints().length === 1 && initialWaypointCount === 0 && type === "routed") {
		const first = getWaypoints()[0];
		const singleCheck = await checkNearRoad(first.coord, accessToken);
		if (singleCheck.isValid && singleCheck.snappedCoords) {
			setWaypointsList([{ coord: singleCheck.snappedCoords, type: "routed" }]);
			return true;
		}
		Logger.warn("[WaypointManager.addWaypoint] First routed waypoint failed checkNearRoad (49m). Rejecting.");
		handleWaypointError("Point is too far from any road or path.");
		useRoutingStore.getState().removeWaypoint(0);
		return false;
	}

	if (getWaypoints().length >= 2) {
		const routeResult = await recomputeAndApplySnap(
			map,
			accessToken,
			setRouteDistance,
			setRouteDuration,
			setHasRoute,
		);
		if (routeResult.success) return true;

		const last = getWaypoints().length - 1;
		const wasRawDueToFailure =
			resolved.checkNearRoadFailed &&
			last >= 0 &&
			getWaypoints()[last].coord[0] === coord[0] &&
			getWaypoints()[last].coord[1] === coord[1];

		if (wasRawDueToFailure) {
			handleWaypointError("Point is too far from any road for routing. Please click closer to a road or path.");
			useRoutingStore.getState().removeWaypoint(last);

			if (getWaypoints().length >= 2) {
				await recomputeAndApplySnap(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
			} else {
				clearComputedRouteUi(setRouteDistance, setRouteDuration, setHasRoute);
			}
			return false;
		}

		handleWaypointError(routeResult.error || "Could not calculate route.");
		return true;
	}

	if (getWaypoints().length === 1 && initialWaypointCount === 0 && type === "direct") {
		clearComputedRouteUi(setRouteDistance, setRouteDuration, setHasRoute);
		return true;
	}

	if (getWaypoints().length === 0 && initialWaypointCount === 0) {
		return false;
	}

	Logger.warn("[WaypointManager.addWaypoint] Unexpected end of flow. Count:", getWaypoints().length);
	return false;
};

export const removeWaypoint = async (
	map: MapboxMap,
	index: number,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
	handleWaypointError: (message: string | null) => void,
	_isMapLocked: boolean,
): Promise<void> => {
	if (index < 0 || index >= getWaypoints().length) {
		Logger.warn("[WaypointManager.removeWaypoint] Invalid index:", index);
		handleWaypointError("Invalid waypoint index. Waypoint may no longer exist.");
		return;
	}

	useRoutingStore.getState().saveSnapshot();
	useRoutingStore.getState().removeWaypoint(index);

	if (getWaypoints().length >= 2) {
		await recomputeAndApplySnap(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
	} else {
		clearComputedRouteUi(setRouteDistance, setRouteDuration, setHasRoute);
	}
	useRoutingStore.getState().saveSnapshot();
};

export const updateWaypointPositionAndRecalculate = async (
	map: MapboxMap,
	index: number,
	newCoord: Coordinate,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
	handleWaypointError: (message: string | null) => void,
	_isMapLocked: boolean,
): Promise<void> => {
	if (index < 0 || index >= getWaypoints().length) {
		Logger.warn("[WaypointManager.updateWaypointPosition] Invalid index:", index);
		handleWaypointError("Invalid waypoint index for update.");
		return;
	}

	const oldCoord = getWaypoints()[index].coord;
	let coordsToUpdate = newCoord;

	const roadCheck = await checkNearRoad(newCoord, accessToken);
	if (roadCheck.isValid && roadCheck.snappedCoords) {
		coordsToUpdate = roadCheck.snappedCoords;
	}

	setWaypointsList(setWaypointCoord(getWaypoints(), index, coordsToUpdate));

	const routeResult = await recomputeAndApplySnap(
		map,
		accessToken,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
	);

	if (routeResult.success) {
		useRoutingStore.getState().saveSnapshot();
		return;
	}

	handleWaypointError(routeResult.error || "Failed to calculate route. Waypoint may be too far from any road or path.");
	setWaypointsList(setWaypointCoord(getWaypoints(), index, oldCoord));
	useRoutingStore.getState().saveSnapshot();
};

export const reverseRoute = async (
	map: MapboxMap,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
	_isMapLocked: boolean,
): Promise<void> => {
	const current = getWaypoints();
	if (current.length < 2) return;

	setWaypointsList(reverseWaypoints(current));

	await recomputeAndApplySnap(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
	useRoutingStore.getState().saveSnapshot();
};

export const insertWaypointAtLocation = async (
	map: MapboxMap,
	clickedCoords: Coordinate,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
	handleWaypointError: (message: string | null) => void,
	_isMapLocked: boolean,
	options?: { skipRouteCalcAndSnapshot?: boolean },
): Promise<{ success: boolean; newIndex?: number; error?: string }> => {
	const currentWaypoints = getWaypoints();
	if (currentWaypoints.length < 1) {
		const errorMsg = "Cannot add waypoint: No existing route segment.";
		handleWaypointError(errorMsg);
		return { success: false, error: errorMsg };
	}

	const routeSource = map.getSource("route") as GeoJSONSource | undefined;
	const routeData = routeSource?._data as GeoJSON.Feature<GeoJSON.LineString> | undefined;
	const routePathToUse: Coordinate[] =
		routeData?.geometry?.coordinates && routeData.geometry.coordinates.length > 0
			? routeData.geometry.coordinates.map((p) => [p[0], p[1]] as Coordinate)
			: getCurrentRoutePath();

	if (routePathToUse.length < 2) {
		const errorMsg = "Cannot add waypoint: Route path is not defined or too short.";
		handleWaypointError(errorMsg);
		return { success: false, error: errorMsg };
	}

	const decision = insertWaypointOnRoute(currentWaypoints, routePathToUse, clickedCoords);
	if (!decision) {
		const errorMsg = "Cannot add waypoint: Click too far from route.";
		handleWaypointError(errorMsg);
		return { success: false, error: errorMsg };
	}

	setWaypointsList(decision.waypoints);

	if (options?.skipRouteCalcAndSnapshot) {
		return { success: true, newIndex: decision.insertIndex };
	}

	if (getWaypoints().length >= 2) {
		await recomputeAndApplySnap(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
	} else {
		clearComputedRouteUi(setRouteDistance, setRouteDuration, setHasRoute);
	}
	useRoutingStore.getState().saveSnapshot();

	return { success: true, newIndex: decision.insertIndex };
};

export { getWaypoints, getWaypointCoords };
