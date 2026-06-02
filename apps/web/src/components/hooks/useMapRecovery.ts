import type { Map as MapboxMap } from "mapbox-gl";
import { useEffect } from "react";
import { Logger } from "@/lib/logger";

/**
 * Nudges the map to repaint when the tab returns to the foreground.
 *
 * Mapbox GL itself already handles WebGL context loss/restore (it calls
 * preventDefault on `webglcontextlost` and re-initialises on
 * `webglcontextrestored`), so we deliberately do NOT duplicate that. But after
 * backgrounding (tab hidden, bfcache restore, or a context-restore) the canvas
 * can keep a stale frame or a stale size until the next interaction. A cheap
 * resize + repaint on return makes it refresh immediately instead of looking
 * frozen.
 */
export const useMapRecovery = (mapRef: React.RefObject<MapboxMap | null>, isMapLoaded: boolean) => {
	useEffect(() => {
		const map = mapRef.current;
		if (!isMapLoaded || !map) return;

		const refresh = () => {
			try {
				map.resize();
				map.triggerRepaint();
			} catch (err) {
				Logger.debug("[useMapRecovery] resize/repaint on resume failed", err);
			}
		};

		const onVisible = () => {
			if (!document.hidden) refresh();
		};

		const canvas = map.getCanvas();
		document.addEventListener("visibilitychange", onVisible);
		window.addEventListener("pageshow", onVisible);
		canvas.addEventListener("webglcontextrestored", refresh);

		return () => {
			document.removeEventListener("visibilitychange", onVisible);
			window.removeEventListener("pageshow", onVisible);
			canvas.removeEventListener("webglcontextrestored", refresh);
		};
	}, [mapRef, isMapLoaded]);
};
