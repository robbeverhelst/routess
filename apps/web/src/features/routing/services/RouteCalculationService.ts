import type { Dispatch, SetStateAction } from 'react';
import type { Coordinate } from '@/types/map';
import type { Map as MapboxMap } from 'mapbox-gl';
import { getWaypoints, getDirectFlags } from '@/features/routing/managers/WaypointManager';
import { haversine } from '@/features/routing/utils/RoutingUtils';
import { Logger } from '@/lib/logger';

// Import from MapLayerManager
import {
  updateRouteLayer,
  updateKilometerMarkersLayer,
  clearKilometerMarkersLayer
} from '@/features/routing/managers/MapLayerManager';

// Module-level state for the detailed path, similar to how it was in routing.ts
let currentRoutePathCoordinates: Coordinate[] = [];

const reinitializeRouteCalcState = () => {
  currentRoutePathCoordinates = [];
  Logger.info('[RouteCalculationService.ts] Module state explicitly re-initialized.');
};

reinitializeRouteCalcState(); // Initial call

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    Logger.info('[RouteCalculationService.ts] HMR disposing old instance.');
  });
  import.meta.hot.accept(() => {
    Logger.info('[RouteCalculationService.ts] HMR accept: Forcing state re-initialization.');
    reinitializeRouteCalcState();
  });
}

// Helper function to calculate distance between coordinates using haversine formula
// This is duplicated from WaypointManager for now if direct import is problematic,
// but ideally should be imported if WaypointManager's _haversine is made available,
// or moved to a shared util. For this step, assuming _haversine from WaypointManager is usable.

// Calculate and place kilometer markers along the route
const addKilometerMarkers = (map: MapboxMap, coordinates: Coordinate[]) => {
  if (!map || coordinates.length < 2) { // Removed map.getSource checks as MapLayerManager will handle it
    Logger.warn('[RCS/addKilometerMarkers] Map not available or not enough coords. Aborting.');
    return;
  }
  Logger.info('[RCS/addKilometerMarkers] Calculating kilometer markers...');
  const kmMarkerFeatures: GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>[] = []; // Typed correctly
  let distanceCovered = 0;
  let nextKmMarker = 1;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];
    const segmentDistance = haversine(start, end);
    while (distanceCovered + segmentDistance >= nextKmMarker && segmentDistance > 0) { // Added check for segmentDistance > 0
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
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [markerLng, markerLat] },
        properties: { km: `${nextKmMarker} km`, markerType: markerType }
      });
      nextKmMarker++;
    }
    distanceCovered += segmentDistance;
  }
  // Use MapLayerManager to update the layer
  updateKilometerMarkersLayer(map, kmMarkerFeatures);
  Logger.info(`[RCS/addKilometerMarkers] Updated ${kmMarkerFeatures.length} kilometer markers via MapLayerManager`);
};

// Clear kilometer markers from the map
const clearKilometerMarkers = (map: MapboxMap) => {
  // Use MapLayerManager to clear the layer
  clearKilometerMarkersLayer(map);
  Logger.info('[RCS/clearKilometerMarkers] Cleared kilometer markers via MapLayerManager');
};


// Build a route that includes both direct (as-the-crow-flies) and road segments
async function buildMixedRoute(
  accessToken: string,
  // waypoints and directFlags are now fetched inside if needed, or passed if they are guaranteed fresh.
  // For this iteration, this function will fetch them to ensure freshness for its calculations.
): Promise<{ coordsAccum: Coordinate[]; totalDist: number; waypointsUpdated: boolean; snappedWaypoints: Coordinate[] | null; snappedDirectFlags: boolean[] | null }> {
  const waypoints = getWaypoints();
  const directFlags = getDirectFlags();

  const coordsAccum: Coordinate[] = [];
  let totalDist = 0;
  let waypointsWereInternallyModified = false;

  // If these arrays are modified, they should be copied first to maintain const correctness for the references.
  const localWaypointsOriginal = waypoints.map(wp => [...wp] as Coordinate);
  const localDirectFlagsOriginal = [...directFlags];
  
  // Create working copies that can be modified
  const workingWaypoints = localWaypointsOriginal.map(wp => [...wp] as Coordinate);
  const workingDirectFlags = [...localDirectFlagsOriginal];

  for (let i = 0; i < workingWaypoints.length - 1; i++) {
    const from = workingWaypoints[i];
    const to = workingWaypoints[i + 1];

    if (workingDirectFlags[i + 1]) { // If the *segment leading to waypoint i+1* is direct
      if (coordsAccum.length === 0 || coordsAccum[coordsAccum.length - 1][0] !== from[0] || coordsAccum[coordsAccum.length - 1][1] !== from[1]) {
         coordsAccum.push(from);
      }
      coordsAccum.push(to);
      totalDist += haversine(from, to);
    } else {
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${from[0]},${from[1]};${to[0]},${to[1]}?` +
                 `steps=true&geometries=geojson&overview=full&access_token=${accessToken}&radiuses=150;150&continue_straight=true`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
            Logger.error(`[RCS/buildMixedRoute] API request failed with status ${res.status} for segment ${i}-${i+1}`);
            throw new Error(`API request failed: ${res.statusText}`);
        }
        const json = await res.json();
        if (json && json.routes && json.routes[0]) {
          const geom = json.routes[0].geometry.coordinates;
          const distKm = json.routes[0].distance / 1000;
          
          if (coordsAccum.length === 0 || coordsAccum[coordsAccum.length - 1][0] !== geom[0][0] || coordsAccum[coordsAccum.length - 1][1] !== geom[0][1]) {
            if(coordsAccum.length === 0 && geom.length > 0) coordsAccum.push(...geom);
            else if (geom.length > 0) coordsAccum.push(...geom.slice(1));
          } else if (geom.length > 1) {
            coordsAccum.push(...geom.slice(1));
          }

          totalDist += distKm;

          if (json.waypoints && json.waypoints.length === 2) {
            const newWp0 = json.waypoints[0].location as Coordinate;
            const newWp1 = json.waypoints[1].location as Coordinate;
            if (!workingDirectFlags[i] && (workingWaypoints[i][0] !== newWp0[0] || workingWaypoints[i][1] !== newWp0[1])) {
              Logger.info(`[RCS/buildMixedRoute] Snapping waypoint ${i} from ${workingWaypoints[i]} to ${newWp0}`);
              workingWaypoints[i] = newWp0;
              waypointsWereInternallyModified = true;
            }
            if (!workingDirectFlags[i+1] && (workingWaypoints[i+1][0] !== newWp1[0] || workingWaypoints[i+1][1] !== newWp1[1])) {
              Logger.info(`[RCS/buildMixedRoute] Snapping waypoint ${i+1} from ${workingWaypoints[i+1]} to ${newWp1}`);
              workingWaypoints[i+1] = newWp1;
              waypointsWereInternallyModified = true;
            }
          }
        } else {
          Logger.warn(`[RCS/buildMixedRoute] No route found or issue with API response for segment ${i}-${i+1}. Falling back to direct.`);
          if (!workingDirectFlags[i+1]) {
            workingDirectFlags[i+1] = true;
            waypointsWereInternallyModified = true;
          }
          if (coordsAccum.length === 0 || coordsAccum[coordsAccum.length - 1][0] !== from[0] || coordsAccum[coordsAccum.length - 1][1] !== from[1]) {
            coordsAccum.push(from);
          }
          coordsAccum.push(to);
          totalDist += haversine(from, to);
        }
      } catch(err) {
        Logger.warn(`[RCS/buildMixedRoute] Network error for segment ${i}-${i+1}, falling back to direct route: `, err);
        // Offline fallback: use direct route
        if (!workingDirectFlags[i+1]) {
            workingDirectFlags[i+1] = true;
            waypointsWereInternallyModified = true;
        }
        if (coordsAccum.length === 0 || coordsAccum[coordsAccum.length - 1][0] !== from[0] || coordsAccum[coordsAccum.length - 1][1] !== from[1]) {
          coordsAccum.push(from);
        }
        coordsAccum.push(to);
        totalDist += haversine(from, to);
      }
    }
  }
  if (waypointsWereInternallyModified) {
    Logger.info('[RCS/buildMixedRoute] Waypoints or directFlags were modified during mixed route calculation.');
    return { coordsAccum, totalDist, waypointsUpdated: true, snappedWaypoints: workingWaypoints, snappedDirectFlags: workingDirectFlags };
  }
  return { coordsAccum, totalDist, waypointsUpdated: false, snappedWaypoints: null, snappedDirectFlags: null };
}

// Define return type for getRoute
export interface RouteResult {
  success: boolean;
  waypointsSnapped: boolean;
  snappedWaypoints?: Coordinate[];
  snappedDirectFlags?: boolean[];
  error?: string; // Added optional error field
}

// Calculate and display a route between waypoints
export const getRoute = async (
  map: MapboxMap,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
): Promise<RouteResult> => {
  if (!map) { // Removed map.getSource check as MapLayerManager will handle it
    Logger.warn('[RCS/getRoute] Map is not available. Aborting.');
    return { success: false, waypointsSnapped: false };
  }

  clearKilometerMarkers(map); // This now uses MapLayerManager

  const waypoints = getWaypoints();
  const directFlags = getDirectFlags();
  let waypointsUpdatedBySnapping = false;
  let finalSnappedWaypoints: Coordinate[] | null = null;
  let finalSnappedDirectFlags: boolean[] | null = null;

  if (waypoints.length < 2) {
    updateRouteLayer(map, []); // Clear existing route using MapLayerManager
    currentRoutePathCoordinates = [];
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
    Logger.info('[RCS/getRoute] Not enough waypoints for a route.');
    return { success: true, waypointsSnapped: false }; // Success as in operation completed, no route but no error.
  }

  // Determine route type
  const isSegmentDirect = (index: number) => directFlags.length > index && directFlags[index];
  
  let allSegmentsDirect = true;
  for (let i = 1; i < waypoints.length; i++) { // Check segments from first waypoint to the end
    if (!isSegmentDirect(i)) {
      allSegmentsDirect = false;
      break;
    }
  }
  
  let allSegmentsRouted = true;
  for (let i = 1; i < waypoints.length; i++) {
    if (isSegmentDirect(i)) {
      allSegmentsRouted = false;
      break;
    }
  }
  
  const mixedSegments = !allSegmentsDirect && !allSegmentsRouted;

  if (allSegmentsDirect) {
    Logger.info('[RCS/getRoute] All segments are direct. Calculating straight lines.');
    currentRoutePathCoordinates = [];
    let cumulativeDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
        if (i === 0) currentRoutePathCoordinates.push(waypoints[i]);
        currentRoutePathCoordinates.push(waypoints[i+1]);
        cumulativeDistance += haversine(waypoints[i], waypoints[i+1]);
    }
    updateRouteLayer(map, currentRoutePathCoordinates);
    const duration = Math.round(cumulativeDistance / 5 * 60); // Assume 5 km/h average
    setRouteDistance(`${cumulativeDistance.toFixed(2)} km`);
    setRouteDuration(`${duration} min`);
    setHasRoute(true);
    addKilometerMarkers(map, currentRoutePathCoordinates);
    return { success: true, waypointsSnapped: false };
  }
  
  if (mixedSegments) { 
    Logger.info('[RCS/getRoute] Calculating mixed route (direct and routed segments).');
    const { coordsAccum, totalDist, waypointsUpdated, snappedWaypoints, snappedDirectFlags: mixedSnappedDirectFlags } = await buildMixedRoute(accessToken);
    updateRouteLayer(map, coordsAccum); 
    currentRoutePathCoordinates = coordsAccum;

    if (waypointsUpdated && snappedWaypoints && mixedSnappedDirectFlags) {
      waypointsUpdatedBySnapping = true;
      finalSnappedWaypoints = snappedWaypoints;
      finalSnappedDirectFlags = mixedSnappedDirectFlags; 
      Logger.info('[RCS/getRoute] buildMixedRoute indicates waypoints/flags were snapped.');
    }
    const duration = Math.round(totalDist / 5 * 60);
    setRouteDistance(`${totalDist.toFixed(2)} km`);
    setRouteDuration(`${duration} min`);
    setHasRoute(true);
    addKilometerMarkers(map, coordsAccum);
    return { success: true, waypointsSnapped: waypointsUpdatedBySnapping, snappedWaypoints: finalSnappedWaypoints ?? undefined, snappedDirectFlags: finalSnappedDirectFlags ?? undefined };
  }

  // Fallback: All segments are to be routed via Mapbox Directions API (allSegmentsRouted should be true here)
  if (allSegmentsRouted) { // Explicitly check for clarity, though it's the remaining case for >=2 waypoints
    try {
      Logger.info('[RCS/getRoute] Calculating route using Mapbox Directions API for all segments.');
      const currentWaypointsForAPI = [...waypoints]; // Use a snapshot for the API call
      const waypointsString = currentWaypointsForAPI.map(point => `${point[0]},${point[1]}`).join(';');
      const radiusesString = currentWaypointsForAPI.map(() => '150').join(';'); // Keep generous radius for snapping
      const queryUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${waypointsString}?` +
                      `steps=true&geometries=geojson&overview=full&continue_straight=true&` +
                      `access_token=${accessToken}&radiuses=${radiusesString}`;

      const response = await fetch(queryUrl, { method: 'GET' });
      if (!response.ok) {
        Logger.error(`[RCS/getRoute] API request failed with status ${response.status}`);
        throw new Error(`API request failed: ${response.statusText}`);
      }

      // Check if this is an offline route from service worker
      const isOfflineRoute = response.headers.get('X-Offline-Route') === 'true';
      if (isOfflineRoute) {
        Logger.info('[RCS/getRoute] Using offline route from service worker');
      }

      const json = await response.json();

      if (!json || !json.routes || json.routes.length === 0 || !json.routes[0].geometry) {
        Logger.error('[RCS/getRoute] Invalid API response or no route geometry. Response:', json);
        setHasRoute(false);
        updateRouteLayer(map, []); // Clear route on map
        currentRoutePathCoordinates = [];
        return { success: false, waypointsSnapped: false };
      }
      const data = json.routes[0];
      currentRoutePathCoordinates = data.geometry.coordinates;
      updateRouteLayer(map, currentRoutePathCoordinates); // Use MapLayerManager

      if (json.waypoints && Array.isArray(json.waypoints)) {
        const apiSnappedWaypoints = json.waypoints.map((wp: { location: Coordinate }) => wp.location);
        if (apiSnappedWaypoints.length === currentWaypointsForAPI.length) {
          const currentGlobalWaypoints = getWaypoints(); // Fetch fresh global waypoints
          const isContextStillValid = currentGlobalWaypoints.length === currentWaypointsForAPI.length &&
                                  currentGlobalWaypoints.every((gwp, idx) => 
                                      gwp[0] === currentWaypointsForAPI[idx][0] && gwp[1] === currentWaypointsForAPI[idx][1]
                                  );

          if (!isContextStillValid) {
            Logger.info('[RCS/getRoute] Global waypoints changed during API call. Discarding API snapping.');
          } else {
            let actualChangeMadeBySnapping = false;
            const newSnappedWaypoints = [...currentGlobalWaypoints]; // Start with current global state

            for (let i = 0; i < currentGlobalWaypoints.length; i++) {
              // Only snap if the waypoint is NOT marked as direct
              if (!directFlags[i] && 
                  (currentGlobalWaypoints[i][0] !== apiSnappedWaypoints[i][0] || 
                   currentGlobalWaypoints[i][1] !== apiSnappedWaypoints[i][1])) {
                Logger.info(`[RCS/getRoute] API Snapping waypoint ${i} from ${currentGlobalWaypoints[i]} to ${apiSnappedWaypoints[i]}`);
                newSnappedWaypoints[i] = apiSnappedWaypoints[i];
                actualChangeMadeBySnapping = true;
              }
            }
            if (actualChangeMadeBySnapping) {
              waypointsUpdatedBySnapping = true;
              finalSnappedWaypoints = newSnappedWaypoints;
              finalSnappedDirectFlags = [...directFlags]; // Direct flags don't change from this type of snapping
              Logger.info('[RCS/getRoute] Mapbox API snapping indicates waypoints were modified.');
              // DO NOT call updatePoints or save here. Return info to caller.
            }
          }
        }
      }

      const distance = data.distance / 1000;
      const duration = Math.round(data.duration / 60);
      const offlineIndicator = isOfflineRoute ? ' (offline)' : '';
      setRouteDistance(`${distance.toFixed(2)} km${offlineIndicator}`);
      setRouteDuration(`${duration} min${isOfflineRoute ? ' (estimated)' : ''}`);
      setHasRoute(true);
      addKilometerMarkers(map, currentRoutePathCoordinates); // Uses MapLayerManager

      return { success: true, waypointsSnapped: waypointsUpdatedBySnapping, snappedWaypoints: finalSnappedWaypoints ?? undefined, snappedDirectFlags: finalSnappedDirectFlags ?? undefined };

    } catch (error) {
      Logger.warn('[RCS/getRoute] Network error fetching route, falling back to direct routes:', error);
      
      // Offline fallback: Convert all segments to direct routes
      Logger.info('[RCS/getRoute] Converting to direct routes for offline use');
      currentRoutePathCoordinates = [];
      let cumulativeDistance = 0;
      
      for (let i = 0; i < waypoints.length - 1; i++) {
        if (i === 0) currentRoutePathCoordinates.push(waypoints[i]);
        currentRoutePathCoordinates.push(waypoints[i+1]);
        cumulativeDistance += haversine(waypoints[i], waypoints[i+1]);
      }
      
      updateRouteLayer(map, currentRoutePathCoordinates);
      const duration = Math.round(cumulativeDistance / 5 * 60); // Assume 5 km/h average
      setRouteDistance(`${cumulativeDistance.toFixed(2)} km (offline)`);
      setRouteDuration(`${duration} min (estimated)`);
      setHasRoute(true);
      addKilometerMarkers(map, currentRoutePathCoordinates);
      
      return { success: true, waypointsSnapped: false, error: 'Using offline direct routes' };
    }
  }
  
  // Should not be reached if logic is correct for waypoints.length >= 2
  Logger.warn('[RCS/getRoute] Unhandled routing condition. Waypoints:', waypoints.length, 'Flags:', JSON.stringify(directFlags));
  updateRouteLayer(map, []); 
  currentRoutePathCoordinates = [];
  setRouteDistance('');
  setRouteDuration('');
  setHasRoute(false);
  return { success: false, waypointsSnapped: false, error: "Unhandled routing condition" };
};

// Function to get the current route path (for GPX export, etc.)
export const getCurrentRoutePath = (): Coordinate[] => {
  return [...currentRoutePathCoordinates]; // Return a copy to prevent external modification
};

// Function to clear the current route path (e.g. when route is cleared in routing.ts)
export const clearCurrentRoutePath = (): void => {
  currentRoutePathCoordinates = [];
  Logger.info('[RouteCalculationService] Cleared currentRoutePathCoordinates.');
};


// --- New A-to-B Route Calculation Function ---
export async function calculateAtoBRoute(
  startCoord: Coordinate,
  endCoord: Coordinate,
  accessToken: string,
  surfaceType: 'paved' | 'mixed' | 'unpaved'
): Promise<Partial<RouteResult & { geometry?: Coordinate[], distance?: number, duration?: number }>> {
  let profile = 'mapbox/cycling'; // Default profile

  if (surfaceType === 'paved') {
    profile = 'mapbox/driving-traffic'; 
    Logger.info(`[RCS/calculateAtoBRoute] Using '${profile}' for 'paved' surface type.`);
  } else if (surfaceType === 'mixed') {
    profile = 'mapbox/cycling';
    Logger.info(`[RCS/calculateAtoBRoute] Using '${profile}' for 'mixed' surface type.`);
  } else if (surfaceType === 'unpaved') {
    profile = 'mapbox/walking'; 
    Logger.warn(`[RCS/calculateAtoBRoute] 'unpaved' surface type selected. Using '${profile}' profile. This may result in slower estimated times and routes more suited for walking/hiking.`);
  }

  const coordinates = `${startCoord[0]},${startCoord[1]};${endCoord[0]},${endCoord[1]}`;
  const apiUrl = `https://api.mapbox.com/directions/v5/${profile}/${coordinates}?overview=full&geometries=geojson&steps=true&access_token=${accessToken}`;

  Logger.info(`[RCS/calculateAtoBRoute] Fetching A-to-B route from: ${apiUrl.replace(accessToken, "<REDACTED_TOKEN>")}`);

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      const errorMessage = errorData.message || `API request failed with status ${response.status}`;
      Logger.error(`[RCS/calculateAtoBRoute] API error: ${errorMessage}`, errorData);
      return { success: false, error: errorMessage };
    }

    // Check if this is an offline route from service worker
    const isOfflineRoute = response.headers.get('X-Offline-Route') === 'true';
    if (isOfflineRoute) {
      Logger.info('[RCS/calculateAtoBRoute] Using offline route from service worker');
    }

    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const geometry = route.geometry.coordinates as Coordinate[];
      const distance = route.distance; // in meters
      const duration = route.duration; // in seconds

      Logger.info(`[RCS/calculateAtoBRoute] Route found: Distance=${(distance/1000).toFixed(2)}km, Duration=${(duration/60).toFixed(1)}min`);
      currentRoutePathCoordinates = [...geometry]; // Update module-level path

      return {
        success: true,
        geometry,
        distance,
        duration,
      };
    } else {
      const noRouteMessage = data.message || 'No route found between the specified points.';
      Logger.warn(`[RCS/calculateAtoBRoute] No route found: ${noRouteMessage}`);
      return { success: false, error: noRouteMessage };
    }
  } catch (error) {
    Logger.warn('[RCS/calculateAtoBRoute] Network error, falling back to direct route:', error);
    
    // Offline fallback: Create a direct route
    const directGeometry: Coordinate[] = [startCoord, endCoord];
    const directDistance = haversine(startCoord, endCoord) * 1000; // Convert to meters
    const directDuration = Math.round((directDistance / 1000) / 5 * 60 * 60); // 5 km/h in seconds
    
    Logger.info(`[RCS/calculateAtoBRoute] Using direct route: Distance=${(directDistance/1000).toFixed(2)}km, Duration=${(directDuration/60).toFixed(1)}min`);
    currentRoutePathCoordinates = [...directGeometry];
    
    return {
      success: true,
      geometry: directGeometry,
      distance: directDistance,
      duration: directDuration,
      error: 'Using offline direct route'
    };
  }
} 