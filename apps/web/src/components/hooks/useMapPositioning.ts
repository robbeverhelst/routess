import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { zoomToRoute } from "@/features/routing/utils/RoutingUtils";
import { getCurrentRoutePath } from "@/features/routing/services/RouteCalculationService";
import { Logger } from "@/lib/logger";

interface UseMapPositioningProps {
  mapRef: React.RefObject<MapboxMap | null>;
  isMapReady: boolean;
  hasRoute: boolean;
  isRouteCoordsReady: boolean;
  userLocation: [number, number] | null;
  isUserLocationLoading: boolean;
  locationError: GeolocationPositionError | null;
  lastKnownLocationFromStorage: [number, number] | null;
  detectedRouteInLocalStorageOnInit: boolean;
  mapPitch: number;
}

export const useMapPositioning = ({
  mapRef,
  isMapReady,
  hasRoute,
  isRouteCoordsReady,
  userLocation,
  isUserLocationLoading,
  locationError,
  lastKnownLocationFromStorage,
  detectedRouteInLocalStorageOnInit,
  mapPitch,
}: UseMapPositioningProps) => {
  const hasInitiallyZoomedToUser = useRef(false);
  const initialRouteZoomDoneRef = useRef<boolean>(false);

  // Effect to handle prioritized initial map position
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    // Only execute this if no initial zoom has happened yet
    if (hasInitiallyZoomedToUser.current || initialRouteZoomDoneRef.current) return;

    Logger.info("[useMapPositioning] Determining initial map position with priority order...");

    // Priority 1: Zoom to route if available
    if (hasRoute && isRouteCoordsReady) {
      Logger.info("[useMapPositioning] Priority 1: Zooming to available route");
      const currentRouteCoords = getCurrentRoutePath();
      if (currentRouteCoords && currentRouteCoords.length > 0) {
        zoomToRoute(mapRef.current, currentRouteCoords);
        initialRouteZoomDoneRef.current = true;
        hasInitiallyZoomedToUser.current = true;
        Logger.info("[useMapPositioning] Successfully zoomed to initial route.");
        return;
      } else {
        Logger.warn("[useMapPositioning] hasRoute is true but no route coordinates available");
      }
    } else if (detectedRouteInLocalStorageOnInit && mapRef.current) {
      // For routes from localStorage, first check if the route path is already available
      const currentRouteCoords = getCurrentRoutePath();
      if (currentRouteCoords && currentRouteCoords.length > 0) {
        Logger.info(
          "[useMapPositioning] Route coordinates available from localStorage, zooming to route",
        );
        zoomToRoute(mapRef.current, currentRouteCoords);
        initialRouteZoomDoneRef.current = true;
        hasInitiallyZoomedToUser.current = true;
        Logger.info("[useMapPositioning] Successfully zoomed to route from localStorage.");
        return;
      }

      // If a route is detected in localStorage but hasRoute is not yet true and no coordinates available,
      // wait for the route to be properly loaded before proceeding to other options
      Logger.info(
        "[useMapPositioning] Route detected in localStorage, waiting for route data to be ready",
      );
      return;
    }

    // Priority 2: Zoom to current user location if available
    if (userLocation && !isUserLocationLoading && !locationError) {
      Logger.info("[useMapPositioning] Priority 2: Zooming to current user location");
      mapRef.current.flyTo({
        center: userLocation,
        zoom: 15,
        bearing: 0,
        pitch: mapPitch,
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      hasInitiallyZoomedToUser.current = true;
      Logger.info("[useMapPositioning] Successfully zoomed to current user location.");
      return;
    }

    // Priority 3: Zoom to last known location from localStorage
    if (lastKnownLocationFromStorage) {
      Logger.info(
        "[useMapPositioning] Priority 3: Zooming to last known location from localStorage",
      );
      mapRef.current.flyTo({
        center: lastKnownLocationFromStorage,
        zoom: 14,
        bearing: 0,
        pitch: mapPitch,
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      hasInitiallyZoomedToUser.current = true;
      Logger.info(
        "[useMapPositioning] Successfully zoomed to last known location from localStorage.",
      );
      return;
    }

    // Priority 4: Use default location (already set in initialViewState)
    Logger.info(
      "[useMapPositioning] Priority 4: Using default location (already set in initialViewState)",
    );
  }, [
    isMapReady,
    hasRoute,
    isRouteCoordsReady,
    userLocation,
    isUserLocationLoading,
    locationError,
    lastKnownLocationFromStorage,
    detectedRouteInLocalStorageOnInit,
    mapPitch,
    mapRef,
  ]);

  return {
    hasInitiallyZoomedToUser: hasInitiallyZoomedToUser.current,
  };
};
