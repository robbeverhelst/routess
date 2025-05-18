import type { Dispatch, SetStateAction } from 'react';
import type { Coordinate } from '@/types/map';
import type { Map as MapboxMap } from 'mapbox-gl';

// Import from WaypointManager
import { 
    getWaypoints, 
    getDirectFlags, 
    setWaypointsAndFlags, 
    addWaypoint as addWaypointFromManager,
    removeWaypoint as removeWaypointFromManager,
    updateWaypointPositionAndRecalculate as updateWaypointPositionAndRecalculateFromManager,
    reverseRoute as reverseRouteFromManager,
    insertWaypointAtLocation as insertWaypointAtLocationFromManager
} from '@/features/routing/managers/WaypointManager';
// Import from HistoryManager
import { snapshot, clearHistory, stepBack as stepBackFromHistoryManager, stepForward as stepForwardFromHistoryManager } from '@/features/routing/managers/HistoryManager';

// Import the new service
import { saveWaypointsToLocalStorage as saveWaypointsToStorage, loadWaypointsFromLocalStorage as loadWaypointsFromStorageService } from '@/features/routing/services/LocalStorageService';

// Import the new GPX service functions
import { generateGPXString, parseGPXFile, processGPXWaypoints } from '@/features/routing/services/GPXService';

// Import the new MapInteractionManager function
import { initializeMapInteractions, type PopupInfo as MIMPopupInfo } from '@/features/routing/managers/MapInteractionManager';

// Import the RouteCalculationService and its result type
import { getRoute as getRouteFromService, getCurrentRoutePath, clearCurrentRoutePath, type RouteResult } from '@/features/routing/services/RouteCalculationService';

// Import from MapLayerManager
import {
  initializeSourcesAndLayers,
  updateWaypointsLayer,
  updateUserLocationLayer,
  clearRouteLayer,
  clearKilometerMarkersLayer
} from '@/features/routing/managers/MapLayerManager';

// Local PopupInfo type for setupRouting signature, aliased from MapInteractionManager
type PopupInfo = MIMPopupInfo; // Use the imported type

// Function to load waypoints from local storage - This function in routing.ts will now use the service
const loadWaypointsFromLocalStorage = (): boolean => {
  try {
    const loadedData = loadWaypointsFromStorageService(); // Call the aliased service function from LocalStorageService
    if (loadedData) {
      setWaypointsAndFlags(loadedData.waypoints, loadedData.directFlags); // Use the setter from WaypointManager
      console.log('[routing.ts] Loaded waypoints from local storage via service:', getWaypoints());
      return true;
    }
    return false;
  } catch (error) {
    console.error('[routing.ts] Error loading waypoints from local storage via service:', error);
    return false;
  }
};

// --- Local Storage ---
// REMOVE: const WAYPOINTS_STORAGE_KEY = 'mapWaypoints';
// REMOVE: saveWaypointsToLocalStorage and loadWaypointsFromLocalStorage functions entirely from here.

// --- Drag state ---
// isDragging is GONE (moved to MapInteractionManager)
// draggedWaypointIndex is GONE (moved to MapInteractionManager)
// currentLngLat is GONE (moved to MapInteractionManager)

// --- GPX Export ---
export const exportRouteToGPX = () => {
  const currentWaypoints = getWaypoints();
  const routePath = getCurrentRoutePath(); // Get from RouteCalculationService

  if (currentWaypoints.length === 0 && routePath.length === 0) {
    console.warn('[GPX Export] No waypoints or route path to export.');
    alert('No route to export.');
    return;
  }

  // Use the new service function to generate the GPX string
  const gpxString = generateGPXString(currentWaypoints, routePath);

  try {
    const blob = new Blob([gpxString], { type: 'application/gpx+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `route_${timestamp}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    console.log('[GPX Export] Route exported successfully via GPXService.');
  } catch (error) {
    console.error('[GPX Export] Error exporting route:', error);
    alert('Error exporting route. See console for details.');
  }
};

// --- GPX Import ---
export const importRouteFromGPX = async (
  gpxString: string,
  map: MapboxMap,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  onError?: (message: string) => void
) => {
  try {
    const parsedResult = await parseGPXFile(gpxString);

    if (parsedResult.error || !parsedResult.waypoints) {
      console.error("[routing.ts.importRouteFromGPX] Error parsing GPX from service:", parsedResult.error);
      if (onError) onError(parsedResult.error || "Unknown parsing error.");
      return;
    }

    const processedResult = await processGPXWaypoints(parsedResult.waypoints, accessToken);

    if (processedResult.error || !processedResult.finalWaypoints || !processedResult.finalDirectFlags) {
      console.error("[routing.ts.importRouteFromGPX] Error processing GPX waypoints from service:", processedResult.error);
      if (onError) onError(processedResult.error || "Unknown waypoint processing error.");
      return;
    }

    const { finalWaypoints: finalNewWaypoints, finalDirectFlags: newDirectFlags } = processedResult;

    resetRouting(map, setRouteDistance, setRouteDuration, setHasRoute);
    snapshot();
    setWaypointsAndFlags(finalNewWaypoints, newDirectFlags);
    updateWaypointsLayer(map, getWaypoints());
    saveWaypointsToStorage(getWaypoints(), getDirectFlags());

    if (getWaypoints().length >= 2) {
      console.log("[routing.ts.importRouteFromGPX] Recalculating route for imported waypoints.");
      const routeResult: RouteResult = await getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
      if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
        console.log("[routing.ts.importRouteFromGPX] Route service snapped waypoints. Updating WaypointManager.");
        setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
        updateWaypointsLayer(map, getWaypoints());
        saveWaypointsToStorage(getWaypoints(), getDirectFlags());
      }
    } else if (getWaypoints().length === 1) {
      setRouteDistance('');
      setRouteDuration('');
      setHasRoute(false);
      clearCurrentRoutePath();
      clearRouteLayer(map);
      clearKilometerMarkersLayer(map);
    }
    console.log(`[routing.ts.importRouteFromGPX] Successfully imported ${getWaypoints().length} waypoints via GPXService.`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during GPX import process';
    console.error("[routing.ts.importRouteFromGPX] Error importing route:", error);
    if (onError) onError(`Error importing GPX: ${errorMessage}`);
  }
};

// --- New function to insert a waypoint at a specific location on the route ---
export const insertWaypointAtLocation = insertWaypointAtLocationFromManager;

// addWaypoint function body is already removed by previous step.
// Now, ensure the imported addWaypointFromManager is exported as addWaypoint.
export const addWaypoint = addWaypointFromManager;

// --- New function to set route data from external source (e.g., shared link) ---
export const setRouteData = async (
  map: MapboxMap,
  accessToken: string,
  newWaypoints: Coordinate[],
  newDirectFlags: boolean[],
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
) => {
  console.log('[setRouteData] Setting route from external data');
  // resetRouting call might be too aggressive if we want to keep history for this action.
  // Consider clearing waypoints and route more surgically if needed.
  setWaypointsAndFlags([], []); // Clear current waypoints via manager
  updateWaypointsLayer(map, []);
  clearRoute(map);
  setRouteDistance('');
  setRouteDuration('');
  setHasRoute(false);
  // currentPopup?.remove(); // currentPopup is managed locally in routing.ts

  snapshot(); // Snapshot before applying new data
  
  setWaypointsAndFlags(newWaypoints, newDirectFlags); // Use WaypointManager setter

  updateWaypointsLayer(map, getWaypoints());
  saveWaypointsToStorage(getWaypoints(), getDirectFlags());

  if (getWaypoints().length >= 2) {
    console.log('[setRouteData] Recalculating route for loaded data.');
    const routeResult: RouteResult = await getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
    if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
      console.log("[setRouteData] Route service snapped waypoints. Updating WaypointManager.");
      setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
      updateWaypointsLayer(map, getWaypoints());
      saveWaypointsToStorage(getWaypoints(), getDirectFlags());
    }
  } else if (getWaypoints().length === 1) {
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
    clearCurrentRoutePath();
    clearRouteLayer(map);
    clearKilometerMarkersLayer(map);
  } else { // 0 waypoints
    clearCurrentRoutePath();
    clearRouteLayer(map);
    clearKilometerMarkersLayer(map);
  }
  console.log(`[setRouteData] Successfully set ${getWaypoints().length} waypoints.`);
  console.log('[setRouteData] Route data set and recalculated successfully.');
};

// Helper function to fit the map view to the route -- THIS ENTIRE FUNCTION BLOCK SHOULD BE REMOVED
// export const zoomToRoute = (map: MapboxMap, coordinates: Coordinate[]) => {
//   if (!map || !map.getBounds || !coordinates || coordinates.length === 0) {
//     console.warn('[zoomToRoute] Map not ready or no coordinates to zoom to.');
//     return;
//   }

//   try {
//     const currentPitch = map.getPitch();
//     const currentBearing = map.getBearing();

//     const bounds = coordinates.reduce(
//       (currentBounds, coord) => {
//         return currentBounds.extend(coord);
//       },
//       new LngLatBounds(coordinates[0], coordinates[0])
//     );

//     map.fitBounds(bounds, {
//       padding: 75, // Uniform padding
//       maxZoom: 16,
//       duration: 1000,
//       essential: true,
//       pitch: currentPitch,      // Preserve current pitch
//       bearing: currentBearing   // Preserve current bearing
//     });
//     console.log('[zoomToRoute] Adjusted map bounds to fit route, preserving pitch and bearing.');
//   } catch (error) {
//     console.error('[zoomToRoute] Error fitting bounds:', error);
//   }
// };

// removeWaypoint function body is removed.
// Ensure the imported removeWaypointFromManager is exported as removeWaypoint.
export const removeWaypoint = removeWaypointFromManager;

// stepBack function body is removed.
// Ensure the imported stepBackFromHistoryManager is exported as stepBack.
export const stepBack = stepBackFromHistoryManager;

// stepForward function body is removed.
// Ensure the imported stepForwardFromHistoryManager is exported as stepForward.
export const stepForward = stepForwardFromHistoryManager;

export const reverseRoute = reverseRouteFromManager;

// updateWaypointPositionAndRecalculate function body is removed.
// Ensure the imported updateWaypointPositionAndRecalculateFromManager is exported as updateWaypointPositionAndRecalculate.
export const updateWaypointPositionAndRecalculate = updateWaypointPositionAndRecalculateFromManager;

// Setup routing logic for a Mapbox map instance
export const setupRouting = (
  map: MapboxMap,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  setPopup: Dispatch<SetStateAction<PopupInfo | null>>
) => {
  console.log('[routing.ts] Setting up routing module...');
  initializeSourcesAndLayers(map);
  
  // Initialize map interactions by calling the function from MapInteractionManager
  initializeMapInteractions(
    map,
    accessToken,
    setRouteDistance,
    setRouteDuration,
    setHasRoute,
    setPopup
  );

  const waypointsLoaded = loadWaypointsFromLocalStorage();
  if (waypointsLoaded) {
    console.log('[routing.ts] Waypoints loaded from local storage, updating layer.');
    updateWaypointsLayer(map, getWaypoints());
    if (getWaypoints().length >= 1) {
      console.log('[routing.ts] Recalculating route for initially loaded waypoints.');
      getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute).then(result => {
        if (result.success && result.waypointsSnapped && result.snappedWaypoints && result.snappedDirectFlags) {
          console.log("[routing.ts] Initial route successfully calculated and waypoints snapped.");
          setWaypointsAndFlags(result.snappedWaypoints, result.snappedDirectFlags);
          updateWaypointsLayer(map, getWaypoints());
          saveWaypointsToStorage(getWaypoints(), getDirectFlags());
        } else if (!result.success && getWaypoints().length === 1) {
          console.log('[routing.ts] Single waypoint loaded, no route to calculate yet or snapping failed.');
          setRouteDistance('');
          setRouteDuration('');
        } else if (!result.success) {
           console.warn('[routing.ts] Failed to calculate initial route. Service indicated failure.');
        }
      }).catch(error => {
        console.error('[routing.ts] Error recalculating initial route:', error);
      });
    }
  } else {
    console.log('[routing.ts] No waypoints found in local storage.');
  }
  console.log('[routing.ts] Routing module setup complete.');
};

// Clear the displayed route
export const clearRoute = (map: MapboxMap) => {
  console.log('[routing.ts] clearRoute called');
  clearRouteLayer(map); // Use MapLayerManager
  clearKilometerMarkersLayer(map); // Use MapLayerManager
  clearCurrentRoutePath(); // Clear data in RouteCalculationService

  // No need to update route distance/duration here,
  // that should be handled by the caller or resetRouting if it's a full reset.
};

// Reset all routing data and UI
export const resetRouting = (
  map: MapboxMap,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
) => {
  console.log('[routing.ts] resetRouting called');
  snapshot(); // Snapshot before reset

  setWaypointsAndFlags([], []); // Clear waypoints in WaypointManager
  updateWaypointsLayer(map, []); // Clear waypoint markers on map
  saveWaypointsToStorage([], []); // Clear from local storage

  clearRoute(map); // This now uses MapLayerManager and clears RouteCalculationService state

  setRouteDistance('');
  setRouteDuration('');
  setHasRoute(false);

  clearHistory(); // Clear undo/redo history

  // Any other state to reset?
  // isDragging, draggedWaypointIndex are reset by mouseup/touchend.
  // contextMenuListenerAdded should persist.

  console.log('[routing.ts] Routing reset complete.');
};

// Function to update the user location point on the map
export const updateUserLocationPoint = (map: MapboxMap, coordinates: Coordinate | null) => {
  updateUserLocationLayer(map, coordinates); // Call the manager's function
};