import type { Coordinate } from '@/types/map';
import { checkNearRoad } from '@/features/routing/utils/RoutingUtils'; // Import new checkNearRoad
import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
import type { Dispatch, SetStateAction } from 'react';
import { getRoute as getRouteFromService, clearCurrentRoutePath, type RouteResult } from '@/features/routing/services/RouteCalculationService';
import { updateWaypointsLayer, clearRouteLayer, clearKilometerMarkersLayer } from '@/features/routing/managers/MapLayerManager';
import { saveWaypointsToLocalStorage } from '@/features/routing/services/LocalStorageService';
import { snapshot } from '@/features/routing/managers/HistoryManager';
import { closestPointOnSegment, haversine } from '@/features/routing/utils/RoutingUtils';
import { getCurrentRoutePath } from '@/features/routing/services/RouteCalculationService';

// Store references and state outside of the setup function to persist across renders
let waypoints: Coordinate[] = [];
let directFlags: boolean[] = []; // parallel to waypoints, true if waypoint is direct

const reinitializeWaypointState = () => {
  waypoints = [];
  directFlags = [];
  console.log('[WaypointManager.ts] Module state explicitly re-initialized.');
};

reinitializeWaypointState(); // Initial call

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[WaypointManager.ts] HMR disposing old instance.');
    // State will be reset by the new instance's reinitializeWaypointState() via accept or top-level call
  });
  import.meta.hot.accept(() => {
    console.log('[WaypointManager.ts] HMR accept: Forcing state re-initialization.');
    reinitializeWaypointState();
  });
}

export const _addWaypointInternal = async (
  coords: Coordinate,
  isDirect: boolean,
  accessToken: string
): Promise<{ success: boolean; snappedCoords?: Coordinate; error?: string }> => {
  if (isDirect || waypoints.length === 0) {
    waypoints.push(coords);
    directFlags.push(isDirect);
    console.log('[_addWaypointInternal] Added direct/initial waypoint:', coords);
    return { success: true, snappedCoords: coords };
  }

  // For regular (non-direct) waypoints, check if it's near a road
  const roadCheck = await checkNearRoad(coords, accessToken); // Use new checkNearRoad

  if (!roadCheck.isValid) {
    const errorMsg = "This location is too far from a road. Try placing it closer to a road or use direct waypoints.";
    console.warn('[_addWaypointInternal] Waypoint rejected - not near a road', coords);
    return { success: false, error: errorMsg };
  }

  // Point is valid, use snapped coordinates if available
  const finalCoords = roadCheck.snappedCoords || coords;
  waypoints.push(finalCoords);
  directFlags.push(isDirect); // isDirect is false here due to the initial check
  console.log('[_addWaypointInternal] Added waypoint near road:', finalCoords);
  return { success: true, snappedCoords: finalCoords };
};

// Export the waypoints and directFlags for external components to use
export const getWaypoints = () => waypoints;
export const getDirectFlags = () => directFlags; // Added export for directFlags

export const setWaypointsAndFlags = (newWaypoints: Coordinate[], newDirectFlags: boolean[]) => {
  if (newWaypoints.length === 0 && waypoints.length > 0) { // Log only when clearing existing waypoints
    console.warn('[WaypointManager.setWaypointsAndFlags] Clearing existing waypoints. Current count:', waypoints.length, 'Call stack:');
    console.trace();
  }
  waypoints = newWaypoints;
  directFlags = newDirectFlags;
  console.log('[WaypointManager] Waypoints and flags set. Count:', waypoints.length);
};

export const _removeWaypointInternal = (index: number): void => {
  if (index < 0 || index >= waypoints.length) {
    console.warn('[_removeWaypointInternal] Invalid index:', index);
    return;
  }
  waypoints.splice(index, 1);
  directFlags.splice(index, 1);
  console.log('[_removeWaypointInternal] Waypoint removed at index:', index, 'New waypoints:', waypoints);
};

export const _updateWaypointPositionInternal = (index: number, newCoords: Coordinate): void => {
  if (index < 0 || index >= waypoints.length) {
    console.warn('[_updateWaypointPositionInternal] Invalid index:', index);
    return;
  }
  waypoints[index] = newCoords;
  console.log('[_updateWaypointPositionInternal] Waypoint updated at index:', index, 'to:', newCoords, 'New waypoints:', waypoints);
};

export const addWaypoint = async (
  map: MapboxMap,
  coords: Coordinate,
  isDirect: boolean,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  onError?: (message: string) => void
): Promise<boolean> => {
  snapshot(); // Snapshot for undo/redo

  const addResult = await _addWaypointInternal(coords, isDirect, accessToken);

  if (!addResult.success) {
    if (onError && addResult.error) onError(addResult.error);
    return false;
  }

  // Successfully added waypoint
  updateWaypointsLayer(map, getWaypoints());
  saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());

  if (getWaypoints().length >= 2) {
    console.log('[WaypointManager.addWaypoint] Recalculating route...');
    const routeResult: RouteResult = await getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
    // If route calculation snapped waypoints further, update them in WaypointManager
    if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
        console.log("[WaypointManager.addWaypoint] Route service snapped waypoints. Updating WaypointManager state.");
        setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
        updateWaypointsLayer(map, getWaypoints()); // Re-update layer with snapped waypoints
        saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags()); // Save snapped waypoints
    }
  } else if (getWaypoints().length === 1) {
    // Only one waypoint, clear any existing route visualization
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
    clearCurrentRoutePath(); // From RouteCalculationService
    clearRouteLayer(map); // From MapLayerManager
    clearKilometerMarkersLayer(map); // From MapLayerManager
  }
  return true;
};

export const removeWaypoint = async (
  map: MapboxMap,
  index: number,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  onError?: (message: string) => void
): Promise<void> => {
  if (index < 0 || index >= getWaypoints().length) {
    console.warn('[WaypointManager.removeWaypoint] Invalid index:', index);
    if (onError) {
      onError("Invalid waypoint index. Waypoint may no longer exist.");
    }
    return;
  }

  snapshot(); // Snapshot for undo/redo
  _removeWaypointInternal(index); // Use the internal function
  updateWaypointsLayer(map, getWaypoints());
  saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());

  if (getWaypoints().length >= 2) {
    console.log('[WaypointManager.removeWaypoint] Recalculating route...');
    const routeResult: RouteResult = await getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
    if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
        console.log("[WaypointManager.removeWaypoint] Route service snapped waypoints. Updating WaypointManager state.");
        setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
        updateWaypointsLayer(map, getWaypoints());
        saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());
    }
  } else {
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
    clearCurrentRoutePath();
    clearRouteLayer(map);
    clearKilometerMarkersLayer(map);
    // if (getWaypoints().length === 0) { // Also clear history if all waypoints removed
    //     // clearHistory(); // Assuming clearHistory is available from HistoryManager
    // }
  }
  console.log('[WaypointManager.removeWaypoint] Waypoint removed and route updated.');
};

export const updateWaypointPositionAndRecalculate = async (
  map: MapboxMap,
  index: number,
  newCoords: Coordinate,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  onError?: (message: string) => void
): Promise<void> => {
  console.log(`[WaypointManager.updateWaypointPositionAndRecalculate] Called for index: ${index}, newCoords:`, newCoords);
  if (index < 0 || index >= getWaypoints().length) {
    console.warn('[WaypointManager.updateWaypointPosition] Invalid index:', index);
    if (onError) onError("Invalid waypoint index for update.");
    return;
  }

  snapshot(); // Snapshot for undo/redo

  const oldCoords = getWaypoints()[index];
  _updateWaypointPositionInternal(index, newCoords);

  updateWaypointsLayer(map, getWaypoints());
  saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());

  console.log(`[WaypointManager.updateWaypointPosition] Waypoint ${index} moved from ${JSON.stringify(oldCoords)} to ${JSON.stringify(newCoords)}. Recalculating route.`);
  const routeResult: RouteResult = await getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
  
  if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
    console.log("[WaypointManager.updateWaypointPosition] Route service snapped waypoints. Updating WaypointManager state.");
    setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
    updateWaypointsLayer(map, getWaypoints());
    saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());
  } else if (!routeResult.success && getWaypoints().length >= 2) {
    console.warn(`[WaypointManager.updateWaypointPosition] Route recalculation failed after moving waypoint ${index}.`);
    if (onError) onError("Route recalculation failed after moving waypoint.");
  }
};

export const reverseRoute = async (
  map: MapboxMap,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
): Promise<void> => {
  const currentWaypoints = getWaypoints();
  if (currentWaypoints.length < 2) {
    console.log('[WaypointManager.reverseRoute] Not enough waypoints to reverse.');
    return;
  }

  snapshot(); // Snapshot for undo/redo

  const reversedWaypoints = [...currentWaypoints].reverse();
  const reversedDirectFlags = [...getDirectFlags()].reverse();

  setWaypointsAndFlags(reversedWaypoints, reversedDirectFlags);
  updateWaypointsLayer(map, getWaypoints()); // getWaypoints() will now return the reversed ones
  saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());

  console.log('[WaypointManager.reverseRoute] Route reversed. Recalculating route.');
  const routeResult: RouteResult = await getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);

  if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
    console.log("[WaypointManager.reverseRoute] Route service snapped waypoints after reverse. Updating WaypointManager state.");
    setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
    updateWaypointsLayer(map, getWaypoints());
    saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());
  }
  console.log('[WaypointManager.reverseRoute] Reverse complete, route updated.');
};

export const insertWaypointAtLocation = async (
  map: MapboxMap,
  clickedCoords: Coordinate,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  onError?: (message: string) => void
): Promise<{ success: boolean; newIndex?: number; error?: string }> => {
  console.log('[WaypointManager.insertWaypoint] Attempting to insert waypoint at:', clickedCoords);

  const currentWaypoints = getWaypoints();
  if (currentWaypoints.length < 1) { 
    console.warn('[WaypointManager.insertWaypoint] Not enough waypoints to define a route segment.');
    const errorMsg = "Cannot add waypoint: No existing route segment.";
    if (onError) onError(errorMsg);
    return { success: false, error: errorMsg };
  }

  const currentRoutePath = getCurrentRoutePath();
  let routePathToUse: Coordinate[];
  const routeSource = map.getSource('route') as GeoJSONSource | undefined;
  const routeData = routeSource?._data as GeoJSON.Feature<GeoJSON.LineString> | undefined;

  if (routeData?.geometry?.coordinates && routeData.geometry.coordinates.length > 0) {
    routePathToUse = routeData.geometry.coordinates.map(p => [p[0], p[1]] as Coordinate);
  } else {
    routePathToUse = currentRoutePath; // currentRoutePath is Coordinate[], so routePathToUse is always Coordinate[]
  }
  
  if (routePathToUse.length < 2) {
    console.warn('[WaypointManager.insertWaypoint] Route path is too short (less than 2 points).');
    const errorMsg = "Cannot add waypoint: Route path is not defined or too short.";
    if (onError) onError(errorMsg);
    return { success: false, error: errorMsg };
  }

  let minDistance = Infinity;
  let closestPointOnRoute: Coordinate = clickedCoords;
  let insertIndex = getWaypoints().length;

  // Create a map for O(1) lookup of route path coordinates to their indices
  const routeCoordToIndexMap = new Map<string, number>();
  for (let idx = 0; idx < routePathToUse.length; idx++) {
    const coord = routePathToUse[idx];
    routeCoordToIndexMap.set(`${coord[0]},${coord[1]}`, idx);
  }

  for (let i = 0; i < routePathToUse.length - 1; i++) {
    const start = routePathToUse[i];
    const end = routePathToUse[i + 1];
    const pointOnSegment = closestPointOnSegment(clickedCoords, start, end);
    const distanceToSegmentPoint = haversine(clickedCoords, pointOnSegment);

    if (distanceToSegmentPoint < minDistance) {
      minDistance = distanceToSegmentPoint;
      closestPointOnRoute = pointOnSegment;

      const currentWps = getWaypoints();
      for (let j = 0; j < currentWps.length - 1; j++) {
        let wpStartIndexInPath = -1;
        let wpEndIndexInPath = -1;

        // Use the map for O(1) lookup
        const wpStartKey = `${currentWps[j][0]},${currentWps[j][1]}`;
        wpStartIndexInPath = routeCoordToIndexMap.get(wpStartKey) ?? -1;

        const wpEndKey = `${currentWps[j+1][0]},${currentWps[j+1][1]}`;
        wpEndIndexInPath = routeCoordToIndexMap.get(wpEndKey) ?? -1;
        
        if (wpStartIndexInPath !== -1 && wpEndIndexInPath !== -1 && i >= wpStartIndexInPath && i < wpEndIndexInPath) {
          insertIndex = j + 1;
          break; 
        } else if (wpStartIndexInPath !== -1 && j === currentWps.length - 2 && i >= wpStartIndexInPath) {
          insertIndex = j + 1;
          break;
        }
      }
    }
  }

  const MAX_CLICK_DISTANCE_FROM_ROUTE_KM = 0.1;
  if (minDistance > MAX_CLICK_DISTANCE_FROM_ROUTE_KM && getWaypoints().length >= 2) {
    console.warn(`[WaypointManager.insertWaypoint] Click was too far from the route path. Distance: ${minDistance.toFixed(3)}km`);
    const errorMsg = "Cannot add waypoint: Click too far from route.";
    if (onError) onError(errorMsg);
    return { success: false, error: errorMsg };
  }

  console.log('[WaypointManager.insertWaypoint] Closest point on route:', closestPointOnRoute, 'Insert index:', insertIndex);

  snapshot(); // Take snapshot before modifying waypoints and flags

  // Create new arrays immutably
  // currentWaypoints was already fetched at the start of the function if (currentWaypoints.length < 1)
  const newWaypointsArray = [
    ...currentWaypoints.slice(0, insertIndex),
    closestPointOnRoute, // This is the new waypoint to insert
    ...currentWaypoints.slice(insertIndex)
  ];

  const currentDirectFlags = getDirectFlags(); // Fetch current direct flags
  const newDirectFlagsArray = [
    ...currentDirectFlags.slice(0, insertIndex),
    false, // This is the direct flag for the new waypoint
    ...currentDirectFlags.slice(insertIndex)
  ];
  
  setWaypointsAndFlags(newWaypointsArray, newDirectFlagsArray);

  // Update map layers, save to local storage, and recalculate route
  updateWaypointsLayer(map, getWaypoints()); // getWaypoints() will now return the new array
  saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());

  if (getWaypoints().length >= 2) {
    const routeResult: RouteResult = await getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
    if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
        setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
        updateWaypointsLayer(map, getWaypoints());
        saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());
    }
  } else {
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
    clearCurrentRoutePath();
    clearRouteLayer(map);
    clearKilometerMarkersLayer(map);
  }
  console.log('[WaypointManager.insertWaypoint] Waypoint inserted and route recalculated.');
  return { success: true, newIndex: insertIndex };
};

// TODO: Consider how to handle dependencies like map, accessToken, state setters, and other services. 