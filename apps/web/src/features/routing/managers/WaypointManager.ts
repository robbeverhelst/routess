import type { Coordinate, Waypoint, WaypointType } from "@routess/core";
import { haversineDistance } from "@routess/core";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import {
	clearKilometerMarkersLayer,
	clearRouteLayer,
	updateWaypointsLayer,
} from "@/features/routing/managers/MapLayerManager";
import { saveWaypointsToLocalStorage } from "@/features/routing/services/LocalStorageService";
import {
	clearCurrentRoutePath,
	getCurrentRoutePath,
	getRoute as getRouteFromService,
	type RouteResult,
} from "@/features/routing/services/RouteCalculationService";
import { checkNearRoad, closestPointOnSegment } from "@/features/routing/utils/RoutingUtils";
import { Logger } from "@/lib/logger";
import { useRoutingStore } from "@/stores/routingStore";

const getWaypoints = (): Waypoint[] => useRoutingStore.getState().waypoints;
const getWaypointCoords = (): Coordinate[] => getWaypoints().map((wp) => wp.coord);

const setWaypointsList = (waypoints: Waypoint[]) => {
	const current = useRoutingStore.getState().waypoints;
	if (waypoints.length === 0 && current.length > 0) {
		Logger.warn("[WaypointManager.setWaypointsList] Clearing existing waypoints. Current count:", current.length);
	}
	useRoutingStore.getState().setWaypoints(waypoints);
	Logger.info("[WaypointManager] Waypoints set. Count:", waypoints.length);
};

const _addWaypointInternal = async (
	coord: Coordinate,
	type: WaypointType,
	accessToken: string,
): Promise<{
	success: boolean;
	snappedCoord?: Coordinate;
	error?: string;
	checkNearRoadFailed?: boolean;
}> => {
	const store = useRoutingStore.getState();

	if (type === "direct" || store.waypoints.length === 0) {
		store.addWaypoint(coord, type);
		Logger.info("[_addWaypointInternal] Added direct/initial waypoint (raw):", coord);
		return { success: true, snappedCoord: coord, checkNearRoadFailed: false };
	}

	const roadCheck = await checkNearRoad(coord, accessToken);

	if (roadCheck.isValid && roadCheck.snappedCoords) {
		store.addWaypoint(roadCheck.snappedCoords, "routed");
		Logger.info("[_addWaypointInternal] Added waypoint via checkNearRoad (49m snap):", roadCheck.snappedCoords);
		return { success: true, snappedCoord: roadCheck.snappedCoords, checkNearRoadFailed: false };
	}

	store.addWaypoint(coord, "routed");
	Logger.info("[_addWaypointInternal] checkNearRoad failed. Added waypoint raw for now:", coord);
	return { success: true, snappedCoord: coord, checkNearRoadFailed: true };
};

const _removeWaypointInternal = (index: number): void => {
	const store = useRoutingStore.getState();
	if (index < 0 || index >= store.waypoints.length) {
		Logger.warn("[_removeWaypointInternal] Invalid index:", index);
		return;
	}
	store.removeWaypoint(index);
};

const _updateWaypointPositionInternal = (index: number, newCoord: Coordinate): void => {
	const store = useRoutingStore.getState();
	if (index < 0 || index >= store.waypoints.length) {
		Logger.warn("[_updateWaypointPositionInternal] Invalid index:", index);
		return;
	}
	const next = store.waypoints.map((wp, i) => (i === index ? { ...wp, coord: newCoord } : wp));
	store.setWaypoints(next);
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
	isMapLocked: boolean,
): Promise<boolean> => {
	const initialWaypointCount = getWaypoints().length;

	useRoutingStore.getState().saveSnapshot();

	const addResult = await _addWaypointInternal(coord, type, accessToken);

	if (getWaypoints().length === 1 && initialWaypointCount === 0 && type === "routed") {
		Logger.info(
			"[WaypointManager.addWaypoint] First routed waypoint. Attempting immediate 49m snap via checkNearRoad...",
		);
		const currentFirst = getWaypoints()[0];
		const singleCheck = await checkNearRoad(currentFirst.coord, accessToken);

		if (singleCheck.isValid && singleCheck.snappedCoords) {
			Logger.info("[WaypointManager.addWaypoint] First routed waypoint snapped by checkNearRoad (49m). Updating.");
			setWaypointsList([{ coord: singleCheck.snappedCoords, type: "routed" }]);
			updateWaypointsLayer(map, getWaypoints(), isMapLocked);
			saveWaypointsToLocalStorage(getWaypoints());
			return true;
		}

		Logger.warn("[WaypointManager.addWaypoint] First routed waypoint failed checkNearRoad (49m). Rejecting.");
		if (handleWaypointError) handleWaypointError("Point is too far from any road or path.");
		_removeWaypointInternal(0);
		updateWaypointsLayer(map, getWaypoints(), isMapLocked);
		saveWaypointsToLocalStorage(getWaypoints());
		return false;
	}

	updateWaypointsLayer(map, getWaypoints(), isMapLocked);
	saveWaypointsToLocalStorage(getWaypoints());

	if (getWaypoints().length >= 2) {
		Logger.info("[WaypointManager.addWaypoint] Recalculating route for 2+ waypoints...");
		const routeResult: RouteResult = await getRouteFromService(
			map,
			accessToken,
			setRouteDistance,
			setRouteDuration,
			setHasRoute,
		);

		if (routeResult.success) {
			if (routeResult.waypointsSnapped && routeResult.snappedWaypoints) {
				setWaypointsList(routeResult.snappedWaypoints);
				updateWaypointsLayer(map, getWaypoints(), isMapLocked);
			}
			saveWaypointsToLocalStorage(getWaypoints());
			return true;
		}

		Logger.warn("[WaypointManager.addWaypoint] getRouteFromService failed for 2+ waypoints.");
		const currentWaypoints = getWaypoints();
		const indexOfLast = currentWaypoints.length - 1;
		const lastAddedRawDueToFailure =
			addResult.checkNearRoadFailed &&
			indexOfLast >= 0 &&
			currentWaypoints[indexOfLast].coord[0] === coord[0] &&
			currentWaypoints[indexOfLast].coord[1] === coord[1];

		if (lastAddedRawDueToFailure) {
			Logger.warn(
				"[WaypointManager.addWaypoint] Route calculation failed AND the last added waypoint was raw (>49m). Removing it.",
			);
			if (handleWaypointError)
				handleWaypointError("Point is too far from any road for routing. Please click closer to a road or path.");

			_removeWaypointInternal(indexOfLast);
			updateWaypointsLayer(map, getWaypoints(), isMapLocked);

			if (getWaypoints().length >= 2) {
				Logger.info("[WaypointManager.addWaypoint] Retrying route calculation after removing bad point...");
				const retryResult: RouteResult = await getRouteFromService(
					map,
					accessToken,
					setRouteDistance,
					setRouteDuration,
					setHasRoute,
				);
				if (retryResult.success && retryResult.waypointsSnapped && retryResult.snappedWaypoints) {
					setWaypointsList(retryResult.snappedWaypoints);
					updateWaypointsLayer(map, getWaypoints(), isMapLocked);
				}
			} else {
				clearCurrentRoutePath();
				clearRouteLayer(map);
				clearKilometerMarkersLayer(map);
				setRouteDistance("");
				setRouteDuration("");
				setHasRoute(false);
			}
			saveWaypointsToLocalStorage(getWaypoints());
			return false;
		}

		Logger.warn("[WaypointManager.addWaypoint] Route calculation failed for other reasons.");
		if (handleWaypointError) handleWaypointError(routeResult.error || "Could not calculate route.");
		saveWaypointsToLocalStorage(getWaypoints());
		return true;
	}

	if (getWaypoints().length === 1 && initialWaypointCount === 0 && type === "direct") {
		Logger.info("[WaypointManager.addWaypoint] First waypoint added (direct). No immediate snap/route.");
		setRouteDistance("");
		setRouteDuration("");
		setHasRoute(false);
		clearCurrentRoutePath();
		clearRouteLayer(map);
		clearKilometerMarkersLayer(map);
		saveWaypointsToLocalStorage(getWaypoints());
		return true;
	}

	if (getWaypoints().length === 0 && initialWaypointCount === 0) {
		Logger.info("[WaypointManager.addWaypoint] No waypoints remain after add attempt.");
		return false;
	}

	Logger.warn(
		"[WaypointManager.addWaypoint] Reached unexpected end of function logic. Waypoint count:",
		getWaypoints().length,
		"Initial count:",
		initialWaypointCount,
		"Type:",
		type,
	);
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
	isMapLocked: boolean,
): Promise<void> => {
	if (index < 0 || index >= getWaypoints().length) {
		Logger.warn("[WaypointManager.removeWaypoint] Invalid index:", index);
		if (handleWaypointError) handleWaypointError("Invalid waypoint index. Waypoint may no longer exist.");
		return;
	}

	useRoutingStore.getState().saveSnapshot();
	_removeWaypointInternal(index);
	updateWaypointsLayer(map, getWaypoints(), isMapLocked);
	saveWaypointsToLocalStorage(getWaypoints());

	if (getWaypoints().length >= 2) {
		Logger.info("[WaypointManager.removeWaypoint] Recalculating route...");
		const routeResult: RouteResult = await getRouteFromService(
			map,
			accessToken,
			setRouteDistance,
			setRouteDuration,
			setHasRoute,
		);
		if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints) {
			setWaypointsList(routeResult.snappedWaypoints);
			updateWaypointsLayer(map, getWaypoints(), isMapLocked);
			saveWaypointsToLocalStorage(getWaypoints());
		}
		useRoutingStore.getState().saveSnapshot();
	} else {
		setRouteDistance("");
		setRouteDuration("");
		setHasRoute(false);
		clearCurrentRoutePath();
		clearRouteLayer(map);
		clearKilometerMarkersLayer(map);
		useRoutingStore.getState().saveSnapshot();
	}
	Logger.info("[WaypointManager.removeWaypoint] Waypoint removed and route updated.");
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
	isMapLocked: boolean,
): Promise<void> => {
	Logger.info(`[WaypointManager.updateWaypointPositionAndRecalculate] Called for index: ${index}, newCoord:`, newCoord);

	if (index < 0 || index >= getWaypoints().length) {
		Logger.warn("[WaypointManager.updateWaypointPosition] Invalid index:", index);
		if (handleWaypointError) handleWaypointError("Invalid waypoint index for update.");
		return;
	}

	const oldCoord = getWaypoints()[index].coord;
	let coordsToUpdate = newCoord;

	const roadCheck = await checkNearRoad(newCoord, accessToken);
	if (roadCheck.isValid && roadCheck.snappedCoords) {
		Logger.info("[WaypointManager.updateWaypointPositionAndRecalculate] checkNearRoad (49m) succeeded.");
		coordsToUpdate = roadCheck.snappedCoords;
	}

	_updateWaypointPositionInternal(index, coordsToUpdate);
	updateWaypointsLayer(map, getWaypoints(), isMapLocked);

	const routeRecalcResult: RouteResult = await getRouteFromService(
		map,
		accessToken,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
	);

	if (routeRecalcResult.success) {
		if (routeRecalcResult.waypointsSnapped && routeRecalcResult.snappedWaypoints) {
			Logger.info("[WaypointManager.updateWaypointPositionAndRecalculate] Directions API snapped waypoints.");
			setWaypointsList(routeRecalcResult.snappedWaypoints);
			updateWaypointsLayer(map, getWaypoints(), isMapLocked);
		}
		saveWaypointsToLocalStorage(getWaypoints());
		useRoutingStore.getState().saveSnapshot();
	} else {
		Logger.warn("[WaypointManager.updateWaypointPositionAndRecalculate] Directions API recalculation failed.");
		if (handleWaypointError)
			handleWaypointError(
				routeRecalcResult.error || "Failed to calculate route. Waypoint may be too far from any road or path.",
			);

		_updateWaypointPositionInternal(index, oldCoord);
		updateWaypointsLayer(map, getWaypoints(), isMapLocked);
		saveWaypointsToLocalStorage(getWaypoints());
		useRoutingStore.getState().saveSnapshot();
	}
};

export const reverseRoute = async (
	map: MapboxMap,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
	isMapLocked: boolean,
): Promise<void> => {
	const current = getWaypoints();
	if (current.length < 2) {
		Logger.info("[WaypointManager.reverseRoute] Not enough waypoints to reverse.");
		return;
	}

	// Reverse coords; rotate types so the segment-leading-to-each-waypoint semantics survive.
	const reversedCoords = [...current].reverse().map((wp) => wp.coord);
	const types = current.map((wp) => wp.type);
	const reversedTypes = [...types.slice(1).reverse(), types[0]];
	const reversedWaypoints: Waypoint[] = reversedCoords.map((coord, i) => ({ coord, type: reversedTypes[i] }));

	setWaypointsList(reversedWaypoints);
	updateWaypointsLayer(map, getWaypoints(), isMapLocked);
	saveWaypointsToLocalStorage(getWaypoints());

	Logger.info("[WaypointManager.reverseRoute] Route reversed. Recalculating route.");
	const routeResult: RouteResult = await getRouteFromService(
		map,
		accessToken,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
	);

	if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints) {
		setWaypointsList(routeResult.snappedWaypoints);
		updateWaypointsLayer(map, getWaypoints(), isMapLocked);
		saveWaypointsToLocalStorage(getWaypoints());
	}
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
	isMapLocked: boolean,
	options?: { skipRouteCalcAndSnapshot?: boolean },
): Promise<{ success: boolean; newIndex?: number; error?: string }> => {
	Logger.info("[WaypointManager.insertWaypoint] Attempting to insert waypoint at:", clickedCoords);

	const currentWaypoints = getWaypoints();
	if (currentWaypoints.length < 1) {
		const errorMsg = "Cannot add waypoint: No existing route segment.";
		if (handleWaypointError) handleWaypointError(errorMsg);
		return { success: false, error: errorMsg };
	}

	const currentRoutePath = getCurrentRoutePath();
	let routePathToUse: Coordinate[];
	const routeSource = map.getSource("route") as GeoJSONSource | undefined;
	const routeData = routeSource?._data as GeoJSON.Feature<GeoJSON.LineString> | undefined;

	if (routeData?.geometry?.coordinates && routeData.geometry.coordinates.length > 0) {
		routePathToUse = routeData.geometry.coordinates.map((p) => [p[0], p[1]] as Coordinate);
	} else {
		routePathToUse = currentRoutePath;
	}

	if (routePathToUse.length < 2) {
		const errorMsg = "Cannot add waypoint: Route path is not defined or too short.";
		if (handleWaypointError) handleWaypointError(errorMsg);
		return { success: false, error: errorMsg };
	}

	let minDistance = Infinity;
	let closestPointOnRoute: Coordinate = clickedCoords;
	let insertIndex = currentWaypoints.length;

	const routeCoordToIndexMap = new Map<string, number>();
	for (let idx = 0; idx < routePathToUse.length; idx++) {
		const c = routePathToUse[idx];
		routeCoordToIndexMap.set(`${c[0]},${c[1]}`, idx);
	}

	for (let i = 0; i < routePathToUse.length - 1; i++) {
		const start = routePathToUse[i];
		const end = routePathToUse[i + 1];
		const pointOnSegment = closestPointOnSegment(clickedCoords, start, end);
		const distanceToSegmentPoint = haversineDistance(clickedCoords, pointOnSegment);

		if (distanceToSegmentPoint < minDistance) {
			minDistance = distanceToSegmentPoint;
			closestPointOnRoute = pointOnSegment;

			const wps = getWaypoints();
			for (let j = 0; j < wps.length - 1; j++) {
				const wpStartKey = `${wps[j].coord[0]},${wps[j].coord[1]}`;
				const wpStartIndexInPath = routeCoordToIndexMap.get(wpStartKey) ?? -1;
				const wpEndKey = `${wps[j + 1].coord[0]},${wps[j + 1].coord[1]}`;
				const wpEndIndexInPath = routeCoordToIndexMap.get(wpEndKey) ?? -1;

				if (wpStartIndexInPath !== -1 && wpEndIndexInPath !== -1 && i >= wpStartIndexInPath && i < wpEndIndexInPath) {
					insertIndex = j + 1;
					break;
				} else if (wpStartIndexInPath !== -1 && j === wps.length - 2 && i >= wpStartIndexInPath) {
					insertIndex = j + 1;
					break;
				}
			}
		}
	}

	const MAX_CLICK_DISTANCE_FROM_ROUTE_KM = 0.1;
	if (minDistance > MAX_CLICK_DISTANCE_FROM_ROUTE_KM && currentWaypoints.length >= 2) {
		const errorMsg = "Cannot add waypoint: Click too far from route.";
		if (handleWaypointError) handleWaypointError(errorMsg);
		return { success: false, error: errorMsg };
	}

	const newWaypoint: Waypoint = { coord: closestPointOnRoute, type: "routed" };
	const newWaypoints: Waypoint[] = [
		...currentWaypoints.slice(0, insertIndex),
		newWaypoint,
		...currentWaypoints.slice(insertIndex),
	];

	setWaypointsList(newWaypoints);

	updateWaypointsLayer(map, getWaypoints(), isMapLocked);
	saveWaypointsToLocalStorage(getWaypoints());

	if (options?.skipRouteCalcAndSnapshot) {
		return { success: true, newIndex: insertIndex };
	}

	if (getWaypoints().length >= 2) {
		const routeResult: RouteResult = await getRouteFromService(
			map,
			accessToken,
			setRouteDistance,
			setRouteDuration,
			setHasRoute,
		);
		if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints) {
			setWaypointsList(routeResult.snappedWaypoints);
			updateWaypointsLayer(map, getWaypoints(), isMapLocked);
			saveWaypointsToLocalStorage(getWaypoints());
		}
		useRoutingStore.getState().saveSnapshot();
	} else {
		setRouteDistance("");
		setRouteDuration("");
		setHasRoute(false);
		clearCurrentRoutePath();
		clearRouteLayer(map);
		clearKilometerMarkersLayer(map);
		useRoutingStore.getState().saveSnapshot();
	}

	return { success: true, newIndex: insertIndex };
};

export { getWaypoints, getWaypointCoords };
