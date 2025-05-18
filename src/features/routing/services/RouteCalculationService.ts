import type { Dispatch, SetStateAction } from 'react';
import type { Coordinate } from '@/types/map';
import type { Map as MapboxMap } from 'mapbox-gl';
import { getWaypoints, getDirectFlags } from '@/features/routing/managers/WaypointManager';
import { haversine } from '@/features/routing/utils/RoutingUtils';
// Removed import { saveWaypointsToLocalStorage as saveWaypointsToStorage } from '@/features/routing/services/LocalStorageService';
// Import updatePoints from routing.ts - this creates a temporary circular dependency risk,
// or indicates updatePoints might need to be moved/become more generic.
// For now, this will likely cause issues if not handled carefully or if routing.ts also imports this service.
// A better approach would be a callback or moving updatePoints to a shared util or MapDisplayService.
// import { updatePoints } from '@/lib/routing'; // Placeholder: This import might need to be re-evaluated

// Import from MapLayerManager
import {
  updateRouteLayer,
  updateKilometerMarkersLayer,
  clearKilometerMarkersLayer
} from '@/features/routing/managers/MapLayerManager';

// Module-level state for the detailed path, similar to how it was in routing.ts
let currentRoutePathCoordinates: Coordinate[] = [];

// Helper function to calculate distance between coordinates using haversine formula
// This is duplicated from WaypointManager for now if direct import is problematic,
// but ideally should be imported if WaypointManager's _haversine is made available,
// or moved to a shared util. For this step, assuming _haversine from WaypointManager is usable.

// Calculate and place kilometer markers along the route
const addKilometerMarkers = (map: MapboxMap, coordinates: Coordinate[]) => {
  if (!map || coordinates.length < 2) { // Removed map.getSource checks as MapLayerManager will handle it
    console.warn('[RCS/addKilometerMarkers] Map not available or not enough coords. Aborting.');
    return;
  }
  console.log('[RCS/addKilometerMarkers] Calculating kilometer markers...');
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
      kmMarkerFeatures.push({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [markerLng, markerLat] },
        properties: { km: `${nextKmMarker} km` }
      });
      nextKmMarker++;
    }
    distanceCovered += segmentDistance;
  }
  // Use MapLayerManager to update the layer
  updateKilometerMarkersLayer(map, kmMarkerFeatures);
  console.log(`[RCS/addKilometerMarkers] Updated ${kmMarkerFeatures.length} kilometer markers via MapLayerManager`);
};

// Clear kilometer markers from the map
const clearKilometerMarkers = (map: MapboxMap) => {
  // Use MapLayerManager to clear the layer
  clearKilometerMarkersLayer(map);
  console.log('[RCS/clearKilometerMarkers] Cleared kilometer markers via MapLayerManager');
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
            console.error(`[RCS/buildMixedRoute] API request failed with status ${res.status} for segment ${i}-${i+1}`);
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
            if (!directFlags[i] && (workingWaypoints[i][0] !== newWp0[0] || workingWaypoints[i][1] !== newWp0[1])) {
              console.log(`[RCS/buildMixedRoute] Snapping waypoint ${i} from ${workingWaypoints[i]} to ${newWp0}`);
              workingWaypoints[i] = newWp0;
              waypointsWereInternallyModified = true;
            }
            if (!directFlags[i+1] && (workingWaypoints[i+1][0] !== newWp1[0] || workingWaypoints[i+1][1] !== newWp1[1])) {
              console.log(`[RCS/buildMixedRoute] Snapping waypoint ${i+1} from ${workingWaypoints[i+1]} to ${newWp1}`);
              workingWaypoints[i+1] = newWp1;
              waypointsWereInternallyModified = true;
            }
          }
        } else {
          console.warn(`[RCS/buildMixedRoute] No route found or issue with API response for segment ${i}-${i+1}. Falling back to direct.`);
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
        console.error(`[RCS/buildMixedRoute] Error fetching segment ${i}-${i+1}: `, err);
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
    console.log('[RCS/buildMixedRoute] Waypoints or directFlags were modified during mixed route calculation.');
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
    console.warn('[RCS/getRoute] Map is not available. Aborting.');
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
    console.log('[RCS/getRoute] Not enough waypoints for a route.');
    return { success: true, waypointsSnapped: false }; // Success as in operation completed, no route but no error.
  }

  // Check if any segment requires routing (i.e., not all segments are direct)
  // A segment is direct if the TO waypoint of that segment is marked direct.
  // So, if any directFlag from index 1 onwards is false, we need routing.
  const requiresApiRouting = directFlags.slice(1).some(flag => !flag);

  if (!requiresApiRouting && waypoints.length >=2 ) { // All segments are direct lines
    console.log('[RCS/getRoute] All segments are direct. Calculating straight lines.');
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
  
  // If any segment is NOT direct, or if mixed routing is implicitly preferred.
  // The original code had a directFlags.some(Boolean) check which seems to imply mixed routing if ANY direct flag is true.
  // Let's refine this: if there's a mix of direct and non-direct segments, or all non-direct.
  // The `buildMixedRoute` handles segments based on `directFlags[i+1]`.
  if (directFlags.slice(1).some(flag => flag) || directFlags.slice(1).some(flag => !flag)) { // If there is a mix, or all are non-direct but we want Mapbox directions
    console.log('[RCS/getRoute] Calculating mixed route (direct and routed segments).');
    const { coordsAccum, totalDist, waypointsUpdated, snappedWaypoints, snappedDirectFlags } = await buildMixedRoute(accessToken);
    updateRouteLayer(map, coordsAccum); // Use MapLayerManager
    currentRoutePathCoordinates = coordsAccum;

    if (waypointsUpdated && snappedWaypoints && snappedDirectFlags) {
      // Signal that waypoints were updated by buildMixedRoute
      waypointsUpdatedBySnapping = true;
      finalSnappedWaypoints = snappedWaypoints;
      finalSnappedDirectFlags = snappedDirectFlags;
      // DO NOT call updatePoints or saveWaypointsToStorage here.
      // Let routing.ts handle it based on the return value.
      console.log('[RCS/getRoute] buildMixedRoute indicates waypoints/flags were snapped.');
    }
    const duration = Math.round(totalDist / 5 * 60);
    setRouteDistance(`${totalDist.toFixed(2)} km`);
    setRouteDuration(`${duration} min`);
    setHasRoute(true);
    addKilometerMarkers(map, coordsAccum); // Uses MapLayerManager
    return { success: true, waypointsSnapped: waypointsUpdatedBySnapping, snappedWaypoints: finalSnappedWaypoints ?? undefined, snappedDirectFlags: finalSnappedDirectFlags ?? undefined };
  }

  // Fallback or standard Mapbox Directions API call for all segments (if not handled by mixed route logic)
  try {
    console.log('[RCS/getRoute] Calculating route using Mapbox Directions API for all segments.');
    const currentWaypointsForAPI = [...waypoints];
    const waypointsString = currentWaypointsForAPI.map(point => `${point[0]},${point[1]}`).join(';');
    const radiusesString = currentWaypointsForAPI.map(() => '150').join(';'); // Keep generous radius for snapping
    const queryUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${waypointsString}?` +
                    `steps=true&geometries=geojson&overview=full&continue_straight=true&` +
                    `access_token=${accessToken}&radiuses=${radiusesString}`;

    const query = await fetch(queryUrl, { method: 'GET' });
    const json = await query.json();

    if (!json || !json.routes || json.routes.length === 0 || !json.routes[0].geometry) {
      console.error('[RCS/getRoute] Invalid API response or no route geometry. Response:', json);
      setHasRoute(false);
      updateRouteLayer(map, []); // Clear route on map
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
          console.log('[RCS/getRoute] Global waypoints changed during API call. Discarding API snapping.');
        } else {
          let actualChangeMadeBySnapping = false;
          const newSnappedWaypoints = [...currentGlobalWaypoints]; // Start with current global state

          for (let i = 0; i < currentGlobalWaypoints.length; i++) {
            // Only snap if the waypoint is NOT marked as direct
            if (!directFlags[i] && 
                (currentGlobalWaypoints[i][0] !== apiSnappedWaypoints[i][0] || 
                 currentGlobalWaypoints[i][1] !== apiSnappedWaypoints[i][1])) {
              console.log(`[RCS/getRoute] API Snapping waypoint ${i} from ${currentGlobalWaypoints[i]} to ${apiSnappedWaypoints[i]}`);
              newSnappedWaypoints[i] = apiSnappedWaypoints[i];
              actualChangeMadeBySnapping = true;
            }
          }
          if (actualChangeMadeBySnapping) {
            waypointsUpdatedBySnapping = true;
            finalSnappedWaypoints = newSnappedWaypoints;
            finalSnappedDirectFlags = [...directFlags]; // Direct flags don't change from this type of snapping
            console.log('[RCS/getRoute] Mapbox API snapping indicates waypoints were modified.');
            // DO NOT call updatePoints or save here. Return info to caller.
          }
        }
      }
    }

    const distance = data.distance / 1000;
    const duration = Math.round(data.duration / 60);
    setRouteDistance(`${distance.toFixed(2)} km`);
    setRouteDuration(`${duration} min`);
    setHasRoute(true);
    addKilometerMarkers(map, currentRoutePathCoordinates); // Uses MapLayerManager

    return { success: true, waypointsSnapped: waypointsUpdatedBySnapping, snappedWaypoints: finalSnappedWaypoints ?? undefined, snappedDirectFlags: finalSnappedDirectFlags ?? undefined };

  } catch (error) {
    console.error('[RCS/getRoute] Error fetching route:', error);
    setHasRoute(false);
    updateRouteLayer(map, []); // Clear route on map
    currentRoutePathCoordinates = [];
    return { success: false, waypointsSnapped: false };
  }
};

// Function to get the current route path (for GPX export, etc.)
export const getCurrentRoutePath = (): Coordinate[] => {
    return currentRoutePathCoordinates;
};

// Function to clear the current route path (e.g. when route is cleared in routing.ts)
export const clearCurrentRoutePath = (): void => {
    currentRoutePathCoordinates = [];
}; 