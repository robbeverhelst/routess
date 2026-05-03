import type { Coordinate, Waypoint, WaypointType } from "@routess/core";
import { pointToSegmentDistance } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import {
	clearKilometerMarkersLayer,
	clearRouteLayer,
	updateDragLinesLayer,
	updateUserLocationLayer,
	updateWaypointsLayer,
} from "@/features/routing/managers/MapLayerManager";
import { getRoute } from "@/features/routing/services/RouteCalculationService";
import { exportCurrentRouteToGPXFile, importRouteFromGPXString } from "@/features/routing/services/RouteIOService";
import { Logger } from "@/lib/logger";
import { useRoutingStore } from "@/stores/routingStore";

let _mapInstance: MapboxMap | null = null;
let _isMapLockedRef: { current: boolean } | null = null;
let _accessToken: string | null = null;

async function updateMapFromStore(
	map: MapboxMap,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
) {
	const { waypoints } = useRoutingStore.getState();

	clearRouteLayer(map);
	clearKilometerMarkersLayer(map);
	updateDragLinesLayer(map, []);

	updateWaypointsLayer(map, waypoints, _isMapLockedRef?.current ?? false);

	if (waypoints.length >= 2 && accessToken) {
		const result = await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);

		if (result.waypointsSnapped && result.snappedWaypoints) {
			Logger.debug("[Routing] Updating stored waypoints with snapped coordinates");
			useRoutingStore.getState().setWaypoints(result.snappedWaypoints);
			updateWaypointsLayer(map, result.snappedWaypoints, _isMapLockedRef?.current ?? false);
		}
	} else {
		setRouteDistance("");
		setRouteDuration("");
		setHasRoute(false);
		useRoutingStore.getState().clearRoutePath();
		useRoutingStore.getState().setRouteDistance("");
		useRoutingStore.getState().setRouteDuration("");
		useRoutingStore.getState().setHasRoute(false);
	}
}

export const addWaypoint = async (
	map: MapboxMap,
	coord: Coordinate,
	type: WaypointType,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
) => {
	Logger.debug("[Routing] Adding waypoint:", coord, "type:", type);
	useRoutingStore.getState().saveSnapshot();
	useRoutingStore.getState().addWaypoint(coord, type);
	await updateMapFromStore(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
	Logger.debug("[Routing] Waypoint added. Total:", useRoutingStore.getState().waypoints.length);
};

export const removeWaypoint = async (
	map: MapboxMap,
	index: number,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
) => {
	Logger.debug("[Routing] Removing waypoint at index:", index);
	useRoutingStore.getState().saveSnapshot();
	useRoutingStore.getState().removeWaypoint(index);
	await updateMapFromStore(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
	Logger.debug("[Routing] Waypoint removed. Remaining:", useRoutingStore.getState().waypoints.length);
};

export const resetRouting = async (
	map: MapboxMap,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
) => {
	Logger.info("[Routing] Resetting routing");
	useRoutingStore.getState().saveSnapshot();
	useRoutingStore.getState().clearWaypoints();
	await updateMapFromStore(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
	Logger.info("[Routing] Reset complete");
};

export const reverseRoute = async (
	map: MapboxMap,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
) => {
	const { waypoints } = useRoutingStore.getState();
	if (waypoints.length < 2) {
		Logger.info("[Routing] Not enough waypoints to reverse");
		return;
	}

	Logger.info("[Routing] Reversing route");
	useRoutingStore.getState().saveSnapshot();

	const reversedCoords = [...waypoints].reverse().map((wp) => wp.coord);
	const types = waypoints.map((wp) => wp.type);
	const reversedTypes = [...types.slice(1).reverse(), types[0]];
	const reversed: Waypoint[] = reversedCoords.map((coord, i) => ({ coord, type: reversedTypes[i] }));
	useRoutingStore.getState().setWaypoints(reversed);

	await updateMapFromStore(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
	Logger.info("[Routing] Route reversed");
};

export const undo = async (
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
) => {
	const { canUndo } = useRoutingStore.getState();
	if (!canUndo) {
		Logger.debug("[Routing] No undo available");
		return;
	}

	Logger.debug("[Routing] Undoing action");
	useRoutingStore.getState().undo();

	if (_mapInstance && _accessToken) {
		await updateMapFromStore(_mapInstance, _accessToken, setRouteDistance, setRouteDuration, setHasRoute);
	}

	Logger.debug("[Routing] Undo complete. Waypoints:", useRoutingStore.getState().waypoints.length);
};

export const redo = async (
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
) => {
	const { canRedo } = useRoutingStore.getState();
	if (!canRedo) {
		Logger.debug("[Routing] No redo available");
		return;
	}

	Logger.debug("[Routing] Redoing action");
	useRoutingStore.getState().redo();

	if (_mapInstance && _accessToken) {
		await updateMapFromStore(_mapInstance, _accessToken, setRouteDistance, setRouteDuration, setHasRoute);
	}

	Logger.debug("[Routing] Redo complete. Waypoints:", useRoutingStore.getState().waypoints.length);
};

export const setupRouting = (map: MapboxMap, isMapLockedRef: { current: boolean }, accessToken: string) => {
	_mapInstance = map;
	_isMapLockedRef = isMapLockedRef;
	_accessToken = accessToken;
	Logger.debug("[Routing] Setup complete with access token");
};

export const teardownRouting = () => {
	_mapInstance = null;
	_isMapLockedRef = null;
	_accessToken = null;
	Logger.debug("[Routing] Teardown complete");
};

export const insertWaypointAtLocation = async (
	map: MapboxMap,
	clickedCoords: Coordinate,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
	options?: { skipRouteCalcAndSnapshot?: boolean },
): Promise<{ success: boolean; newIndex?: number; error?: string }> => {
	Logger.debug("[Routing] Attempting to insert waypoint at:", clickedCoords);

	const { waypoints } = useRoutingStore.getState();

	if (waypoints.length < 1) {
		const errorMsg = "Cannot add waypoint: No existing route.";
		return { success: false, error: errorMsg };
	}

	let minDistance = Infinity;
	let insertIndex = waypoints.length;

	for (let i = 0; i < waypoints.length - 1; i++) {
		const start = waypoints[i].coord;
		const end = waypoints[i + 1].coord;
		const dist = pointToSegmentDistance(clickedCoords, start, end);

		if (dist < minDistance) {
			minDistance = dist;
			insertIndex = i + 1;
		}
	}

	const MAX_CLICK_DISTANCE_KM = 0.1;
	if (minDistance > MAX_CLICK_DISTANCE_KM && waypoints.length >= 2) {
		const errorMsg = "Click too far from route.";
		return { success: false, error: errorMsg };
	}

	if (!options?.skipRouteCalcAndSnapshot) {
		useRoutingStore.getState().saveSnapshot();
	}

	const newWaypoints: Waypoint[] = [
		...waypoints.slice(0, insertIndex),
		{ coord: clickedCoords, type: "routed" },
		...waypoints.slice(insertIndex),
	];

	useRoutingStore.getState().setWaypoints(newWaypoints);

	if (!options?.skipRouteCalcAndSnapshot) {
		await updateMapFromStore(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
	}

	Logger.debug("[Routing] Waypoint inserted at index:", insertIndex);
	return { success: true, newIndex: insertIndex };
};

export const updateWaypointPosition = async (
	map: MapboxMap,
	index: number,
	newCoord: Coordinate,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
): Promise<void> => {
	Logger.info("[Routing] Updating waypoint position at index:", index, "to:", newCoord);

	const { waypoints } = useRoutingStore.getState();

	if (index < 0 || index >= waypoints.length) {
		Logger.warn("[Routing] Invalid waypoint index:", index);
		return;
	}

	useRoutingStore.getState().saveSnapshot();

	const next = waypoints.map((wp, i) => (i === index ? { ...wp, coord: newCoord } : wp));
	useRoutingStore.getState().setWaypoints(next);

	await updateMapFromStore(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
	Logger.info("[Routing] Waypoint position updated");
};

export const updateUserLocationPoint = (map: MapboxMap, coordinates: Coordinate | null) => {
	updateUserLocationLayer(map, coordinates);
};

export const exportRouteToGPX = (): { success: boolean; message?: string } => {
	Logger.info("[Routing] GPX export requested");
	return exportCurrentRouteToGPXFile();
};

export const importRouteFromGPX = async (
	_gpxString: string,
	_map: MapboxMap,
	_accessToken: string,
	_setRouteDistance: Dispatch<SetStateAction<string>>,
	_setRouteDuration: Dispatch<SetStateAction<string>>,
	_setHasRoute: Dispatch<SetStateAction<boolean>>,
	onError?: (message: string) => void,
) => {
	Logger.info("[Routing] GPX import requested");
	const result = await importRouteFromGPXString({
		map: _map,
		accessToken: _accessToken,
		gpxString: _gpxString,
		setRouteDistance: _setRouteDistance,
		setRouteDuration: _setRouteDuration,
		setHasRoute: _setHasRoute,
	});

	if (!result.success && onError && result.message) {
		onError(result.message);
	}
};
