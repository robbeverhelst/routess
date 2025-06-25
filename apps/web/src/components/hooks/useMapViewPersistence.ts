import { useEffect } from "react";
import type { Map } from "mapbox-gl";
import { saveLastMapViewToLocalStorage } from "@/features/routing/services/LocalStorageService";

export const useMapViewPersistence = (mapRef: React.RefObject<Map | null>) => {
  useEffect(() => {
    const currentMapRef = mapRef.current;
    if (!currentMapRef) return;

    const handleMoveEnd = () => {
      if (currentMapRef) {
        const center = currentMapRef.getCenter();
        const zoom = currentMapRef.getZoom();
        const currentView = {
          longitude: center.lng,
          latitude: center.lat,
          zoom: zoom,
          bearing: currentMapRef.getBearing(),
          pitch: currentMapRef.getPitch(),
        };

        saveLastMapViewToLocalStorage(currentView);
      }
    };

    currentMapRef.on("moveend", handleMoveEnd);

    return () => {
      currentMapRef.off("moveend", handleMoveEnd);
    };
  }, [mapRef]);
};
