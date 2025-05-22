import type { Dispatch, SetStateAction } from 'react';
import type { Coordinate } from '@/types/map';
import type { Map as MapboxMap } from 'mapbox-gl';
import { initializeMapInteractions, type PopupInfo as MIMPopupInfo } from '@/features/routing/managers/MapInteractionManager';
import type { Feature, Point as GeoJsonPoint } from 'geojson';
import { calculateTargetCoordinate, zoomToRoute } from '@/features/routing/utils/RoutingUtils';
import type { LoopDirection } from '@/components/ui/RouteGeneratorModal';

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
import { 
  snapshot as historySnapshot, 
  stepBack as stepBackFromHistoryManager,
  stepForward as stepForwardFromHistoryManager,
  subscribeToHistoryChanges
} from '@/features/routing/managers/HistoryManager';
import type { WaypointHistory } from '@/types/map';

// Import the new service
import { saveWaypointsToLocalStorage as saveWaypointsToStorage, loadWaypointsFromLocalStorage as loadWaypointsFromStorageService } from '@/features/routing/services/LocalStorageService';

// Import the new GPX service functions
import { generateGPXString, parseGPXFile, processGPXWaypoints } from '@/features/routing/services/GPXService';

// Import the RouteCalculationService and its result type
import { 
  getRoute as getRouteFromService,
  getCurrentRoutePath,
  clearCurrentRoutePath,
  calculateAtoBRoute 
} from '@/features/routing/services/RouteCalculationService';
import type { RouteResult } from '@/features/routing/services/RouteCalculationService';

// Import from MapLayerManager
import {
  initializeSourcesAndLayers,
  updateWaypointsLayer,
  updateUserLocationLayer,
  clearRouteLayer,
  clearKilometerMarkersLayer,
  updateRouteLayer as updateRouteLayerFromMapLayerManager,
  updateKilometerMarkersLayer as updateKilometerMarkersLayerFromMapLayerManager
} from '@/features/routing/managers/MapLayerManager';

// Helper for haversine distance (duplicated from RCS for now or move to shared utils)
function haversineDistance(coords1: Coordinate, coords2: Coordinate): number {
  const R = 6371; // Radius of the Earth in kilometers
  const lat1 = coords1[1];
  const lon1 = coords1[0];
  const lat2 = coords2[1];
  const lon2 = coords2[0];

  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    0.5 -
    Math.cos(dLat) / 2 +
    (Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      (1 - Math.cos(dLon))) / 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// Add a fallback mechanism for route generation that uses a simpler approach
async function generateSimplifiedLoop(
  startPoint: Coordinate,
  targetLengthKm: number,
  accessToken: string
): Promise<NaturalLoopResult> {
  try {
    console.log(`[routing.ts] Attempting simplified loop generation from ${startPoint}`);
    
    // Create a simple out-and-back route - just go in one direction and back
    const halfDistance = targetLengthKm / 2;
    const bearing = Math.floor(Math.random() * 360); // Random direction
    
    // Target point is half the desired distance away
    const turningPoint = calculateTargetCoordinate(startPoint, halfDistance, bearing);
    
    // Simple two-point route (out and back)
    const waypointsStr = `${startPoint[0]},${startPoint[1]};${turningPoint[0]},${turningPoint[1]};${startPoint[0]},${startPoint[1]}`;
    
    // Use walking profile for simplicity
    const apiUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${waypointsStr}?alternatives=false&geometries=geojson&overview=full&steps=true&access_token=${accessToken}&exclude=ferry&continue_straight=true`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      console.log(`[routing.ts] Simplified loop API request failed`);
      return { success: false, error: 'Failed to generate even a simplified route.' };
    }
    
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      return {
        success: true,
        geometry: data.routes[0].geometry.coordinates,
        distanceMeters: data.routes[0].distance,
        durationSeconds: data.routes[0].duration
      };
    }
    
    return { success: false, error: 'No routes found for simplified loop.' };
  } catch (error) {
    console.error(`[routing.ts] Error in simplified loop generation:`, error);
    return { success: false, error: 'Error in simplified loop generation.' };
  }
}

// Helper function to generate kilometer marker GeoJSON features
function generateKmMarkerFeatures(coordinates: Coordinate[]): Feature<GeoJsonPoint>[] {
  if (coordinates.length < 2) return [];
  const kmMarkerFeatures: Feature<GeoJsonPoint>[] = [];
  let distanceCovered = 0;
  let nextKmMarker = 1;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];
    const segmentDistance = haversineDistance(start, end);
    while (distanceCovered + segmentDistance >= nextKmMarker && segmentDistance > 0) {
      const segmentFraction = (nextKmMarker - distanceCovered) / segmentDistance;
      const markerLng = start[0] + segmentFraction * (end[0] - start[0]);
      const markerLat = start[1] + segmentFraction * (end[1] - start[1]);
      
      let markerType: 'major' | 'medium' | 'minor';
      if (nextKmMarker % 10 === 0) {
        markerType = 'major';
      } else if (nextKmMarker % 5 === 0) {
        markerType = 'medium';
      } else {
        markerType = 'minor';
      }

      kmMarkerFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [markerLng, markerLat] },
        properties: { km: `${nextKmMarker} km`, markerType: markerType }
      });
      nextKmMarker++;
    }
    distanceCovered += segmentDistance;
  }
  return kmMarkerFeatures;
}

// Module-level variables to store map instance and access token for the history event handler
let _mapInstance: MapboxMap | null = null;
let _accessToken: string | null = null;
let _isMapLockedRef: { current: boolean } | null = null; // Add module-level ref for isMapLocked

// Helper to convert LoopDirection to a numerical bearing
// If 'ANY', picks a random initial bearing for variability.
function getBearingForLoopDirection(direction: LoopDirection): number {
  switch (direction) {
    case 'N': return 0;
    case 'NE': return 45;
    case 'E': return 90;
    case 'SE': return 135;
    case 'S': return 180;
    case 'SW': return 225;
    case 'W': return 270;
    case 'NW': return 315;
    case 'ANY': default: return Math.floor(Math.random() * 360);
  }
}

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
  } catch (error: unknown) {
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
    historySnapshot();
    updateWaypointsLayer(map, getWaypoints(), _isMapLockedRef?.current ?? false); // Use ref value
    saveWaypointsToStorage(getWaypoints(), getDirectFlags());

    if (getWaypoints().length >= 2) {
      try {
        const routeResult: RouteResult = await getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
        if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
          setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
          updateWaypointsLayer(map, getWaypoints(), _isMapLockedRef?.current ?? false); // Use ref value
          saveWaypointsToStorage(getWaypoints(), getDirectFlags());
        } else if (!routeResult.success) {
          console.warn('[importRouteFromGPX] Route calculation after GPX import indicated failure:', routeResult.error);
          if (onError && routeResult.error) onError(routeResult.error);
          setRouteDistance('');
          setRouteDuration('');
          setHasRoute(false);
        }
      } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  setIsRouteCoordsReady: Dispatch<SetStateAction<boolean>>
) => {
  setIsRouteCoordsReady(false); // Set to false at the start of loading new data
  historySnapshot();
  setWaypointsAndFlags([], []);
  updateWaypointsLayer(map, [], _isMapLockedRef?.current ?? false); // Use ref value
  clearRoute(map);
  setRouteDistance('');
  setRouteDuration('');
  setHasRoute(false);

  setWaypointsAndFlags(newWaypoints, newDirectFlags);

  updateWaypointsLayer(map, getWaypoints(), _isMapLockedRef?.current ?? false); // Use ref value
  saveWaypointsToStorage(getWaypoints(), getDirectFlags());

  if (getWaypoints().length >= 2) {
    try {
      const routeResult: RouteResult = await getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
      if (routeResult.success) { // Check for overall success
        // RouteCalculationService is expected to update its internal state (currentRoutePathCoordinates)
        // when routeResult.success is true.
        // We can now safely set isRouteCoordsReady to true.
        setIsRouteCoordsReady(true); // Set to true after successful calculation
        
        if (routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
          setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
          updateWaypointsLayer(map, getWaypoints(), _isMapLockedRef?.current ?? false); // Use ref value
          saveWaypointsToStorage(getWaypoints(), getDirectFlags());
        } else if (!routeResult.success) {
          console.warn('[setRouteData] Route calculation indicated failure:', routeResult.error);
        }
      } else {
        console.error('[setRouteData] Route calc failed:', routeResult.error);
        clearRouteLayer(map);
        clearKilometerMarkersLayer(map);
        clearCurrentRoutePath();
        setRouteDistance('');
        setRouteDuration('');
        setHasRoute(false);
        setIsRouteCoordsReady(false); // Set to false on error
      }
    } catch (error: unknown) {
      console.error('[setRouteData] Route calc failed:', error);
      clearRouteLayer(map);
      clearKilometerMarkersLayer(map);
      clearCurrentRoutePath();
      setRouteDistance('');
      setRouteDuration('');
      setHasRoute(false);
      setIsRouteCoordsReady(false); // Set to false on error
    }
  } else if (getWaypoints().length === 1) {
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
    clearCurrentRoutePath();
    clearRouteLayer(map);
    clearKilometerMarkersLayer(map);
    setIsRouteCoordsReady(false); // Set to false if not enough waypoints for a route
  } else { // 0 waypoints
    clearCurrentRoutePath();
    clearRouteLayer(map);
    clearKilometerMarkersLayer(map);
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
    setIsRouteCoordsReady(false); // Set to false if not enough waypoints for a route
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
  handleWaypointError: (message: string | null) => void,
  isMapLockedRef: { current: boolean } // Accept the ref
): (() => void) => {
  _mapInstance = map; // Store for history event handler
  _accessToken = accessToken; // Store for history event handler
  _isMapLockedRef = isMapLockedRef; // Store the ref

  initializeSourcesAndLayers(map);
  
  const mapInteractionDisposer = initializeMapInteractions(
    map,
          accessToken, 
          setRouteDistance, 
          setRouteDuration, 
    setHasRoute,
    setPopup,
    handleWaypointError,
    isMapLockedRef // Pass the ref
  );

  try {
    const loadedData = loadWaypointsFromStorageService();
    if (loadedData) {
      setWaypointsAndFlags(loadedData.waypoints, loadedData.directFlags);
      console.log('[routing.ts] Waypoints loaded from local storage by routing.ts.');
      updateWaypointsLayer(map, getWaypoints(), isMapLockedRef.current);
      historySnapshot(); // <--- ADDED: Snapshot the state loaded from WaypointManager's localStorage
      console.log('[routing.ts] Initial snapshot taken after loading waypoints from storage.');

      if (getWaypoints().length >= 1) { 
        getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute).then((result: RouteResult) => {
          if (result.success && result.waypointsSnapped && result.snappedWaypoints && result.snappedDirectFlags) {
            console.log("[routing.ts] Initial route calculated and waypoints snapped by routing.ts.");
            setWaypointsAndFlags(result.snappedWaypoints, result.snappedDirectFlags);
            updateWaypointsLayer(map, getWaypoints(), isMapLockedRef.current);
            saveWaypointsToStorage(getWaypoints(), getDirectFlags()); // Saves to WaypointManager's storage
            historySnapshot(); // <--- ADDED: Snapshot again if snapping occurs and alters state
            console.log('[routing.ts] Snapshot taken after initial route snapping by routing.ts.');
          } else if (!result.success && getWaypoints().length === 1) {
            console.log('[routing.ts] Single waypoint loaded, no route to calculate yet or snapping failed.');
          } else if (!result.success) {
             console.warn('[routing.ts] Failed to calculate initial route by routing.ts. Service indicated failure.');
          }
        }).catch((error: unknown) => { 
          console.error('[routing.ts] Error recalculating initial route by routing.ts:', error);
        });
      }
    } else {
      console.log('[routing.ts] No waypoints found in local storage by routing.ts.');
      historySnapshot(); // <--- ADDED: Snapshot the initial empty state if nothing loaded
      console.log('[routing.ts] Initial snapshot taken for empty state by routing.ts.');
    }
  } catch (error: unknown) { 
    console.error('[routing.ts] Error loading waypoints from local storage in setupRouting by routing.ts:', error);
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
    updateWaypointsLayer(_mapInstance, historyState.points, _isMapLockedRef?.current ?? false); // Use ref value

    let finalPointsToSave = historyState.points;
    let finalFlagsToSave = historyState.flags;

    if (historyState.points.length >= 2) {
      const routeResult: RouteResult = await getRouteFromService(_mapInstance, _accessToken, setRouteDistance, setRouteDuration, setHasRoute);
      if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
        // Waypoints were snapped, update the internal state and layers
        setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
        updateWaypointsLayer(_mapInstance, routeResult.snappedWaypoints, _isMapLockedRef?.current ?? false); // Use ref value
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
      if (historyState.points.length === 0) updateWaypointsLayer(_mapInstance, [], _isMapLockedRef?.current ?? false); // Use ref value
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
  historySnapshot(); // Take a snapshot before clearing waypoints
  // clearHistory(); // DO NOT call this if reset should be undoable
  setWaypointsAndFlags([], []);
  updateWaypointsLayer(map, [], _isMapLockedRef?.current ?? false); // Use ref value
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

// --- New Route Generation Function (A-to-B) ---
export async function generateAndDisplayRouteAtoB(
  map: MapboxMap,
  accessToken: string,
  startCoord: Coordinate, 
  endCoord: Coordinate,   
  surfaceType: 'paved' | 'mixed' | 'unpaved',
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  setIsRouteCoordsReady: Dispatch<SetStateAction<boolean>>,
  handleWaypointError: (message: string | null) => void 
): Promise<void> {
  console.log('[routing.ts] generateAndDisplayRouteAtoB called.');

  clearRoute(map); 
  setWaypointsAndFlags([startCoord, endCoord], [false, false]);
  historySnapshot();
  updateWaypointsLayer(map, getWaypoints(), _isMapLockedRef?.current ?? false);
  saveWaypointsToStorage(getWaypoints(), getDirectFlags());

  try {
    const result = await calculateAtoBRoute(startCoord, endCoord, accessToken, surfaceType);

    if (result.success && result.geometry && typeof result.distance === 'number' && typeof result.duration === 'number') {
      console.log('[routing.ts] Successfully generated A-to-B route.');
      
      updateRouteLayerFromMapLayerManager(map, result.geometry); 
      const kmFeatures = generateKmMarkerFeatures(result.geometry);
      updateKilometerMarkersLayerFromMapLayerManager(map, kmFeatures); 

      const distanceKm = (result.distance / 1000).toFixed(1);
      const durationMinutes = Math.round(result.duration / 60);
      setRouteDistance(`${distanceKm} km`);
      setRouteDuration(`${durationMinutes} min`);
      setHasRoute(true);
      setIsRouteCoordsReady(true);
      zoomToRoute(map, result.geometry); // Use imported zoomToRoute

    } else {
      console.error('[routing.ts] Failed to generate A-to-B route:', result.error);
      if (handleWaypointError) handleWaypointError(result.error || 'Failed to generate route.');
      setRouteDistance('');
      setRouteDuration('');
      setHasRoute(false);
      setIsRouteCoordsReady(false);
      setWaypointsAndFlags([], []); 
      updateWaypointsLayer(map, [], _isMapLockedRef?.current ?? false); 
      saveWaypointsToStorage([], []); 
    }
  } catch (error: unknown) {
    console.error('[routing.ts] Critical error in generateAndDisplayRouteAtoB:', error);
    if (handleWaypointError) handleWaypointError(error instanceof Error ? error.message : 'A critical error occurred.');
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
    setIsRouteCoordsReady(false);
    setWaypointsAndFlags([], []);
    updateWaypointsLayer(map, [], _isMapLockedRef?.current ?? false);
    saveWaypointsToStorage([], []);
    clearCurrentRoutePath(); 
    clearRoute(map); 
  }
}

// --- Improved Natural Loop Route Generation ---
export async function generateAndDisplayRouteLoop(
  map: MapboxMap,
  accessToken: string,
  startPoint: { lat: number; lng: number; name: string }, 
  loopLengthKm: number,
  loopDirection: LoopDirection,
  surfaceType: 'paved' | 'mixed' | 'unpaved',
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  setIsRouteCoordsReady: Dispatch<SetStateAction<boolean>>,
  handleWaypointError: (message: string | null) => void 
): Promise<void> {
  console.log('[routing.ts] Natural loop generation started.');
  const startCoord: Coordinate = [startPoint.lng, startPoint.lat];

  // Take a snapshot of the current state BEFORE this function makes any changes.
  // This snapshot will be what 'undo' reverts to.
  historySnapshot(); 

  // Clear previous route and set up initial waypoints internally for the generation logic
  clearRoute(map);
  setWaypointsAndFlags([startCoord], [false]); 
  // No snapshot here for this intermediate state
  updateWaypointsLayer(map, getWaypoints(), _isMapLockedRef?.current ?? false);
  // Defer saving to storage until the final waypoints are set

  if (loopLengthKm <= 0.2) { // Minimum sensible loop length
    if (handleWaypointError) handleWaypointError('Loop length is too short for generation.');
    setIsRouteCoordsReady(false); setHasRoute(false); setRouteDistance(''); setRouteDuration('');
    // Attempt to revert to the pre-function state if we bail early due to invalid input.
    // This requires stepBack to not cause a new snapshot or route recalc itself, which it currently does.
    // For now, this early exit will leave the history with the snapshot of the state *before* this function was called,
    // and the current state as just the startCoord. Undoing would go back to the pre-call state.
    return;
  }

  try {
    // 1. Get initial bearing based on loopDirection
    const initialBearing = getBearingForLoopDirection(loopDirection);
    
    let loopResult = await generateNaturalLoop(
      startCoord,
      loopLengthKm,
      initialBearing,
      accessToken,
      surfaceType
    );
    
    if (!loopResult.success || !loopResult.geometry) {
      console.log('[routing.ts] Natural loop generation failed, trying simplified approach');
      loopResult = await generateSimplifiedLoop(
        startCoord,
        loopLengthKm,
        accessToken
      );
    }

    if (!loopResult.success || !loopResult.geometry) {
      if (handleWaypointError) handleWaypointError(loopResult.error || 'Failed to generate natural loop.');
      setIsRouteCoordsReady(false); setHasRoute(false); setRouteDistance(''); setRouteDuration('');
      // Similar to above, undo will revert to pre-call state.
      return;
    }
    
    const routeGeometry = loopResult.geometry;
    const waypoints: Coordinate[] = [];
    const directFlags: boolean[] = [];
    
    waypoints.push(startCoord);
    directFlags.push(false); 
    
    if (routeGeometry.length > 2) {
      const numSegments = Math.min(8, Math.max(4, Math.ceil(loopLengthKm / 2)));
      const pointsPerSegment = Math.floor(routeGeometry.length / numSegments);
      for (let i = 1; i < numSegments; i++) {
        const index = Math.min(i * pointsPerSegment, routeGeometry.length - 1);
        waypoints.push(routeGeometry[index]);
        directFlags.push(false); 
      }
    }
    waypoints.push(startCoord);
    directFlags.push(false);
    
    // Update the map with the final waypoints from the generation
    setWaypointsAndFlags(waypoints, directFlags);
    // No history snapshot here; the one at the function start is the correct one for undo.
    updateWaypointsLayer(map, waypoints, _isMapLockedRef?.current ?? false);
    saveWaypointsToStorage(waypoints, directFlags); // Save the final generated waypoints
    
    try {
      const routeResult: RouteResult = await getRouteFromService(
        map, 
        accessToken, 
        setRouteDistance, 
        setRouteDuration, 
        setHasRoute
      );
      
      if (routeResult.success) {
        setIsRouteCoordsReady(true);
        if (routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
          // If waypoints were snapped, update the state. This is part of the successful generation.
          // The single undo should still go back to the state *before* loop generation was initiated.
          setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
          updateWaypointsLayer(map, getWaypoints(), _isMapLockedRef?.current ?? false);
          saveWaypointsToStorage(getWaypoints(), getDirectFlags());
        }
        
        const currentRouteGeom = getCurrentRoutePath();
        if (currentRouteGeom && currentRouteGeom.length > 0) {
          zoomToRoute(map, currentRouteGeom); 
        } else if (loopResult.geometry && loopResult.geometry.length > 0) {
          zoomToRoute(map, loopResult.geometry); 
        }
        
        console.log(`[routing.ts] Natural loop generation successful. Created ${waypoints.length} waypoints.`);
      } else {
        console.error('[routing.ts] Route calculation failed:', routeResult.error);
        if (handleWaypointError) handleWaypointError(routeResult.error || 'Failed to calculate final route through waypoints.');
        setIsRouteCoordsReady(false); setHasRoute(false); setRouteDistance(''); setRouteDuration('');
      }
    } catch (error: unknown) {
      console.error('[routing.ts] Error calculating route through waypoints:', error);
      if (handleWaypointError) handleWaypointError(error instanceof Error ? error.message : 'A critical error occurred calculating the final route.');
      setIsRouteCoordsReady(false); setHasRoute(false); setRouteDistance(''); setRouteDuration('');
    }

  } catch (error: unknown) {
    console.error('[routing.ts] Critical error in natural loop generation:', error);
    if (handleWaypointError) handleWaypointError(error instanceof Error ? error.message : 'A critical error occurred during loop generation.');
    setIsRouteCoordsReady(false); setHasRoute(false); setRouteDistance(''); setRouteDuration('');
    clearRoute(map);
  }
}

interface RouteLoopCandidate {
  geometry: Coordinate[];
  distanceMeters: number;
  durationSeconds: number;
  lengthRatio: number;
  overlapRatio: number;
  score: number;
}

interface NaturalLoopResult {
  success: boolean;
  geometry?: Coordinate[];
  distanceMeters?: number;
  durationSeconds?: number;
  error?: string;
}

/**
 * Generates a natural loop route by exploring real road networks
 * rather than using geometric patterns.
 */
async function generateNaturalLoop(
  startPoint: Coordinate,
  targetLengthKm: number,
  initialBearing: number,
  accessToken: string,
  surfaceType: 'paved' | 'mixed' | 'unpaved'
): Promise<NaturalLoopResult> {
  console.log(`[routing.ts] Generating natural loop from ${startPoint}, target=${targetLengthKm}km, bearing=${initialBearing}°`);

  if (targetLengthKm < 0.5) {
    return { success: false, error: 'Target loop length is too short.' };
  }
  
  // Map profile optimized for walking/running paths
  // Use the appropriate profile based on surface preference
  let profile = 'mapbox/walking';
  
  // The previous approach with additional parameters was causing 422 errors
  // For different surface preferences, we can adjust the profile instead
  if (surfaceType === 'unpaved') {
    // Use walking profile for most path-oriented results
    profile = 'mapbox/walking';
  } else if (surfaceType === 'mixed') {
    // Cycling profile has a good mix of small roads and paths
    profile = 'mapbox/cycling';
  } else {
    // For paved preference, use cycling which favors paved surfaces
    profile = 'mapbox/cycling';
  }
  
  // Keep parameter configuration simple to avoid API errors
  const walkingSpeed = surfaceType === 'unpaved' ? '4.5' : '5.0';
  
  // Apply a scaling factor to compensate for the real road network being longer than direct distances
  // Increased from 1 to 1.1 to allow for finding more paths by extending search range
  const scalingFactor = 1.1;
  console.log(`[routing.ts] Spider exploration phase using profile: ${profile}, target: ${targetLengthKm}km, scaling: ${scalingFactor}`);
  
  // Create a wider range of directions to explore for more diverse route options
  // Use more directions to find better loops but bias toward OSM trail networks
  const angleStep = 20; // Reduce from 25 to 20 for even more options
  const clockDirections: number[] = [];
  for (let angle = 0; angle < 360; angle += angleStep) {
    clockDirections.push(angle);
  }
  
  // Add bias toward cardinal directions since trails often follow them
  const cardinalDirections = [0, 45, 90, 135, 180, 225, 270, 315];
  
  // Add known major park or recreation area directions (common locations for trails)
  // This varies by location but helps guide routes toward recreational areas
  const recreationDirections = [30, 60, 120, 150, 210, 240, 300, 330];
  
  // Combine all directions, ensuring no duplicates
  const combinedDirections = [...new Set([...clockDirections, ...cardinalDirections, ...recreationDirections])];
  
  // Map all potential directions from the initial bearing
  const directionsToTry = combinedDirections.map(angle => (initialBearing + angle) % 360);
  
  let bestLoop: {
    geometry: Coordinate[];
    distanceMeters: number;
    durationSeconds: number;
    score: number;
  } | null = null;
  
  // Try creating multiple different loop configurations
  for (let i = 0; i < directionsToTry.length; i++) {
    const outboundBearing = directionsToTry[i];
    // Create more circular paths by using angles closer to 90 degrees away
    // This helps avoid out-and-back on the same road
    const turnAngle = 70 + Math.floor(Math.random() * 40); // between 70-110 degrees
    const secondBearing = (outboundBearing + turnAngle) % 360;
    const thirdBearing = (secondBearing + turnAngle) % 360;
    
    console.log(`[routing.ts] Trying circular loop with bearings: ${outboundBearing}° → ${secondBearing}° → ${thirdBearing}°`);
    
    try {
      // Create a multi-waypoint route using 4 points to form a more circular shape:
      // 1. Starting point
      // 2. First waypoint (~1/4 of the way)
      // 3. Second waypoint (~1/2 of the way) 
      // 4. Third waypoint (~3/4 of the way)
      // 5. Back to starting point
      // Distribute waypoints more evenly with more intermediate points
      // Previous: 3 main segments (0.23, 0.27, 0.23 of total distance)
      // New: 5 smaller segments for finer control over the route
      const segmentDist1 = targetLengthKm * 0.15 * scalingFactor;
      const segmentDist2 = targetLengthKm * 0.15 * scalingFactor;
      const segmentDist3 = targetLengthKm * 0.18 * scalingFactor;
      const segmentDist4 = targetLengthKm * 0.15 * scalingFactor;
      const segmentDist5 = targetLengthKm * 0.15 * scalingFactor;
      
             // Generate waypoints - using just calculated targets without snapping
      // to avoid the "Radius values must be < 50" error from the Mapbox matching API
      // Create 5 waypoints instead of 3 for more control over the route
      const point1 = calculateTargetCoordinate(startPoint, segmentDist1, outboundBearing);      
      const point2 = calculateTargetCoordinate(point1, segmentDist2, outboundBearing);
      
      // Change direction at point2 for first turn
      const point3 = calculateTargetCoordinate(point2, segmentDist3, secondBearing);
      const point4 = calculateTargetCoordinate(point3, segmentDist4, secondBearing);
      
      // Change direction at point4 for second turn
      const point5 = calculateTargetCoordinate(point4, segmentDist5, thirdBearing);
      
      // Ensure the points are sufficiently different and form a good shape
      const minDistanceBetweenPoints = 0.2; // 200m
      if (haversineDistance(startPoint, point1) < minDistanceBetweenPoints ||
          haversineDistance(point1, point2) < minDistanceBetweenPoints ||
          haversineDistance(point2, point3) < minDistanceBetweenPoints ||
          haversineDistance(point3, point4) < minDistanceBetweenPoints ||
          haversineDistance(point4, point5) < minDistanceBetweenPoints ||
          haversineDistance(point5, startPoint) < minDistanceBetweenPoints) {
        console.log(`[routing.ts] Points too close together, skipping this configuration`);
        continue;
      }
      
      // Get route through all waypoints
      console.log(`[routing.ts] Getting multi-waypoint route through: start → p1 → p2 → p3 → p4 → p5 → start`);
      const waypointsStr = `${startPoint[0]},${startPoint[1]};${point1[0]},${point1[1]};${point2[0]},${point2[1]};${point3[0]},${point3[1]};${point4[0]},${point4[1]};${point5[0]},${point5[1]};${startPoint[0]},${startPoint[1]}`;
      
      // Create URL with simple parameters to avoid API errors
      const apiUrl = `https://api.mapbox.com/directions/v5/${profile}/${waypointsStr}?alternatives=true&geometries=geojson&overview=full&steps=true&access_token=${accessToken}&exclude=ferry&continue_straight=true&walking_speed=${walkingSpeed}`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        console.log(`[routing.ts] Multi-waypoint route API request failed`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        // Sort routes by best match to target distance
        const routes = data.routes.map((route: { 
          geometry: { coordinates: Coordinate[] }; 
          distance: number; 
          duration: number; 
        }) => {
          const lengthRatio = Math.abs(route.distance/1000 - targetLengthKm) / targetLengthKm;
          
          // Check for route uniqueness using a more thorough method
          // Break the route into segments for comparison
          const coords = route.geometry.coordinates as Coordinate[];
          let overlapScore = 0;
          
          // More sophisticated overlap detection
          // Create a grid-based representation of the route
          const gridSize = 0.001; // Roughly 100m grid cells
          const visitedCells = new Set<string>();
          const totalCells = new Set<string>();
          
          // Track each segment of the route
          coords.forEach(coord => {
            const cellKey = `${Math.floor(coord[0] / gridSize)},${Math.floor(coord[1] / gridSize)}`;
            if (visitedCells.has(cellKey)) {
              overlapScore++;
            } else {
              visitedCells.add(cellKey);
            }
            totalCells.add(cellKey);
          });
          
          // Normalize overlap score (0 to 1)
          const overlapRatio = totalCells.size > 0 ? overlapScore / totalCells.size : 0;
          
          // Scoring logic: 
          // 1. Penalize routes that are shorter than requested more heavily
          // 2. Heavily penalize routes with high overlap (reusing same roads)
          let adjustedLengthRatio = lengthRatio;
          if (route.distance/1000 < targetLengthKm) {
            adjustedLengthRatio = lengthRatio * 1.3;
          }
          
          // Heavier penalty for overlap (increased from 0.15 to 0.3)
          const score = 0.7 * adjustedLengthRatio + 0.3 * overlapRatio;
          
          return {
            geometry: coords,
            distanceMeters: route.distance,
            durationSeconds: route.duration,
            lengthRatio,
            overlapRatio,
            score
          };
        });
        
        routes.sort((a: RouteLoopCandidate, b: RouteLoopCandidate) => a.score - b.score);
        
        if (routes.length > 0) {
          const bestRoute = routes[0];
          
          // Allow routes to be up to 60% longer than requested
          // But be more strict about routes that are too short - only allow 25% shorter
          const tooLong = bestRoute.distanceMeters/1000 > targetLengthKm * 1.6;
          const tooShort = bestRoute.distanceMeters/1000 < targetLengthKm * 0.75;
          
          // Reject routes with too much overlap
          const tooMuchOverlap = bestRoute.overlapRatio > 0.4; // Reject if more than 40% overlap
          
          if (tooLong || tooShort) {
            console.log(`[routing.ts] Rejecting route: ${(bestRoute.distanceMeters/1000).toFixed(1)}km - ${tooLong ? 'too long' : 'too short'} vs target ${targetLengthKm}km`);
            continue;
          }
          
          if (tooMuchOverlap) {
            console.log(`[routing.ts] Rejecting route: Too much road overlap (${(bestRoute.overlapRatio * 100).toFixed(0)}%)`);
            continue;
          }
          
          // Verify the route actually returns to the start
          const startDistance = haversineDistance(startPoint, bestRoute.geometry[bestRoute.geometry.length - 1]);
          if (startDistance > 0.2) { // More than 200m from the start point
            console.log(`[routing.ts] Rejecting route: Doesn't return to start (${startDistance.toFixed(3)}km away)`);
            continue;
          }
          
          console.log(`[routing.ts] Found route: ${(bestRoute.distanceMeters/1000).toFixed(1)}km, score=${bestRoute.score.toFixed(2)} (length_ratio=${bestRoute.lengthRatio.toFixed(2)}, overlap=${(bestRoute.overlapRatio * 100).toFixed(0)}%)`);
          
          // If it's our first result or better than what we have, keep it
          if (!bestLoop || bestRoute.score < bestLoop.score) {
            bestLoop = bestRoute;
            console.log(`[routing.ts] New best loop found`);
            
            // If we found an excellent match with very low overlap, break early
            if (bestRoute.score < 0.15 && bestRoute.overlapRatio < 0.2) {
              console.log(`[routing.ts] Found excellent loop match with low overlap, using it immediately`);
              break;
            }
          }
        }
      }
    } catch (error) {
      console.warn(`[routing.ts] Error during loop creation:`, error);
    }
  }
  
  if (!bestLoop) {
    // Try an alternative strategy if no loop was found
    console.log(`[routing.ts] No loops found with circular approach, trying rectangular strategy`);
    
    try {
      // Create a rectangular shape with 4 waypoints
      // This typically creates more balanced loops
      const cornerAngle = 90; // Right angles for a rectangle
      const firstBearing = initialBearing;
      const secondBearing = (firstBearing + cornerAngle) % 360;
      const thirdBearing = (secondBearing + cornerAngle) % 360;
      
      // Calculate each side length to be roughly 1/4 of the target perimeter
      const sideLengthKm = targetLengthKm * 0.2 * scalingFactor;
      
      // Calculate and snap the 4 corners of the rectangle
      // Generate waypoints for rectangular approach - skip snapping to avoid API errors
      // Create more waypoints for finer control over the route
      // Instead of 3 waypoints, create 6 waypoints to form a more detailed route
      const segmentLength = sideLengthKm / 2; // Half the original distance between points
      
      // First side of the rectangle (2 points)
      const point1 = calculateTargetCoordinate(startPoint, segmentLength, firstBearing);
      const point2 = calculateTargetCoordinate(point1, segmentLength, firstBearing);
      
      // Second side of the rectangle (2 points)
      const point3 = calculateTargetCoordinate(point2, segmentLength, secondBearing);
      const point4 = calculateTargetCoordinate(point3, segmentLength, secondBearing);
      
      // Third side of the rectangle (2 points)
      const point5 = calculateTargetCoordinate(point4, segmentLength, thirdBearing);
      const point6 = calculateTargetCoordinate(point5, segmentLength, thirdBearing);
      
      console.log(`[routing.ts] Enhanced rectangular approach: start → p1 → p2 → p3 → p4 → p5 → p6 → start`);
      
      const waypointsStr = `${startPoint[0]},${startPoint[1]};${point1[0]},${point1[1]};${point2[0]},${point2[1]};${point3[0]},${point3[1]};${point4[0]},${point4[1]};${point5[0]},${point5[1]};${point6[0]},${point6[1]};${startPoint[0]},${startPoint[1]}`;
      
      // Create URL with simple parameters for fallback method
      const apiUrl = `https://api.mapbox.com/directions/v5/${profile}/${waypointsStr}?alternatives=false&geometries=geojson&overview=full&steps=true&access_token=${accessToken}&exclude=ferry&continue_straight=true&walking_speed=${walkingSpeed}`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        return { success: false, error: 'Failed to get alternative route.' };
      }
      
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        
        // Use more lenient validation for fallback approach
        // Allow routes to be up to 60% longer than requested but minimum 75% of target
        const actualDistance = route.distance / 1000; // km
        const tooLong = actualDistance > targetLengthKm * 2.0;
        const tooShort = actualDistance < targetLengthKm * 0.50;
        
        if (tooLong || tooShort) {
          console.log(`[routing.ts] Rectangular route ${tooLong ? 'too long' : 'too short'}: ${actualDistance.toFixed(1)}km vs ${targetLengthKm}km, rejecting`);
          return { success: false, error: 'Generated route too far from target length.' };
        }
        
        // Verify the route actually returns to the start
        const lastPoint = route.geometry.coordinates[route.geometry.coordinates.length - 1];
        const startDistance = haversineDistance(startPoint, lastPoint);
        if (startDistance > 0.2) { // More than 200m from the start point
          console.log(`[routing.ts] Rectangular route doesn't return to start (${startDistance.toFixed(3)}km away), rejecting`);
          return { success: false, error: 'Generated route doesn\'t return to the starting point.' };
        }
        
        return {
          success: true,
          geometry: route.geometry.coordinates,
          distanceMeters: route.distance,
          durationSeconds: route.duration
        };
      }
    } catch (error) {
      console.error(`[routing.ts] Error in rectangular loop strategy:`, error);
    }
    
    return { success: false, error: 'Could not generate any viable loop routes.' };
  }
  
  // We found a good loop!
  return {
    success: true,
    geometry: bestLoop.geometry,
    distanceMeters: bestLoop.distanceMeters,
    durationSeconds: bestLoop.durationSeconds
  };
}