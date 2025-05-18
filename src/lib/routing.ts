import type { Dispatch, SetStateAction } from 'react';
import type { Coordinate } from '@/types/map';
import type { Map as MapboxMap } from 'mapbox-gl';
import { initializeMapInteractions, type PopupInfo as MIMPopupInfo } from '@/features/routing/managers/MapInteractionManager';

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
import { snapshot, clearHistory, stepBack as stepBackFromHistoryManager, stepForward as stepForwardFromHistoryManager, subscribeToHistoryChanges } from '@/features/routing/managers/HistoryManager';
import type { WaypointHistory } from '@/types/map';

// Import the new service
import { saveWaypointsToLocalStorage as saveWaypointsToStorage, loadWaypointsFromLocalStorage as loadWaypointsFromStorageService } from '@/features/routing/services/LocalStorageService';

// Import the new GPX service functions
import { generateGPXString, parseGPXFile, processGPXWaypoints } from '@/features/routing/services/GPXService';

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

// Module-level variables to store map instance and access token for the history event handler
let _mapInstance: MapboxMap | null = null;
let _accessToken: string | null = null;

// --- GPX Export ---
export const exportRouteToGPX = (): { success: boolean; message?: string } => {
  const currentWaypoints = getWaypoints();
  const routePath = getCurrentRoutePath() ?? []; // Get from RouteCalculationService

  if (currentWaypoints.length === 0 && routePath.length === 0) {
    return { success: false, message: 'No route to export.' };
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
    return { success: true };
  } catch (error) {
    console.error('[GPX Export] Error exporting route:', error);
    return { success: false, message: 'Error exporting route. See console for details.' };
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
    setWaypointsAndFlags(finalNewWaypoints, newDirectFlags);
  snapshot();
    updateWaypointsLayer(map, getWaypoints());
    saveWaypointsToStorage(getWaypoints(), getDirectFlags());

    if (getWaypoints().length >= 2) {
      try {
        const routeResult: RouteResult = await getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
        if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
          setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
          updateWaypointsLayer(map, getWaypoints());
          saveWaypointsToStorage(getWaypoints(), getDirectFlags());
        } else if (!routeResult.success) {
          console.warn('[importRouteFromGPX] Route calculation after GPX import indicated failure:', routeResult.error);
          if (onError && routeResult.error) onError(routeResult.error);
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
  }
      } catch (error) {
        console.error('[importRouteFromGPX] Route calc failed after GPX import:', error);
        if (onError) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to calculate route after GPX import.';
          onError(errorMessage);
        }
        clearRouteLayer(map);
        clearKilometerMarkersLayer(map);
        clearCurrentRoutePath();
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
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

// insertWaypointAtLocation is part of Waypoint Management, not GPX Import
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
        snapshot();
  setWaypointsAndFlags([], []);
  updateWaypointsLayer(map, []);
                        clearRoute(map);
                        setRouteDistance('');
                        setRouteDuration('');
                        setHasRoute(false);

  setWaypointsAndFlags(newWaypoints, newDirectFlags);

  updateWaypointsLayer(map, getWaypoints());
  saveWaypointsToStorage(getWaypoints(), getDirectFlags());

  if (getWaypoints().length >= 2) {
    try {
      const routeResult: RouteResult = await getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
      if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
        setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
        updateWaypointsLayer(map, getWaypoints());
        saveWaypointsToStorage(getWaypoints(), getDirectFlags());
      } else if (!routeResult.success) {
        console.warn('[setRouteData] Route calculation indicated failure:', routeResult.error);
      }
    } catch (error) {
      console.error('[setRouteData] Route calc failed:', error);
      clearRouteLayer(map);
      clearKilometerMarkersLayer(map);
      clearCurrentRoutePath();
      setRouteDistance('');
      setRouteDuration('');
      setHasRoute(false);
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
};



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

// Keep track of subscription to avoid multiple subscriptions if setupRouting is called again (though it shouldn't be)
let unsubscribeFromHistory: (() => void) | null = null;

// Setup routing logic for a Mapbox map instance
export const setupRouting = (
  map: MapboxMap, 
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  setPopup: Dispatch<SetStateAction<MIMPopupInfo | null>>,
  handleWaypointError: (message: string | null) => void
): (() => void) => {
  _mapInstance = map; // Store for history event handler
  _accessToken = accessToken; // Store for history event handler

  initializeSourcesAndLayers(map);
  
  const mapInteractionDisposer = initializeMapInteractions(
    map,
          accessToken, 
          setRouteDistance, 
          setRouteDuration, 
    setHasRoute,
    setPopup,
    handleWaypointError
  );

  try {
    const loadedData = loadWaypointsFromStorageService();
    if (loadedData) {
      setWaypointsAndFlags(loadedData.waypoints, loadedData.directFlags);
      console.log('[routing.ts] Waypoints loaded from local storage.');
      updateWaypointsLayer(map, getWaypoints());
      if (getWaypoints().length >= 1) {
        getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute).then(result => {
          if (result.success && result.waypointsSnapped && result.snappedWaypoints && result.snappedDirectFlags) {
            console.log("[routing.ts] Initial route calculated and waypoints snapped.");
            setWaypointsAndFlags(result.snappedWaypoints, result.snappedDirectFlags);
            updateWaypointsLayer(map, getWaypoints());
            saveWaypointsToStorage(getWaypoints(), getDirectFlags());
          } else if (!result.success && getWaypoints().length === 1) {
            console.log('[routing.ts] Single waypoint loaded, no route to calculate yet or snapping failed.');
            // setRouteDistance(''); // Already handled by getRouteFromService if not enough points
            // setRouteDuration('');
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
    } catch (error) {
    console.error('[routing.ts] Error loading waypoints from local storage in setupRouting:', error);
  }

  // Define the event handler for history changes here, so it has access to setters
  const handleHistoryApplied = async (historyState: WaypointHistory) => {
    if (!_mapInstance || !_accessToken) {
      console.error('[routing.ts.handleHistoryApplied] Map instance or access token not available for history event.');
      return;
    }
    // Waypoints and flags are already set by HistoryManager's setWaypointsAndFlags,
    // which is called by stepBack/stepForward before emitting the event.
    // So, historyState.points and historyState.flags are the current state *before* potential snapping by getRouteFromService.
    updateWaypointsLayer(_mapInstance, historyState.points);

    let finalPointsToSave = historyState.points;
    let finalFlagsToSave = historyState.flags;

    if (historyState.points.length >= 2) {
      const routeResult: RouteResult = await getRouteFromService(_mapInstance, _accessToken, setRouteDistance, setRouteDuration, setHasRoute);
      if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
        // Waypoints were snapped, update the internal state and layers
        setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
        updateWaypointsLayer(_mapInstance, routeResult.snappedWaypoints); // Update with snapped points
        // Update what will be saved to storage
        finalPointsToSave = routeResult.snappedWaypoints;
        finalFlagsToSave = routeResult.snappedDirectFlags;
        console.log('[routing.ts.handleHistoryApplied] Waypoints snapped during route recalculation after history change.');
      } else if (!routeResult.success) {
        // Route calculation failed, might need to clear route display
        clearRouteLayer(_mapInstance);
        clearKilometerMarkersLayer(_mapInstance);
        clearCurrentRoutePath(); 
        setRouteDistance('');
        setRouteDuration('');
        setHasRoute(false);
        console.warn('[routing.ts.handleHistoryApplied] Route recalculation failed after history change.');
      }
    } else { // 0 or 1 waypoint
      clearRouteLayer(_mapInstance);
      clearKilometerMarkersLayer(_mapInstance);
      clearCurrentRoutePath(); 
      setRouteDistance('');
      setRouteDuration('');
      setHasRoute(false);
      if (historyState.points.length === 0) updateWaypointsLayer(_mapInstance, []); 
    }
    
    // Save the final state (either original from history or snapped) to local storage
    saveWaypointsToStorage(finalPointsToSave, finalFlagsToSave); 
    console.log('[routing.ts.handleHistoryApplied] History change processed. Points saved to storage:', finalPointsToSave.length);
  };

  // Subscribe to history changes only once
  if (unsubscribeFromHistory) {
    unsubscribeFromHistory(); // Unsubscribe previous if any
  }
  unsubscribeFromHistory = subscribeToHistoryChanges('historyApplied', handleHistoryApplied);

  console.log('[routing.ts] Routing module setup complete. History event listener subscribed.');
  
  return mapInteractionDisposer; 
};

// Function to clean up resources initialized by setupRouting
export const teardownRouting = () => {
  if (unsubscribeFromHistory) {
    unsubscribeFromHistory();
    unsubscribeFromHistory = null;
    console.log('[routing.ts] Unsubscribed from history changes.');
  }
  _mapInstance = null;
  _accessToken = null;
  console.log('[routing.ts] Cleared map instance and access token references for history handler.');
  // Note: The disposer from initializeMapInteractions (map listeners) is handled by the caller (MapWithRouting.tsx)
};

// Clear the displayed route
export const clearRoute = (map: MapboxMap) => {
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
  clearHistory();
  setWaypointsAndFlags([], []);
  updateWaypointsLayer(map, []);
  saveWaypointsToStorage([], []);
  
    clearRoute(map);

    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
    
  clearCurrentRoutePath();

  console.log('[routing.ts] Routing reset complete.');
};

// Function to update the user location point on the map
export const updateUserLocationPoint = (map: MapboxMap, coordinates: Coordinate | null) => {
  updateUserLocationLayer(map, coordinates); // Call the manager's function
};