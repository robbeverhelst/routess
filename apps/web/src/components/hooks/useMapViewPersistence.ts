import type { Map as MapboxMap } from "mapbox-gl";
import { useEffect } from "react";
import { saveLastMapViewToLocalStorage } from "@/features/routing/services/LocalStorageService";

// isMapReady must flip to true once the map has loaded; mapRef.current is
// null at mount, so without it the effect would bail and never attach.
export const useMapViewPersistence = (mapRef: React.RefObject<MapboxMap | null>, isMapReady: boolean) => {
	useEffect(() => {
		const currentMapRef = mapRef.current;
		if (!isMapReady || !currentMapRef) return;

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
	}, [mapRef, isMapReady]);
};
