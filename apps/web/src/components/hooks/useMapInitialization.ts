import { useCallback, useRef, useEffect } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import { setupRouting, setRouteData } from "@/lib/routing";
import { decompressAndParse } from "@/lib/shareUtils";
import { Logger } from "@/lib/logger";
// import { zoomToRoute } from "@/features/routing/utils/RoutingUtils"; // Kept for future use
// import { getCurrentRoutePath } from "@/features/routing/services/RouteCalculationService"; // Kept for future use
// import { getWaypoints } from "@/features/routing/managers/WaypointManager"; // Kept for future use
import type { PopupInfo as MIMPopupInfo } from "@/features/routing/managers/MapInteractionManager";

interface UseMapInitializationProps {
  mapboxToken: string;
  setRouteDistance: Dispatch<SetStateAction<string>>;
  setRouteDuration: Dispatch<SetStateAction<string>>;
  setHasRoute: Dispatch<SetStateAction<boolean>>;
  setPopup: Dispatch<SetStateAction<MIMPopupInfo | null>>;
  handleWaypointError: (message: string | null) => void;
  isMapLockedRef: { current: boolean };
  currentLightPreset: string;
  routeId?: string;
  handleRouteInfoError: (message: string) => void;
  setIsRouteCoordsReady: Dispatch<SetStateAction<boolean>>;
}

export const useMapInitialization = ({
  mapboxToken,
  setRouteDistance,
  setRouteDuration,
  setHasRoute,
  setPopup,
  handleWaypointError,
  isMapLockedRef,
  currentLightPreset,
  routeId,
  handleRouteInfoError,
  setIsRouteCoordsReady,
}: UseMapInitializationProps) => {
  const routingDisposerRef = useRef<(() => void) | null>(null);
  const routeInitTimeoutRef = useRef<number | null>(null);

  // Handle map load
  const handleMapLoad = useCallback(
    async (event: { target: MapboxMap }) => {
      Logger.info("[useMapInitialization] Map loaded, setting up routing");
      const map = event.target;

      const disposer = await setupRouting(
        map,
        mapboxToken,
        setRouteDistance,
        setRouteDuration,
        setHasRoute,
        setPopup,
        handleWaypointError,
        isMapLockedRef,
      );
      routingDisposerRef.current = disposer;

      // Apply light preset immediately
      map.setConfigProperty("basemap", "lightPreset", currentLightPreset);

      Logger.info("[useMapInitialization] Routing setup complete");

      // Check for shared route data in URL
      const urlParams = new URLSearchParams(window.location.search);
      const routeDataParam = urlParams.get("route");

      // Check for routeId from router props
      if (routeId && !routeDataParam) {
        Logger.info("[useMapInitialization] Loading route from routeId:", routeId);
        try {
          const loadedData = decompressAndParse(routeId);
          if (loadedData && map && mapboxToken) {
            await setRouteData(
              map,
              mapboxToken,
              loadedData.w, // waypoints
              loadedData.f, // directFlags
              setRouteDistance,
              setRouteDuration,
              setHasRoute,
              setIsRouteCoordsReady,
            );
            Logger.info("[useMapInitialization] Route data loaded from routeId successfully.");
          }
        } catch (err) {
          Logger.error("[useMapInitialization] Could not parse routeId:", err);
          handleRouteInfoError("Failed to read route data. The route may be corrupted or invalid.");
        }
      }

      if (routeDataParam) {
        Logger.info("[useMapInitialization] Found route data in URL, attempting to load...");
        let loadedData: ReturnType<typeof decompressAndParse> | null = null;
        try {
          loadedData = decompressAndParse(routeDataParam);
        } catch (err) {
          Logger.error("[useMapInitialization] Could not decompress or parse route param:", err);
          handleRouteInfoError(
            "Failed to read shared route data. The link may be corrupted or invalid.",
          );
        }

        if (loadedData && map && mapboxToken) {
          try {
            await setRouteData(
              map,
              mapboxToken,
              loadedData.w, // waypoints
              loadedData.f, // directFlags
              setRouteDistance,
              setRouteDuration,
              setHasRoute,
              setIsRouteCoordsReady,
            );
            Logger.info("[useMapInitialization] Route data loaded from URL successfully.");
            // Clean the URL
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (err) {
            Logger.error("[useMapInitialization] Error setting route data from URL:", err);
            handleRouteInfoError(
              "Failed to load shared route. The link may be invalid or corrupted.",
            );
          }
        }
      }
    },
    [
      mapboxToken,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
      setPopup,
      handleWaypointError,
      isMapLockedRef,
      currentLightPreset,
      routeId,
      handleRouteInfoError,
      setIsRouteCoordsReady,
    ],
  );

  // Clean up the timeout when component unmounts
  useEffect(() => {
    return () => {
      if (routeInitTimeoutRef.current) {
        clearTimeout(routeInitTimeoutRef.current);
        routeInitTimeoutRef.current = null;
      }

      if (routingDisposerRef.current) {
        Logger.info("[useMapInitialization] Cleaning up map interaction listeners.");
        routingDisposerRef.current();
        routingDisposerRef.current = null;
      }
    };
  }, []);

  return {
    handleMapLoad,
  };
};
