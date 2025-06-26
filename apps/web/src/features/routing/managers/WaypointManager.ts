import type { Coordinate } from "@/types/map";
import { checkNearRoad } from "@/features/routing/utils/RoutingUtils"; // RESTORED: For Option C
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import {
  getRoute as getRouteFromService,
  clearCurrentRoutePath,
  type RouteResult,
} from "@/features/routing/services/RouteCalculationService";
import {
  updateWaypointsLayer,
  clearRouteLayer,
  clearKilometerMarkersLayer,
} from "@/features/routing/managers/MapLayerManager";
import { saveWaypointsToLocalStorage } from "@/features/routing/services/LocalStorageService";
import { closestPointOnSegment } from "@/features/routing/utils/RoutingUtils";
import { haversineDistance } from "@/lib/utils/geospatial";
import { getCurrentRoutePath } from "@/features/routing/services/RouteCalculationService";
import { useRoutingStore } from "@/stores/routingStore";
import { Logger } from "@/lib/logger";

// REMOVED: No more module-level state - Zustand store is the single source of truth

export const _addWaypointInternal = async (
  coords: Coordinate,
  isDirect: boolean,
  accessToken: string,
): Promise<{
  success: boolean;
  snappedCoords?: Coordinate;
  error?: string;
  checkNearRoadFailed?: boolean;
}> => {
  const store = useRoutingStore.getState();

  if (isDirect || store.waypoints.length === 0) {
    // Update Zustand store directly
    store.addWaypoint(coords, isDirect);

    Logger.info("[_addWaypointInternal] Added direct/initial waypoint (raw):", coords);
    return { success: true, snappedCoords: coords, checkNearRoadFailed: false };
  }

  // For subsequent non-direct waypoints, first try checkNearRoad (49m)
  const roadCheck = await checkNearRoad(coords, accessToken);

  if (roadCheck.isValid && roadCheck.snappedCoords) {
    // checkNearRoad succeeded (within 49m)
    store.addWaypoint(roadCheck.snappedCoords, false);

    Logger.info(
      "[_addWaypointInternal] Added waypoint via checkNearRoad (49m snap):",
      roadCheck.snappedCoords,
    );
    return { success: true, snappedCoords: roadCheck.snappedCoords, checkNearRoadFailed: false };
  } else {
    // checkNearRoad failed (e.g., >49m or other error from Matching API)
    // Add the raw coordinates for now. The main addWaypoint will try getRouteFromService.
    store.addWaypoint(coords, false);

    Logger.info("[_addWaypointInternal] checkNearRoad failed. Added waypoint raw for now:", coords);
    return { success: true, snappedCoords: coords, checkNearRoadFailed: true };
  }
};

// Export the waypoints and directFlags for external components to use
export const getWaypoints = () => useRoutingStore.getState().waypoints;
export const getDirectFlags = () => useRoutingStore.getState().directFlags;

export const setWaypointsAndFlags = (newWaypoints: Coordinate[], newDirectFlags: boolean[]) => {
  const currentWaypoints = useRoutingStore.getState().waypoints;
  if (newWaypoints.length === 0 && currentWaypoints.length > 0) {
    // Log only when clearing existing waypoints
    Logger.warn(
      "[WaypointManager.setWaypointsAndFlags] Clearing existing waypoints. Current count:",
      currentWaypoints.length,
    );
  }

  // Update Zustand store directly - it's the single source of truth
  useRoutingStore.getState().setWaypoints(newWaypoints, newDirectFlags);

  Logger.info("[WaypointManager] Waypoints and flags set. Count:", newWaypoints.length);
};

export const _removeWaypointInternal = (index: number): void => {
  const store = useRoutingStore.getState();
  if (index < 0 || index >= store.waypoints.length) {
    Logger.warn("[_removeWaypointInternal] Invalid index:", index);
    return;
  }

  // Remove from Zustand store directly
  store.removeWaypoint(index);

  Logger.info(
    "[_removeWaypointInternal] Waypoint removed at index:",
    index,
    "New waypoints:",
    store.waypoints,
  );
};

export const _updateWaypointPositionInternal = (index: number, newCoords: Coordinate): void => {
  const store = useRoutingStore.getState();
  if (index < 0 || index >= store.waypoints.length) {
    Logger.warn("[_updateWaypointPositionInternal] Invalid index:", index);
    return;
  }

  // Update in Zustand store directly
  const newWaypoints = [...store.waypoints];
  newWaypoints[index] = newCoords;
  store.setWaypoints(newWaypoints, store.directFlags);

  Logger.info(
    "[_updateWaypointPositionInternal] Waypoint updated at index:",
    index,
    "to:",
    newCoords,
    "New waypoints:",
    newWaypoints,
  );
};

export const addWaypoint = async (
  map: MapboxMap,
  coords: Coordinate, // This is the raw input coordinate
  isDirect: boolean,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  handleWaypointError: (message: string | null) => void,
  isMapLocked: boolean,
): Promise<boolean> => {
  const initialWaypointCount = getWaypoints().length; // Waypoints before this add operation

  // Save snapshot BEFORE adding waypoint (so we can undo to the state before this addition)
  useRoutingStore.getState().saveSnapshot();

  const addResult = await _addWaypointInternal(coords, isDirect, accessToken);
  // addResult.snappedCoords contains the coordinate that _addWaypointInternal actually pushed.
  // addResult.checkNearRoadFailed is true if a *subsequent* point was added raw because checkNearRoad (49m) failed.

  if (getWaypoints().length === 1 && initialWaypointCount === 0 && !isDirect) {
    // This is the VERY FIRST waypoint being added, AND it's meant to be a routed point.
    // _addWaypointInternal added it raw. Let's try to snap it immediately with checkNearRoad.
    Logger.info(
      "[WaypointManager.addWaypoint] First non-direct waypoint. Attempting immediate 49m snap via checkNearRoad...",
    );
    const currentFirstPoint = getWaypoints()[0]; // This is the raw point
    const singlePointRoadCheck = await checkNearRoad(currentFirstPoint, accessToken);

    if (singlePointRoadCheck.isValid && singlePointRoadCheck.snappedCoords) {
      Logger.info(
        "[WaypointManager.addWaypoint] First non-direct waypoint snapped by checkNearRoad (49m). Updating.",
      );
      setWaypointsAndFlags([singlePointRoadCheck.snappedCoords], [false]); // Update the single waypoint
      updateWaypointsLayer(map, getWaypoints(), isMapLocked);
      saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());
      return true;
    } else {
      Logger.warn(
        "[WaypointManager.addWaypoint] First non-direct waypoint failed checkNearRoad (49m). Rejecting.",
      );
      if (handleWaypointError) handleWaypointError("Point is too far from any road or path.");

      _removeWaypointInternal(0); // Remove the raw point that was provisionally added
      updateWaypointsLayer(map, getWaypoints(), isMapLocked); // Should be empty now
      saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags()); // Save empty
      return false; // Indicate failure to add this point
    }
  }

  // For all other cases (second point onwards, or first point was direct and thus already handled if !isDirect was false)
  updateWaypointsLayer(map, getWaypoints(), isMapLocked); // Show point added by _addWaypointInternal
  saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags()); // Provisional save

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
      if (
        routeResult.waypointsSnapped &&
        routeResult.snappedWaypoints &&
        routeResult.snappedDirectFlags
      ) {
        Logger.info(
          "[WaypointManager.addWaypoint] Directions API snapped waypoints. Updating state.",
        );
        setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
        updateWaypointsLayer(map, getWaypoints(), isMapLocked);
      }
      saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags()); // Final save
      return true;
    } else {
      // getRouteFromService FAILED for 2+ waypoints
      Logger.warn("[WaypointManager.addWaypoint] getRouteFromService failed for 2+ waypoints.");
      const currentWaypoints = getWaypoints();
      const indexOfLastAddedPoint = currentWaypoints.length - 1;

      const lastAddedPointWasRawDueToCheckNearRoadFailure =
        addResult.checkNearRoadFailed &&
        indexOfLastAddedPoint >= 0 &&
        currentWaypoints[indexOfLastAddedPoint][0] === coords[0] &&
        currentWaypoints[indexOfLastAddedPoint][1] === coords[1];

      if (lastAddedPointWasRawDueToCheckNearRoadFailure) {
        Logger.warn(
          "[WaypointManager.addWaypoint] Route calculation failed AND the last added waypoint was raw (>49m). Removing it.",
        );
        if (handleWaypointError)
          handleWaypointError(
            "Point is too far from any road for routing. Please click closer to a road or path.",
          );

        _removeWaypointInternal(indexOfLastAddedPoint);
        updateWaypointsLayer(map, getWaypoints(), isMapLocked);

        if (getWaypoints().length >= 2) {
          Logger.info(
            "[WaypointManager.addWaypoint] Retrying route calculation with remaining waypoints after removing bad point...",
          );
          const retryRouteResult: RouteResult = await getRouteFromService(
            map,
            accessToken,
            setRouteDistance,
            setRouteDuration,
            setHasRoute,
          );
          if (
            retryRouteResult.success &&
            retryRouteResult.waypointsSnapped &&
            retryRouteResult.snappedWaypoints &&
            retryRouteResult.snappedDirectFlags
          ) {
            setWaypointsAndFlags(
              retryRouteResult.snappedWaypoints,
              retryRouteResult.snappedDirectFlags,
            );
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
        saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());
        return false;
      } else {
        Logger.warn(
          "[WaypointManager.addWaypoint] Route calculation failed for other reasons (e.g. disconnected network, or a previous point was too far).",
        );
        if (handleWaypointError)
          handleWaypointError(routeResult.error || "Could not calculate route.");
        // Point added by _addWaypointInternal remains. If it was a first point that was raw, it stays raw.
        // If it was a subsequent point that passed checkNearRoad, it stays (49m-snapped).
        saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());
        return true;
      }
    }
  } else if (getWaypoints().length === 1 && initialWaypointCount === 0 && isDirect) {
    // This handles: First waypoint added, AND it IS direct.
    // _addWaypointInternal already added it raw. No immediate snap check needed for direct.
    Logger.info(
      "[WaypointManager.addWaypoint] First waypoint added (direct). No immediate snap/route.",
    );
    setRouteDistance("");
    setRouteDuration("");
    setHasRoute(false);
    clearCurrentRoutePath();
    clearRouteLayer(map);
    clearKilometerMarkersLayer(map);
    saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());
    return true;
  }

  // This path should ideally not be reached if the first point was non-direct, as it's handled above.
  // If initialWaypointCount was >=1, it goes to the length >= 2 block.
  // If waypoints.length became 0 somehow (e.g. _removeWaypointInternal called unexpectedly), it might fall through.
  if (getWaypoints().length === 0 && initialWaypointCount === 0) {
    // This case means a first, non-direct point was attempted, failed checkNearRoad, and was removed.
    // The function already returned false in that block.
    // This is more of a safeguard or for clarity if other paths lead to 0 waypoints.
    Logger.info(
      "[WaypointManager.addWaypoint] No waypoints remain after add attempt (likely first non-direct point rejected).",
    );
    return false; // Explicitly return false if ended up with 0 waypoints and it was an add attempt.
  }

  Logger.warn(
    "[WaypointManager.addWaypoint] Reached unexpected end of function logic. Waypoint count:",
    getWaypoints().length,
    "Initial count:",
    initialWaypointCount,
    "IsDirect:",
    isDirect,
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
    if (handleWaypointError) {
      handleWaypointError("Invalid waypoint index. Waypoint may no longer exist.");
    }
    return;
  }

  // Save snapshot before removing waypoint (captures state before removal)
  useRoutingStore.getState().saveSnapshot();
  _removeWaypointInternal(index); // Use the internal function
  updateWaypointsLayer(map, getWaypoints(), isMapLocked);
  saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());

  const currentWaypointsCount = getWaypoints().length;
  if (currentWaypointsCount >= 2) {
    Logger.info("[WaypointManager.removeWaypoint] Recalculating route...");
    const routeResult: RouteResult = await getRouteFromService(
      map,
      accessToken,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
    );
    if (
      routeResult.success &&
      routeResult.waypointsSnapped &&
      routeResult.snappedWaypoints &&
      routeResult.snappedDirectFlags
    ) {
      Logger.info(
        "[WaypointManager.removeWaypoint] Route service snapped waypoints. Updating WaypointManager state.",
      );
      setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
      updateWaypointsLayer(map, getWaypoints(), isMapLocked);
      saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());
      // The snapshot below covers this state change.
    }
    // Snapshot after route calculation and potential snapping is complete.
    useRoutingStore.getState().saveSnapshot();
  } else {
    // 0 or 1 waypoint remaining
    setRouteDistance("");
    setRouteDuration("");
    setHasRoute(false);
    clearCurrentRoutePath();
    clearRouteLayer(map);
    clearKilometerMarkersLayer(map);
    // Snapshot because the removal leading to 0 or 1 waypoint is a completed, undoable action.
    useRoutingStore.getState().saveSnapshot();
  }
  Logger.info("[WaypointManager.removeWaypoint] Waypoint removed and route updated.");
};

export const updateWaypointPositionAndRecalculate = async (
  map: MapboxMap,
  index: number,
  newCoords: Coordinate, // This is the raw drop coordinate
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  handleWaypointError: (message: string | null) => void,
  isMapLocked: boolean,
): Promise<void> => {
  Logger.info(
    `[WaypointManager.updateWaypointPositionAndRecalculate] Called for index: ${index}, newCoords:`,
    newCoords,
  );
  if (index < 0 || index >= getWaypoints().length) {
    Logger.warn("[WaypointManager.updateWaypointPosition] Invalid index:", index);
    if (handleWaypointError) handleWaypointError("Invalid waypoint index for update.");
    return;
  }

  const oldCoordForThisWaypoint = getWaypoints()[index]; // Store for potential revert
  let coordsToUpdate = newCoords; // Start with raw coords

  // Attempt pre-validation with checkNearRoad (49m)
  const roadCheck = await checkNearRoad(newCoords, accessToken);
  if (roadCheck.isValid && roadCheck.snappedCoords) {
    Logger.info(
      "[WaypointManager.updateWaypointPositionAndRecalculate] checkNearRoad (49m) succeeded. Using its snapped point initially.",
    );
    coordsToUpdate = roadCheck.snappedCoords;
  } else {
    Logger.info(
      "[WaypointManager.updateWaypointPositionAndRecalculate] checkNearRoad (49m) failed or no snap. Using raw coords for now.",
    );
    // coordsToUpdate remains newCoords (raw)
  }

  // Update the waypoint position internally with either 49m-snapped or raw coordinates
  _updateWaypointPositionInternal(index, coordsToUpdate);
  updateWaypointsLayer(map, getWaypoints(), isMapLocked); // Show this initial position

  // Now, try to calculate the route with getRouteFromService.
  // This will use the Directions API, which has its own, more lenient snapping.
  const routeRecalcResult: RouteResult = await getRouteFromService(
    map,
    accessToken,
    setRouteDistance,
    setRouteDuration,
    setHasRoute,
  );

  if (routeRecalcResult.success) {
    // Route calculation successful
    if (
      routeRecalcResult.waypointsSnapped &&
      routeRecalcResult.snappedWaypoints &&
      routeRecalcResult.snappedDirectFlags
    ) {
      Logger.info(
        "[WaypointManager.updateWaypointPositionAndRecalculate] Directions API snapped waypoints. Updating WaypointManager state.",
      );
      setWaypointsAndFlags(
        routeRecalcResult.snappedWaypoints,
        routeRecalcResult.snappedDirectFlags,
      );
      updateWaypointsLayer(map, getWaypoints(), isMapLocked); // Update layer with final API snapped points
    } else {
      // Directions API calculated a route but didn't further snap the points beyond what we gave it
      // (which was either 49m-snapped or raw if checkNearRoad failed).
      Logger.info(
        "[WaypointManager.updateWaypointPositionAndRecalculate] Directions API successful, no *further* snapping occurred.",
      );
      // The waypoints are already what they should be from _updateWaypointPositionInternal.
    }
    saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());
    useRoutingStore.getState().saveSnapshot();
  } else {
    // Route recalculation by Directions API failed
    Logger.warn(
      "[WaypointManager.updateWaypointPositionAndRecalculate] Directions API route recalculation failed.",
    );
    // At this point, checkNearRoad might have failed OR succeeded.
    // If checkNearRoad succeeded, coordsToUpdate is the 49m-snapped point.
    // If checkNearRoad failed, coordsToUpdate is the raw newCoords.
    // Since Directions API failed, neither the raw nor the 49m-snapped point worked for a route.
    // Revert to the original pre-drag position.
    if (handleWaypointError)
      handleWaypointError(
        routeRecalcResult.error ||
          "Failed to calculate route. Waypoint may be too far from any road or path.",
      );

    _updateWaypointPositionInternal(index, oldCoordForThisWaypoint); // Revert to original
    updateWaypointsLayer(map, getWaypoints(), isMapLocked);

    saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());
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
  const currentWaypoints = getWaypoints();
  if (currentWaypoints.length < 2) {
    Logger.info("[WaypointManager.reverseRoute] Not enough waypoints to reverse.");
    return;
  }

  // snapshot(); // REMOVED: Initial snapshot

  const reversedWaypoints = [...currentWaypoints].reverse();
  const reversedDirectFlags = [
    ...[...getDirectFlags()].reverse().slice(1),
    getDirectFlags()[0], // last segment becomes first after reverse
  ];

  setWaypointsAndFlags(reversedWaypoints, reversedDirectFlags);
  updateWaypointsLayer(map, getWaypoints(), isMapLocked);
  saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());

  Logger.info("[WaypointManager.reverseRoute] Route reversed. Recalculating route.");
  const routeResult: RouteResult = await getRouteFromService(
    map,
    accessToken,
    setRouteDistance,
    setRouteDuration,
    setHasRoute,
  );

  if (
    routeResult.success &&
    routeResult.waypointsSnapped &&
    routeResult.snappedWaypoints &&
    routeResult.snappedDirectFlags
  ) {
    Logger.info(
      "[WaypointManager.reverseRoute] Route service snapped waypoints after reverse. Updating WaypointManager state.",
    );
    setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
    updateWaypointsLayer(map, getWaypoints(), isMapLocked);
    saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());
    // The snapshot below covers this state change.
  }
  // Snapshot after route calculation and potential snapping is complete.
  useRoutingStore.getState().saveSnapshot();
  Logger.info("[WaypointManager.reverseRoute] Reverse complete, route updated.");
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
  Logger.info(
    "[WaypointManager.insertWaypoint] Attempting to insert waypoint at:",
    clickedCoords,
    "Options:",
    options,
  );

  const currentWaypoints = getWaypoints();
  if (currentWaypoints.length < 1) {
    Logger.warn("[WaypointManager.insertWaypoint] Not enough waypoints to define a route segment.");
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
    routePathToUse = currentRoutePath; // currentRoutePath is Coordinate[], so routePathToUse is always Coordinate[]
  }

  if (routePathToUse.length < 2) {
    Logger.warn("[WaypointManager.insertWaypoint] Route path is too short (less than 2 points).");
    const errorMsg = "Cannot add waypoint: Route path is not defined or too short.";
    if (handleWaypointError) handleWaypointError(errorMsg);
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
    const distanceToSegmentPoint = haversineDistance(clickedCoords, pointOnSegment);

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

        const wpEndKey = `${currentWps[j + 1][0]},${currentWps[j + 1][1]}`;
        wpEndIndexInPath = routeCoordToIndexMap.get(wpEndKey) ?? -1;

        if (
          wpStartIndexInPath !== -1 &&
          wpEndIndexInPath !== -1 &&
          i >= wpStartIndexInPath &&
          i < wpEndIndexInPath
        ) {
          insertIndex = j + 1;
          break;
        } else if (
          wpStartIndexInPath !== -1 &&
          j === currentWps.length - 2 &&
          i >= wpStartIndexInPath
        ) {
          insertIndex = j + 1;
          break;
        }
      }
    }
  }

  const MAX_CLICK_DISTANCE_FROM_ROUTE_KM = 0.1;
  if (minDistance > MAX_CLICK_DISTANCE_FROM_ROUTE_KM && getWaypoints().length >= 2) {
    Logger.warn(
      `[WaypointManager.insertWaypoint] Click was too far from the route path. Distance: ${minDistance.toFixed(3)}km`,
    );
    const errorMsg = "Cannot add waypoint: Click too far from route.";
    if (handleWaypointError) handleWaypointError(errorMsg);
    return { success: false, error: errorMsg };
  }

  Logger.info(
    "[WaypointManager.insertWaypoint] Closest point on route:",
    closestPointOnRoute,
    "Insert index:",
    insertIndex,
  );

  // snapshot(); // REMOVED: Initial snapshot. Snapshot will be taken after async operations and potential snapping.

  // Create new arrays immutably
  // currentWaypoints was already fetched at the start of the function if (currentWaypoints.length < 1)
  const newWaypointsArray = [
    ...currentWaypoints.slice(0, insertIndex),
    closestPointOnRoute, // This is the new waypoint to insert
    ...currentWaypoints.slice(insertIndex),
  ];

  const currentDirectFlags = getDirectFlags(); // Fetch current direct flags
  const newDirectFlagsArray = [
    ...currentDirectFlags.slice(0, insertIndex),
    false, // This is the direct flag for the new waypoint
    ...currentDirectFlags.slice(insertIndex),
  ];

  setWaypointsAndFlags(newWaypointsArray, newDirectFlagsArray);

  // Update map layers, save to local storage, and recalculate route
  updateWaypointsLayer(map, getWaypoints(), isMapLocked); // getWaypoints() will now return the new array
  saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());

  // Conditionally skip route calculation and snapshot
  if (options?.skipRouteCalcAndSnapshot) {
    Logger.info(
      "[WaypointManager.insertWaypoint] Skipping route calculation and snapshot as per options.",
    );
    // Still need to return success and index for the MapInteractionManager to start dragging
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
    if (
      routeResult.success &&
      routeResult.waypointsSnapped &&
      routeResult.snappedWaypoints &&
      routeResult.snappedDirectFlags
    ) {
      setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
      updateWaypointsLayer(map, getWaypoints(), isMapLocked);
      saveWaypointsToLocalStorage(getWaypoints(), getDirectFlags());
      // The snapshot below covers this state change.
    }
    // Snapshot after route calculation and potential snapping is complete.
    useRoutingStore.getState().saveSnapshot();
  } else {
    // This case (0 or 1 waypoint after insert) should ideally not happen if we start with >= 1 waypoint.
    // However, if it does, or if the logic changes, ensure a snapshot is taken for the completed action.
    setRouteDistance("");
    setRouteDuration("");
    setHasRoute(false);
    clearCurrentRoutePath();
    clearRouteLayer(map);
    clearKilometerMarkersLayer(map);
    useRoutingStore.getState().saveSnapshot(); // Snapshot for completed action even if no route calculation
  }
  Logger.info(
    "[WaypointManager.insertWaypoint] Waypoint inserted and route recalculated (or skipped).",
  );
  return { success: true, newIndex: insertIndex };
};
