/**
 * Main routing system
 */

import type { Coordinate } from "@maps/core";
import { pointToSegmentDistance } from "@maps/core";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import {
	clearRouteLayer,
	updateUserLocationLayer,
	updateWaypointsLayer,
} from "@/features/routing/managers/MapLayerManager";
import { getCurrentRoutePath, getRoute } from "@/features/routing/services/RouteCalculationService";
import { Logger } from "@/lib/logger";
import { useRoutingStore } from "@/stores/routingStore";

// Global references for undo/redo
let _mapInstance: MapboxMap | null = null;
let _isMapLockedRef: { current: boolean } | null = null;
let _accessToken: string | null = null;

// Note: haversineDistance is now imported from shared geospatial utils

// Update map with current store state using RouteCalculationService
async function updateMapFromStore(
	map: MapboxMap,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
) {
	const { waypoints } = useRoutingStore.getState();

	// Update waypoints on map
	updateWaypointsLayer(map, waypoints, _isMapLockedRef?.current ?? false);

	if (waypoints.length >= 2 && accessToken) {
		// Use RouteCalculationService for comprehensive route calculation
		const result = await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);

		// Handle waypoint snapping if available
		if (result.waypointsSnapped && result.snappedWaypoints) {
			Logger.debug("[Routing] Updating stored waypoints with snapped coordinates");
			useRoutingStore.getState().updateWaypoints(result.snappedWaypoints);

			if (result.snappedDirectFlags) {
				useRoutingStore.getState().updateDirectFlags(result.snappedDirectFlags);
			}

			// Update waypoints layer with snapped coordinates
			updateWaypointsLayer(map, result.snappedWaypoints, _isMapLockedRef?.current ?? false);
		}
	} else {
		// Clear route
		clearRouteLayer(map);
		setRouteDistance("");
		setRouteDuration("");
		setHasRoute(false);

		// Clear route path in Zustand store
		useRoutingStore.getState().clearRoutePath();

		// Update store route info
		useRoutingStore.getState().setRouteDistance("");
		useRoutingStore.getState().setRouteDuration("");
		useRoutingStore.getState().setHasRoute(false);
	}
}

// === ROUTING FUNCTIONS ===

export const addWaypoint = async (
	map: MapboxMap,
	coords: Coordinate,
	isDirect: boolean,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
) => {
	Logger.debug("[Routing] Adding waypoint:", coords, "isDirect:", isDirect);

	// Take snapshot before action
	useRoutingStore.getState().saveSnapshot();

	// Add waypoint to store with original coordinates
	// Let the Directions API handle snapping for consistency
	useRoutingStore.getState().addWaypoint(coords, isDirect);

	// Update map - this will trigger route calculation which handles snapping
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

	// Take snapshot before action
	useRoutingStore.getState().saveSnapshot();

	// Remove waypoint from store
	useRoutingStore.getState().removeWaypoint(index);

	// Update map
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

	// Take snapshot before clearing
	useRoutingStore.getState().saveSnapshot();

	// Clear waypoints
	useRoutingStore.getState().clearWaypoints();

	// Update map
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
	const { waypoints, directFlags } = useRoutingStore.getState();

	if (waypoints.length < 2) {
		Logger.info("[Routing] Not enough waypoints to reverse");
		return;
	}

	Logger.info("[Routing] Reversing route");

	// Take snapshot before action
	useRoutingStore.getState().saveSnapshot();

	// Reverse waypoints and directFlags
	const reversedWaypoints = [...waypoints].reverse();
	const reversedDirectFlags = [...directFlags].reverse();

	// Update store with reversed data
	useRoutingStore.getState().updateWaypoints(reversedWaypoints);
	useRoutingStore.getState().updateDirectFlags(reversedDirectFlags);

	// Update map
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

	// Undo in store
	useRoutingStore.getState().undo();

	// Update map if available
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

	// Redo in store
	useRoutingStore.getState().redo();

	// Update map if available
	if (_mapInstance && _accessToken) {
		await updateMapFromStore(_mapInstance, _accessToken, setRouteDistance, setRouteDuration, setHasRoute);
	}

	Logger.debug("[Routing] Redo complete. Waypoints:", useRoutingStore.getState().waypoints.length);
};

// Setup function to store map reference
export const setupRouting = (map: MapboxMap, isMapLockedRef: { current: boolean }, accessToken: string) => {
	_mapInstance = map;
	_isMapLockedRef = isMapLockedRef;
	_accessToken = accessToken;
	Logger.debug("[Routing] Setup complete with access token");
};

// Teardown function to clean up routing
export const teardownRouting = () => {
	_mapInstance = null;
	_isMapLockedRef = null;
	_accessToken = null;
	Logger.debug("[Routing] Teardown complete");
};

// === ADDITIONAL FUNCTIONS ===

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

	// For simplicity, find the closest segment and insert there
	let minDistance = Infinity;
	let insertIndex = waypoints.length;

	// Find closest segment
	for (let i = 0; i < waypoints.length - 1; i++) {
		const start = waypoints[i];
		const end = waypoints[i + 1];
		const dist = pointToSegmentDistance(clickedCoords, start, end);

		if (dist < minDistance) {
			minDistance = dist;
			insertIndex = i + 1;
		}
	}

	// Check if click is reasonably close to route
	const MAX_CLICK_DISTANCE_KM = 0.1;
	if (minDistance > MAX_CLICK_DISTANCE_KM && waypoints.length >= 2) {
		const errorMsg = "Click too far from route.";
		return { success: false, error: errorMsg };
	}

	if (!options?.skipRouteCalcAndSnapshot) {
		// Take snapshot before action
		useRoutingStore.getState().saveSnapshot();
	}

	// Insert waypoint at the calculated index
	const newWaypoints = [...waypoints];
	const newDirectFlags = [...useRoutingStore.getState().directFlags];

	newWaypoints.splice(insertIndex, 0, clickedCoords);
	newDirectFlags.splice(insertIndex, 0, false);

	// Update store
	useRoutingStore.getState().setWaypoints(newWaypoints, newDirectFlags);

	if (!options?.skipRouteCalcAndSnapshot) {
		// Update map
		await updateMapFromStore(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
	}

	Logger.debug("[Routing] Waypoint inserted at index:", insertIndex);
	return { success: true, newIndex: insertIndex };
};

export const updateWaypointPosition = async (
	map: MapboxMap,
	index: number,
	newCoords: Coordinate,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
): Promise<void> => {
	Logger.info("[Routing] Updating waypoint position at index:", index, "to:", newCoords);

	const { waypoints } = useRoutingStore.getState();

	if (index < 0 || index >= waypoints.length) {
		Logger.warn("[Routing] Invalid waypoint index:", index);
		return;
	}

	// Take snapshot before action
	useRoutingStore.getState().saveSnapshot();

	// Update waypoint position
	const newWaypoints = [...waypoints];
	newWaypoints[index] = newCoords;

	useRoutingStore.getState().updateWaypoints(newWaypoints);

	// Update map - this will handle snapping via Directions API
	await updateMapFromStore(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);

	Logger.info("[Routing] Waypoint position updated");
};

// Function to update user location on the map
export const updateUserLocationPoint = (map: MapboxMap, coordinates: Coordinate | null) => {
	updateUserLocationLayer(map, coordinates);
};

// GPX Export function
export const exportRouteToGPX = (): { success: boolean; message?: string } => {
	Logger.info("[Routing] GPX export requested");
	const routePath = getCurrentRoutePath();
	if (routePath.length === 0) {
		return { success: false, message: "No route available to export." };
	}
	return { success: false, message: "GPX export functionality is not yet implemented." };
};

// GPX Import function
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
	if (onError) {
		onError("GPX import functionality is not yet implemented.");
	}
};

// Note: pointToSegmentDistance is now imported from shared geospatial utils
