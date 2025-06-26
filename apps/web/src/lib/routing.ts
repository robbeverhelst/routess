/**
 * Main routing system
 */

import type { Dispatch, SetStateAction } from "react";
import type { Coordinate } from "@/types/map";
import type { Map as MapboxMap } from "mapbox-gl";
import { useRoutingStore } from "@/stores/routingStore";
import { Logger } from "@/lib/logger";
import {
  updateWaypointsLayer,
  updateRouteLayer,
  clearRouteLayer,
  updateUserLocationLayer,
} from "@/features/routing/managers/MapLayerManager";

// Global references for undo/redo
let _mapInstance: MapboxMap | null = null;
let _isMapLockedRef: { current: boolean } | null = null;
let _accessToken: string | null = null;

// Helper function for distance calculation
function haversineDistance(coords1: Coordinate, coords2: Coordinate): number {
  const R = 6371; // Earth's radius in kilometers
  const lat1 = coords1[1];
  const lon1 = coords1[0];
  const lat2 = coords2[1];
  const lon2 = coords2[0];

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    0.5 -
    Math.cos(dLat) / 2 +
    (Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * (1 - Math.cos(dLon))) /
      2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// Simple direct route calculation (fallback)
function calculateDirectRoute(waypoints: Coordinate[]): {
  routeCoords: Coordinate[];
  totalDistance: number;
  duration: number;
} {
  if (waypoints.length < 2) {
    return { routeCoords: [], totalDistance: 0, duration: 0 };
  }

  const routeCoords: Coordinate[] = [];
  let totalDistance = 0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];

    if (i === 0) routeCoords.push(from);
    routeCoords.push(to);

    totalDistance += haversineDistance(from, to);
  }

  const duration = Math.round((totalDistance / 5) * 60); // 5 km/h walking speed
  return { routeCoords, totalDistance, duration };
}

// Real route calculation using Mapbox Directions API
async function calculateRoadRoute(
  waypoints: Coordinate[],
  accessToken: string,
): Promise<{
  routeCoords: Coordinate[];
  totalDistance: number;
  duration: number;
  snappedWaypoints?: Coordinate[];
}> {
  if (waypoints.length < 2) {
    return { routeCoords: [], totalDistance: 0, duration: 0 };
  }

  try {
    const waypointsString = waypoints.map((point) => `${point[0]},${point[1]}`).join(";");
    const radiusesString = waypoints.map(() => "150").join(";");

    const queryUrl =
      `https://api.mapbox.com/directions/v5/mapbox/walking/${waypointsString}?` +
      `steps=true&geometries=geojson&overview=full&continue_straight=true&` +
      `access_token=${accessToken}&radiuses=${radiusesString}`;

    const response = await fetch(queryUrl, { method: "GET" });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const json = await response.json();
    if (!json || !json.routes || json.routes.length === 0 || !json.routes[0].geometry) {
      throw new Error("Invalid API response or no route geometry");
    }

    const data = json.routes[0];
    const routeCoords = data.geometry.coordinates;
    const totalDistance = data.distance / 1000; // Convert to km
    const duration = Math.round(data.duration / 60); // Convert to minutes

    // Extract snapped waypoints from the response
    let snappedWaypoints: Coordinate[] | undefined;
    if (json.waypoints && json.waypoints.length > 0) {
      snappedWaypoints = json.waypoints.map(
        (wp: any) => [wp.location[0], wp.location[1]] as Coordinate,
      );
      Logger.debug("[Routing] Waypoints snapped by Directions API");
    }

    Logger.debug("[Routing] Road route calculated:", totalDistance.toFixed(2), "km");
    return { routeCoords, totalDistance, duration, snappedWaypoints };
  } catch (error) {
    Logger.warn("[Routing] Road routing failed, falling back to direct route:", error);
    return calculateDirectRoute(waypoints);
  }
}

// Update map with current store state
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
    // Calculate and display road route
    const { routeCoords, totalDistance, duration, snappedWaypoints } = await calculateRoadRoute(
      waypoints,
      accessToken,
    );
    updateRouteLayer(map, routeCoords);

    // Persist route path to Zustand store for page refresh persistence
    useRoutingStore.getState().setRoutePath(routeCoords);

    // Update waypoints with snapped coordinates if available
    if (snappedWaypoints && snappedWaypoints.length === waypoints.length) {
      Logger.debug("[Routing] Updating stored waypoints with snapped coordinates");
      useRoutingStore.getState().updateWaypoints(snappedWaypoints);
      // Update waypoints layer with snapped coordinates
      updateWaypointsLayer(map, snappedWaypoints, _isMapLockedRef?.current ?? false);
    }

    // Update UI
    setRouteDistance(`${totalDistance.toFixed(2)} km`);
    setRouteDuration(`${duration} min`);
    setHasRoute(true);

    // Update store route info
    useRoutingStore.getState().setRouteDistance(`${totalDistance.toFixed(2)} km`);
    useRoutingStore.getState().setRouteDuration(`${duration} min`);
    useRoutingStore.getState().setHasRoute(true);
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

  Logger.debug(
    "[Routing] Waypoint removed. Remaining:",
    useRoutingStore.getState().waypoints.length,
  );
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
    await updateMapFromStore(
      _mapInstance,
      _accessToken,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
    );
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
    await updateMapFromStore(
      _mapInstance,
      _accessToken,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
    );
  }

  Logger.debug("[Routing] Redo complete. Waypoints:", useRoutingStore.getState().waypoints.length);
};

// Setup function to store map reference
export const setupRouting = (
  map: MapboxMap,
  isMapLockedRef: { current: boolean },
  accessToken: string,
) => {
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

// Helper function to calculate distance from point to line segment
function pointToSegmentDistance(point: Coordinate, start: Coordinate, end: Coordinate): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];

  if (dx === 0 && dy === 0) {
    // Start and end are the same point
    return haversineDistance(point, start);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / (dx * dx + dy * dy)),
  );
  const projection: Coordinate = [start[0] + t * dx, start[1] + t * dy];

  return haversineDistance(point, projection);
}
