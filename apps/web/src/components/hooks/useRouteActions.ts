import { useCallback } from "react";
import type { Map } from "mapbox-gl";
import { addWaypoint, removeWaypoint, resetRouting, reverseRoute, undo, redo } from "@/lib/routing";
import { insertWaypointAtLocation } from "@/lib/routing";
import { zoomToRoute } from "@/features/routing/utils/RoutingUtils";
import { serializeAndCompress } from "@/lib/shareUtils";
import { useRoutingStore } from "@/stores/routingStore";
import { getCurrentRoutePath } from "@/features/routing/services/RouteCalculationService";
import { Logger } from "@/lib/logger";
import type { PopupInfo as MapPopupInfo } from "@/features/routing/managers/MapInteractionManager";

interface UseRouteActionsProps {
  mapRef: React.RefObject<Map | null>;
  mapboxToken: string;
  hasRoute: boolean;
  popup: MapPopupInfo | null;
  setPopup: React.Dispatch<React.SetStateAction<MapPopupInfo | null>>;
  setRouteDistance: React.Dispatch<React.SetStateAction<string>>;
  setRouteDuration: React.Dispatch<React.SetStateAction<string>>;
  setHasRoute: React.Dispatch<React.SetStateAction<boolean>>;
  handleWaypointError: (message: string | null) => void;
  handleRouteInfoError: (message: string) => void;
  clearShareState: () => void;
  setShareNotification: React.Dispatch<React.SetStateAction<string>>;
}

/* eslint-disable react-hooks/exhaustive-deps */
export const useRouteActions = ({
  mapRef,
  mapboxToken,
  hasRoute,
  popup,
  setPopup,
  setRouteDistance,
  setRouteDuration,
  setHasRoute,
  handleWaypointError,
  handleRouteInfoError,
  clearShareState,
  setShareNotification,
}: UseRouteActionsProps) => {
  // Undo handler
  const handleUndo = useCallback(() => {
    undo(setRouteDistance, setRouteDuration, setHasRoute);
  }, [setRouteDistance, setRouteDuration, setHasRoute]);

  // Redo handler
  const handleRedo = useCallback(() => {
    redo(setRouteDistance, setRouteDuration, setHasRoute);
  }, [setRouteDistance, setRouteDuration, setHasRoute]);

  // Reverse route handler
  const handleReverseRoute = useCallback(async () => {
    if (!mapRef.current || !mapboxToken) return;
    await reverseRoute(
      mapRef.current,
      mapboxToken,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
    );
  }, [mapboxToken, setRouteDistance, setRouteDuration, setHasRoute]);

  // Reset handler
  const handleReset = useCallback(async () => {
    if (!mapRef.current || !mapboxToken) return;
    await resetRouting(
      mapRef.current,
      mapboxToken,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
    );
  }, [mapboxToken, setRouteDistance, setRouteDuration, setHasRoute]);

  // Select location handler - moves camera to location instead of adding waypoint
  const handleSelectLocation = useCallback(
    (location: { lng: number; lat: number; name: string }) => {
      if (!mapRef.current) return;

      Logger.info(`[useRouteActions] Moving camera to selected location: ${location.name}`);

      // Move the camera to the selected location with a smooth animation
      mapRef.current.flyTo({
        center: [location.lng, location.lat],
        zoom: 14, // Zoom to a reasonable level to see the location
        duration: 1500, // 1.5 second animation
      });
    },
    [],
  );

  // Route generation handlers
  const handleGenerateAtoB = useCallback(async () => {
    handleWaypointError("Route generation functionality is not yet implemented.");
  }, [handleWaypointError]);

  const handleGenerateLoop = useCallback(async () => {
    handleWaypointError("Route generation functionality is not yet implemented.");
  }, [handleWaypointError]);

  // Add direct waypoint handler
  const handleAddDirectWaypoint = useCallback(async () => {
    if (!mapRef.current || !popup || popup.type !== "direct" || !mapboxToken) return;

    Logger.info("[useRouteActions] Adding direct waypoint at:", [popup.longitude, popup.latitude]);
    await addWaypoint(
      mapRef.current,
      [popup.longitude, popup.latitude],
      true,
      mapboxToken,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
    );

    setPopup(null);
  }, [
    popup,
    mapboxToken,
    setRouteDistance,
    setRouteDuration,
    setHasRoute,
    handleWaypointError,
    setPopup,
  ]);

  // Remove waypoint handler
  const handleRemoveWaypoint = useCallback(async () => {
    if (
      !mapRef.current ||
      !popup ||
      popup.type !== "remove" ||
      popup.waypointIndex === undefined ||
      !mapboxToken
    )
      return;

    Logger.info("[useRouteActions] Removing waypoint at index:", popup.waypointIndex);
    await removeWaypoint(
      mapRef.current,
      popup.waypointIndex,
      mapboxToken,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
    );

    setPopup(null);
  }, [
    popup,
    mapboxToken,
    setRouteDistance,
    setRouteDuration,
    setHasRoute,
    handleWaypointError,
    setPopup,
  ]);

  // Add waypoint on route handler
  const handleAddWaypointOnRoute = useCallback(async () => {
    if (!mapRef.current || !popup || popup.type !== "add_on_route" || !mapboxToken) return;

    Logger.info("[useRouteActions] Adding waypoint on route at:", [
      popup.longitude,
      popup.latitude,
    ]);
    await insertWaypointAtLocation(
      mapRef.current,
      [popup.longitude, popup.latitude],
      mapboxToken,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
    );

    setPopup(null);
  }, [
    popup,
    mapboxToken,
    setRouteDistance,
    setRouteDuration,
    setHasRoute,
    handleWaypointError,
    setPopup,
  ]);

  // Zoom to route handler
  const handleZoomToRoute = useCallback(() => {
    if (mapRef.current && hasRoute) {
      const currentRouteCoords = getCurrentRoutePath();
      if (currentRouteCoords && currentRouteCoords.length > 0) {
        zoomToRoute(mapRef.current, currentRouteCoords);
      } else {
        Logger.warn("[useRouteActions] No route path coordinates available to zoom to.");
      }
    }
  }, [hasRoute]);

  // Share link handler
  const handleCopyShareLinkToClipboard = useCallback(() => {
    const { waypoints, directFlags } = useRoutingStore.getState();

    if (waypoints.length === 0) {
      handleRouteInfoError("Cannot share an empty route.");
      return;
    }

    const encodedData = serializeAndCompress(waypoints, directFlags, true);

    if (encodedData) {
      const shareUrl = `${window.location.origin}${window.location.pathname}?route=${encodedData}`;
      navigator.clipboard
        .writeText(shareUrl)
        .then(() => {
          clearShareState();
          setShareNotification("Link copied to clipboard!");
          setTimeout(() => setShareNotification(""), 2000);
        })
        .catch((err) => {
          Logger.error("[useRouteActions] Failed to copy share link:", err);
          handleRouteInfoError("Failed to copy link. Please try again.");
        });
    } else {
      handleRouteInfoError("Could not generate shareable link.");
    }
  }, [handleRouteInfoError, setShareNotification, clearShareState]);

  // Import error handler
  const handleImportError = useCallback(
    (message: string) => {
      handleWaypointError(`Import Error: ${message}`);
    },
    [handleWaypointError],
  );

  return {
    handleUndo,
    handleRedo,
    handleReverseRoute,
    handleReset,
    handleSelectLocation,
    handleGenerateAtoB,
    handleGenerateLoop,
    handleAddDirectWaypoint,
    handleRemoveWaypoint,
    handleAddWaypointOnRoute,
    handleZoomToRoute,
    handleCopyShareLinkToClipboard,
    handleImportError,
  };
};
