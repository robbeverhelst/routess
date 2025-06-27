import type { Dispatch, SetStateAction } from "react";
import type { Coordinate } from "@maps/core";
import type { Map as MapboxMap } from "mapbox-gl";
import { useRoutingStore } from "@/stores/routingStore";
import { haversineDistance, estimateWalkingDuration } from "@maps/core";
import { formatDistance, formatDuration } from "@maps/core";
import { getDirections } from "@/lib/utils/mapbox-api";
import { Logger } from "@/lib/logger";

// Import from MapLayerManager
import {
  updateRouteLayer,
  updateKilometerMarkersLayer,
  clearKilometerMarkersLayer,
} from "@/features/routing/managers/MapLayerManager";

// Module-level state for the detailed path, similar to how it was in routing.ts
let currentRoutePathCoordinates: Coordinate[] = [];

// Helper function to update both module state and Zustand store
// This ensures route path coordinates stay synchronized between both systems
const setCurrentRoutePathCoordinates = (newCoordinates: Coordinate[]) => {
  currentRoutePathCoordinates = newCoordinates;
  // Keep Zustand store in sync for persistence across page refreshes
  useRoutingStore.getState().setRoutePath(newCoordinates);
};

const reinitializeRouteCalcState = () => {
  // On initialization, sync with Zustand store if it has data
  const storedRoutePath = useRoutingStore.getState().routePath;
  if (storedRoutePath && storedRoutePath.length > 0) {
    currentRoutePathCoordinates = storedRoutePath;
  } else {
    setCurrentRoutePathCoordinates([]);
  }
};

reinitializeRouteCalcState(); // Initial call

// Hot Module Reloading support (development only)
try {
  const importMeta = (globalThis as any).import?.meta;
  if (importMeta && importMeta.hot) {
    importMeta.hot.dispose(() => {
      // HMR cleanup
    });
    importMeta.hot.accept(() => {
      reinitializeRouteCalcState();
    });
  }
} catch {
  // HMR not available (test/production environment)
}

// Helper function to calculate distance between coordinates using haversine formula
// This is duplicated from WaypointManager for now if direct import is problematic,
// but ideally should be imported if WaypointManager's _haversine is made available,
// or moved to a shared util. For this step, assuming _haversine from WaypointManager is usable.

// Calculate and place kilometer markers along the route
const addKilometerMarkers = (map: MapboxMap, coordinates: Coordinate[]) => {
  if (!map || coordinates.length < 2) {
    // Removed map.getSource checks as MapLayerManager will handle it
    Logger.warn("[RCS/addKilometerMarkers] Map not available or not enough coords. Aborting.");
    return;
  }
  Logger.info("[RCS/addKilometerMarkers] Calculating kilometer markers...");
  const kmMarkerFeatures: GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>[] = []; // Typed correctly
  let distanceCovered = 0;
  let nextKmMarker = 1;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];
    const segmentDistance = haversineDistance(start, end);
    while (distanceCovered + segmentDistance >= nextKmMarker && segmentDistance > 0) {
      // Added check for segmentDistance > 0
      const segmentFraction = (nextKmMarker - distanceCovered) / segmentDistance;
      const markerLng = start[0] + segmentFraction * (end[0] - start[0]);
      const markerLat = start[1] + segmentFraction * (end[1] - start[1]);

      let markerType: "major" | "medium" | "minor";
      if (nextKmMarker % 10 === 0) {
        markerType = "major";
      } else if (nextKmMarker % 5 === 0) {
        markerType = "medium";
      } else {
        markerType = "minor";
      }

      kmMarkerFeatures.push({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [markerLng, markerLat] },
        properties: { km: `${nextKmMarker} km`, markerType: markerType },
      });
      nextKmMarker++;
    }
    distanceCovered += segmentDistance;
  }
  // Use MapLayerManager to update the layer
  updateKilometerMarkersLayer(map, kmMarkerFeatures);
  Logger.info(
    `[RCS/addKilometerMarkers] Updated ${kmMarkerFeatures.length} kilometer markers via MapLayerManager`,
  );
};

// Clear kilometer markers from the map
const clearKilometerMarkers = (map: MapboxMap) => {
  // Use MapLayerManager to clear the layer
  clearKilometerMarkersLayer(map);
  Logger.info("[RCS/clearKilometerMarkers] Cleared kilometer markers via MapLayerManager");
};

// Build a route that includes both direct (as-the-crow-flies) and road segments
async function buildMixedRoute(
  accessToken: string,
  // waypoints and directFlags are now fetched inside if needed, or passed if they are guaranteed fresh.
  // For this iteration, this function will fetch them to ensure freshness for its calculations.
): Promise<{
  coordsAccum: Coordinate[];
  totalDist: number;
  waypointsUpdated: boolean;
  snappedWaypoints: Coordinate[] | null;
  snappedDirectFlags: boolean[] | null;
}> {
  const waypoints = useRoutingStore.getState().waypoints;
  const directFlags = useRoutingStore.getState().directFlags;

  const coordsAccum: Coordinate[] = [];
  let totalDist = 0;
  let waypointsWereInternallyModified = false;

  // If these arrays are modified, they should be copied first to maintain const correctness for the references.
  const localWaypointsOriginal = waypoints.map((wp) => [...wp] as Coordinate);
  const localDirectFlagsOriginal = [...directFlags];

  // Create working copies that can be modified
  const workingWaypoints = localWaypointsOriginal.map((wp) => [...wp] as Coordinate);
  const workingDirectFlags = [...localDirectFlagsOriginal];

  for (let i = 0; i < workingWaypoints.length - 1; i++) {
    const from = workingWaypoints[i];
    const to = workingWaypoints[i + 1];

    if (workingDirectFlags[i + 1]) {
      // If the *segment leading to waypoint i+1* is direct
      if (
        coordsAccum.length === 0 ||
        coordsAccum[coordsAccum.length - 1][0] !== from[0] ||
        coordsAccum[coordsAccum.length - 1][1] !== from[1]
      ) {
        coordsAccum.push(from);
      }
      coordsAccum.push(to);
      totalDist += haversineDistance(from, to);
    } else {
      const result = await getDirections([from, to], accessToken, {
        radius: 150,
        continueStraight: true,
      });

      if (result.success && result.data?.routes && result.data.routes[0]) {
        const json = result.data;
        const geom = json.routes[0].geometry.coordinates;
        const distKm = json.routes[0].distance / 1000;

        if (
          coordsAccum.length === 0 ||
          coordsAccum[coordsAccum.length - 1][0] !== geom[0][0] ||
          coordsAccum[coordsAccum.length - 1][1] !== geom[0][1]
        ) {
          if (coordsAccum.length === 0 && geom.length > 0) coordsAccum.push(...geom);
          else if (geom.length > 0) coordsAccum.push(...geom.slice(1));
        } else if (geom.length > 1) {
          coordsAccum.push(...geom.slice(1));
        }

        totalDist += distKm;

        if (json.waypoints && json.waypoints.length === 2) {
          const newWp0 = json.waypoints[0].location as Coordinate;
          const newWp1 = json.waypoints[1].location as Coordinate;
          if (
            !workingDirectFlags[i] &&
            (workingWaypoints[i][0] !== newWp0[0] || workingWaypoints[i][1] !== newWp0[1])
          ) {
            Logger.info(
              `[RCS/buildMixedRoute] Snapping waypoint ${i} from ${workingWaypoints[i]} to ${newWp0}`,
            );
            workingWaypoints[i] = newWp0;
            waypointsWereInternallyModified = true;
          }
          if (
            !workingDirectFlags[i + 1] &&
            (workingWaypoints[i + 1][0] !== newWp1[0] || workingWaypoints[i + 1][1] !== newWp1[1])
          ) {
            Logger.info(
              `[RCS/buildMixedRoute] Snapping waypoint ${i + 1} from ${workingWaypoints[i + 1]} to ${newWp1}`,
            );
            workingWaypoints[i + 1] = newWp1;
            waypointsWereInternallyModified = true;
          }
        }
      } else {
        Logger.warn(
          `[RCS/buildMixedRoute] No route found or API error for segment ${i}-${i + 1}: ${result.error || "Unknown error"}. Falling back to direct.`,
        );
        if (!workingDirectFlags[i + 1]) {
          workingDirectFlags[i + 1] = true;
          waypointsWereInternallyModified = true;
        }
        if (
          coordsAccum.length === 0 ||
          coordsAccum[coordsAccum.length - 1][0] !== from[0] ||
          coordsAccum[coordsAccum.length - 1][1] !== from[1]
        ) {
          coordsAccum.push(from);
        }
        coordsAccum.push(to);
        totalDist += haversineDistance(from, to);
      }
    }
  }
  if (waypointsWereInternallyModified) {
    Logger.info(
      "[RCS/buildMixedRoute] Waypoints or directFlags were modified during mixed route calculation.",
    );
    return {
      coordsAccum,
      totalDist,
      waypointsUpdated: true,
      snappedWaypoints: workingWaypoints,
      snappedDirectFlags: workingDirectFlags,
    };
  }
  return {
    coordsAccum,
    totalDist,
    waypointsUpdated: false,
    snappedWaypoints: null,
    snappedDirectFlags: null,
  };
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
  setHasRoute: Dispatch<SetStateAction<boolean>>,
): Promise<RouteResult> => {
  if (!map) {
    // Removed map.getSource check as MapLayerManager will handle it
    Logger.warn("[RCS/getRoute] Map is not available. Aborting.");
    return { success: false, waypointsSnapped: false };
  }

  clearKilometerMarkers(map); // This now uses MapLayerManager

  const waypoints = useRoutingStore.getState().waypoints;
  const directFlags = useRoutingStore.getState().directFlags;
  let waypointsUpdatedBySnapping = false;
  let finalSnappedWaypoints: Coordinate[] | null = null;
  let finalSnappedDirectFlags: boolean[] | null = null;

  if (waypoints.length < 2) {
    updateRouteLayer(map, []); // Clear existing route using MapLayerManager
    setCurrentRoutePathCoordinates([]);
    setRouteDistance("");
    setRouteDuration("");
    setHasRoute(false);
    Logger.info("[RCS/getRoute] Not enough waypoints for a route.");
    return { success: true, waypointsSnapped: false }; // Success as in operation completed, no route but no error.
  }

  // Determine route type
  const isSegmentDirect = (index: number) => directFlags.length > index && directFlags[index];

  let allSegmentsDirect = true;
  for (let i = 1; i < waypoints.length; i++) {
    // Check segments from first waypoint to the end
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
    Logger.info("[RCS/getRoute] All segments are direct. Calculating straight lines.");
    const routeCoordinates: Coordinate[] = [];
    let cumulativeDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      if (i === 0) routeCoordinates.push(waypoints[i]);
      routeCoordinates.push(waypoints[i + 1]);
      cumulativeDistance += haversineDistance(waypoints[i], waypoints[i + 1]);
    }
    setCurrentRoutePathCoordinates(routeCoordinates);
    updateRouteLayer(map, routeCoordinates);
    const duration = estimateWalkingDuration(cumulativeDistance);
    setRouteDistance(formatDistance(cumulativeDistance));
    setRouteDuration(formatDuration(duration));
    setHasRoute(true);
    addKilometerMarkers(map, routeCoordinates);
    return { success: true, waypointsSnapped: false };
  }

  if (mixedSegments) {
    Logger.info("[RCS/getRoute] Calculating mixed route (direct and routed segments).");
    const {
      coordsAccum,
      totalDist,
      waypointsUpdated,
      snappedWaypoints,
      snappedDirectFlags: mixedSnappedDirectFlags,
    } = await buildMixedRoute(accessToken);
    updateRouteLayer(map, coordsAccum);
    setCurrentRoutePathCoordinates(coordsAccum);

    if (waypointsUpdated && snappedWaypoints && mixedSnappedDirectFlags) {
      waypointsUpdatedBySnapping = true;
      finalSnappedWaypoints = snappedWaypoints;
      finalSnappedDirectFlags = mixedSnappedDirectFlags;
      Logger.info("[RCS/getRoute] buildMixedRoute indicates waypoints/flags were snapped.");
    }
    const duration = estimateWalkingDuration(totalDist);
    setRouteDistance(formatDistance(totalDist));
    setRouteDuration(formatDuration(duration));
    setHasRoute(true);
    addKilometerMarkers(map, coordsAccum);
    return {
      success: true,
      waypointsSnapped: waypointsUpdatedBySnapping,
      snappedWaypoints: finalSnappedWaypoints ?? undefined,
      snappedDirectFlags: finalSnappedDirectFlags ?? undefined,
    };
  }

  // Fallback: All segments are to be routed via Mapbox Directions API (allSegmentsRouted should be true here)
  if (allSegmentsRouted) {
    // Explicitly check for clarity, though it's the remaining case for >=2 waypoints
    try {
      Logger.info("[RCS/getRoute] Calculating route using Mapbox Directions API for all segments.");
      const currentWaypointsForAPI = [...waypoints]; // Use a snapshot for the API call

      const result = await getDirections(currentWaypointsForAPI, accessToken, {
        radius: 150, // Keep generous radius for snapping
        continueStraight: true,
      });

      if (!result.success || !result.data?.routes || result.data.routes.length === 0) {
        Logger.error("[RCS/getRoute] API request failed or no routes found:", result.error);
        setHasRoute(false);
        updateRouteLayer(map, []); // Clear route on map
        setCurrentRoutePathCoordinates([]);
        return { success: false, waypointsSnapped: false, error: result.error };
      }

      const json = result.data;
      // Note: Offline detection would need to be handled in the mapbox-api utility
      // For now, we'll assume all successful requests are online
      const isOfflineRoute = false;
      const data = json.routes[0];
      setCurrentRoutePathCoordinates(data.geometry.coordinates);
      updateRouteLayer(map, data.geometry.coordinates); // Use MapLayerManager

      if (json.waypoints && Array.isArray(json.waypoints)) {
        const apiSnappedWaypoints = json.waypoints.map(
          (wp: { location: Coordinate }) => wp.location,
        );
        if (apiSnappedWaypoints.length === currentWaypointsForAPI.length) {
          const currentGlobalWaypoints = useRoutingStore.getState().waypoints; // Fetch fresh global waypoints
          const isContextStillValid =
            currentGlobalWaypoints.length === currentWaypointsForAPI.length &&
            currentGlobalWaypoints.every(
              (gwp, idx) =>
                gwp[0] === currentWaypointsForAPI[idx][0] &&
                gwp[1] === currentWaypointsForAPI[idx][1],
            );

          if (!isContextStillValid) {
            Logger.info(
              "[RCS/getRoute] Global waypoints changed during API call. Discarding API snapping.",
            );
          } else {
            let actualChangeMadeBySnapping = false;
            const newSnappedWaypoints = [...currentGlobalWaypoints]; // Start with current global state

            for (let i = 0; i < currentGlobalWaypoints.length; i++) {
              // Only snap if the waypoint is NOT marked as direct
              if (
                !directFlags[i] &&
                (currentGlobalWaypoints[i][0] !== apiSnappedWaypoints[i][0] ||
                  currentGlobalWaypoints[i][1] !== apiSnappedWaypoints[i][1])
              ) {
                Logger.info(
                  `[RCS/getRoute] API Snapping waypoint ${i} from ${currentGlobalWaypoints[i]} to ${apiSnappedWaypoints[i]}`,
                );
                newSnappedWaypoints[i] = apiSnappedWaypoints[i];
                actualChangeMadeBySnapping = true;
              }
            }
            if (actualChangeMadeBySnapping) {
              waypointsUpdatedBySnapping = true;
              finalSnappedWaypoints = newSnappedWaypoints;
              finalSnappedDirectFlags = [...directFlags]; // Direct flags don't change from this type of snapping
              Logger.info("[RCS/getRoute] Mapbox API snapping indicates waypoints were modified.");
              // DO NOT call updatePoints or save here. Return info to caller.
            }
          }
        }
      }

      const distance = data.distance / 1000;
      const duration = Math.round(data.duration / 60);
      const offlineIndicator = isOfflineRoute ? " (offline)" : "";
      setRouteDistance(formatDistance(distance) + offlineIndicator);
      setRouteDuration(formatDuration(duration) + (isOfflineRoute ? " (estimated)" : ""));
      setHasRoute(true);
      addKilometerMarkers(map, currentRoutePathCoordinates); // Uses MapLayerManager

      // If this is a fresh online route (not from cache), precache it for offline use
      if (!isOfflineRoute && "serviceWorker" in navigator) {
        try {
          // Send route data to service worker for enhanced caching
          navigator.serviceWorker.ready.then((registration) => {
            if (registration.active) {
              registration.active.postMessage({
                type: "PRECACHE_ROUTE",
                data: {
                  routeData: {
                    waypoints: waypoints,
                    geometry: currentRoutePathCoordinates,
                    distance: data.distance,
                    duration: data.duration,
                    url: `directions_api_request_${Date.now()}`,
                  },
                },
              });
              Logger.info("[RCS/getRoute] Route data sent to service worker for enhanced caching");
            }
          });
        } catch (error) {
          Logger.warn("[RCS/getRoute] Failed to precache route:", error);
        }
      }

      return {
        success: true,
        waypointsSnapped: waypointsUpdatedBySnapping,
        snappedWaypoints: finalSnappedWaypoints ?? undefined,
        snappedDirectFlags: finalSnappedDirectFlags ?? undefined,
      };
    } catch (error) {
      Logger.warn(
        "[RCS/getRoute] Network error fetching route, falling back to direct routes:",
        error,
      );

      // Offline fallback: Convert all segments to direct routes
      Logger.info("[RCS/getRoute] Converting to direct routes for offline use");
      const offlineRouteCoordinates: Coordinate[] = [];
      let cumulativeDistance = 0;

      for (let i = 0; i < waypoints.length - 1; i++) {
        if (i === 0) offlineRouteCoordinates.push(waypoints[i]);
        offlineRouteCoordinates.push(waypoints[i + 1]);
        cumulativeDistance += haversineDistance(waypoints[i], waypoints[i + 1]);
      }

      setCurrentRoutePathCoordinates(offlineRouteCoordinates);
      updateRouteLayer(map, offlineRouteCoordinates);
      const duration = estimateWalkingDuration(cumulativeDistance);
      setRouteDistance(formatDistance(cumulativeDistance) + " (offline)");
      setRouteDuration(formatDuration(duration) + " (estimated)");
      setHasRoute(true);
      addKilometerMarkers(map, offlineRouteCoordinates);

      return { success: true, waypointsSnapped: false, error: "Using offline direct routes" };
    }
  }

  // Should not be reached if logic is correct for waypoints.length >= 2
  Logger.warn(
    "[RCS/getRoute] Unhandled routing condition. Waypoints:",
    waypoints.length,
    "Flags:",
    JSON.stringify(directFlags),
  );
  updateRouteLayer(map, []);
  setCurrentRoutePathCoordinates([]);
  setRouteDistance("");
  setRouteDuration("");
  setHasRoute(false);
  return { success: false, waypointsSnapped: false, error: "Unhandled routing condition" };
};

// Function to get the current route path (for GPX export, etc.)
export const getCurrentRoutePath = (): Coordinate[] => {
  return [...currentRoutePathCoordinates]; // Return a copy to prevent external modification
};

// Function to clear the current route path (e.g. when route is cleared in routing.ts)
export const clearCurrentRoutePath = (): void => {
  setCurrentRoutePathCoordinates([]);
  Logger.info("[RouteCalculationService] Cleared currentRoutePathCoordinates.");
};

// Function to set the current route path directly (e.g. for GPX import)
export const setCurrentRoutePath = (coordinates: Coordinate[]): void => {
  setCurrentRoutePathCoordinates([...coordinates]);
  Logger.info(
    `[RouteCalculationService] Set currentRoutePathCoordinates with ${coordinates.length} coordinates.`,
  );
};

// --- A-to-B Route Calculation Function (Disabled - Moving to Backend) ---
/*
export async function calculateAtoBRoute(
  startCoord: Coordinate,
  endCoord: Coordinate,
  accessToken: string,
  surfaceType: "paved" | "mixed" | "unpaved",
): Promise<
  Partial<RouteResult & { geometry?: Coordinate[]; distance?: number; duration?: number }>
> {
  let profile = "mapbox/cycling"; // Default profile

  if (surfaceType === "paved") {
    profile = "mapbox/driving-traffic";
    Logger.info(`[RCS/calculateAtoBRoute] Using '${profile}' for 'paved' surface type.`);
  } else if (surfaceType === "mixed") {
    profile = "mapbox/cycling";
    Logger.info(`[RCS/calculateAtoBRoute] Using '${profile}' for 'mixed' surface type.`);
  } else if (surfaceType === "unpaved") {
    profile = "mapbox/walking";
    Logger.warn(
      `[RCS/calculateAtoBRoute] 'unpaved' surface type selected. Using '${profile}' profile. This may result in slower estimated times and routes more suited for walking/hiking.`,
    );
  }

  Logger.info(`[RCS/calculateAtoBRoute] Fetching A-to-B route using profile: ${profile}`);

  const result = await getDirections([startCoord, endCoord], accessToken, {
    profile,
    steps: true,
    overview: "full",
  });

  if (!result.success || !result.data) {
    Logger.warn(
      `[RCS/calculateAtoBRoute] API error: ${result.error}, falling back to direct route`,
    );

    // Offline fallback: Create a direct route
    const directGeometry: Coordinate[] = [startCoord, endCoord];
    const directDistance = haversineDistance(startCoord, endCoord) * 1000; // Convert to meters
    const directDuration = estimateWalkingDuration(directDistance / 1000) * 60; // Convert minutes to seconds

    Logger.info(
      `[RCS/calculateAtoBRoute] Using direct route: Distance=${(directDistance / 1000).toFixed(2)}km, Duration=${(directDuration / 60).toFixed(1)}min`,
    );
    setCurrentRoutePathCoordinates([...directGeometry]);

    return {
      success: true,
      geometry: directGeometry,
      distance: directDistance,
      duration: directDuration,
      error: "Using offline direct route",
    };
  }

  const data = result.data;
  // Note: Offline detection would need to be handled in the mapbox-api utility
  const isOfflineRoute = false;

  if (data.routes && data.routes.length > 0) {
    const route = data.routes[0];
    const geometry = route.geometry.coordinates as Coordinate[];
    const distance = route.distance; // in meters
    const duration = route.duration; // in seconds

    Logger.info(
      `[RCS/calculateAtoBRoute] Route found: Distance=${(distance / 1000).toFixed(2)}km, Duration=${(duration / 60).toFixed(1)}min`,
    );
    setCurrentRoutePathCoordinates([...geometry]); // Update module-level path

    // If this is a fresh online route (not from cache), precache it for offline use
    if (!isOfflineRoute && "serviceWorker" in navigator) {
      try {
        navigator.serviceWorker.ready.then((registration) => {
          if (registration.active) {
            registration.active.postMessage({
              type: "PRECACHE_ROUTE",
              data: {
                routeData: {
                  waypoints: [startCoord, endCoord],
                  geometry: geometry,
                  distance: distance,
                  duration: duration,
                  url: `atob_directions_api_request_${Date.now()}`,
                },
              },
            });
            Logger.info(
              "[RCS/calculateAtoBRoute] Route data sent to service worker for enhanced caching",
            );
          }
        });
      } catch (error) {
        Logger.warn("[RCS/calculateAtoBRoute] Failed to precache route:", error);
      }
    }

    return {
      success: true,
      geometry,
      distance,
      duration,
    };
  } else {
    const noRouteMessage = data.message || "No route found between the specified points.";
    Logger.warn(`[RCS/calculateAtoBRoute] No route found: ${noRouteMessage}`);
    return { success: false, error: noRouteMessage };
  }
}
*/
