import type { Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { PopupInfo as MIMPopupInfo } from "@/features/routing/managers/MapInteractionManager";
import { initializeMapInteractions } from "@/features/routing/managers/MapInteractionManager";
import { applyMapPalette, initializeSourcesAndLayers } from "@/features/routing/managers/MapLayerManager";
import { attachMapViewAdapter } from "@/features/routing/managers/MapViewAdapter";
import { readMapPalette, subscribeMapPalette } from "@/features/routing/managers/mapPalette";
import { createRouteDraftEditor, type RouteDraftEditor } from "@/features/routing/RouteDraftEditor";
import { getCurrentRoutePath } from "@/features/routing/services/RouteCalculationService";
import { zoomToRoute } from "@/features/routing/utils/RoutingUtils";
import { Logger } from "@/lib/logger";
import { useToastStore } from "@/stores/toastStore";

interface UseMapInitializationProps {
	mapboxToken: string;
	setPopup: Dispatch<SetStateAction<MIMPopupInfo | null>>;
	setEditor: (editor: RouteDraftEditor | null) => void;
	handleWaypointError: (message: string | null) => void;
	isMapLockedRef: { current: boolean };
	currentLightPreset: string;
	routeId?: string;
}

export const useMapInitialization = ({
	mapboxToken,
	setPopup,
	setEditor,
	handleWaypointError,
	isMapLockedRef,
	currentLightPreset,
	routeId,
}: UseMapInitializationProps) => {
	const pushToast = useToastStore((s) => s.push);
	const routingDisposerRef = useRef<(() => void) | null>(null);
	const mapViewAdapterDisposerRef = useRef<(() => void) | null>(null);
	const paletteDisposerRef = useRef<(() => void) | null>(null);
	const routeInitTimeoutRef = useRef<number | null>(null);

	const handleMapLoad = useCallback(
		async (event: { target: MapboxMap }) => {
			Logger.info("[useMapInitialization] Map loaded, setting up routing");
			const map = event.target;

			const initialPalette = readMapPalette();
			initializeSourcesAndLayers(map, initialPalette);

			paletteDisposerRef.current?.();
			paletteDisposerRef.current = subscribeMapPalette((palette) => {
				applyMapPalette(map, palette);
			});

			mapViewAdapterDisposerRef.current = attachMapViewAdapter(map);

			const editor = createRouteDraftEditor({
				map,
				accessToken: mapboxToken,
				onError: (message) => handleWaypointError(message),
			});
			setEditor(editor);

			routingDisposerRef.current = initializeMapInteractions(map, editor, setPopup, isMapLockedRef);

			map.setConfigProperty("basemap", "lightPreset", currentLightPreset);

			Logger.info("[useMapInitialization] Routing setup complete");

			// Restore UI state from the persisted store if a route exists
			// (the adapter handles map layers automatically). The editor reads
			// distance/duration/hasRoute from the same store, so nothing else
			// needs syncing here.

			const urlParams = new URLSearchParams(window.location.search);
			const encodedRoute = urlParams.get("route") || routeId;

			if (encodedRoute) {
				Logger.info("[useMapInitialization] Found shared route data, attempting to load...");
				const result = await editor.loadFromShareLink(encodedRoute);
				if (!result.success) {
					pushToast({ kind: "danger", title: result.message || "Failed to load shared route." });
				} else {
					if (urlParams.get("route")) {
						window.history.replaceState({}, document.title, window.location.pathname);
					}
					// Opening a shared link should land on the route. The geometry is
					// ready now (loadFromShareLink awaits the routing), so fit the map
					// to it instead of leaving the user to press the recenter button.
					const routeCoords = getCurrentRoutePath();
					if (routeCoords && routeCoords.length > 0) {
						map.stop();
						zoomToRoute(map, routeCoords);
					}
				}
			}
		},
		[mapboxToken, setPopup, setEditor, handleWaypointError, isMapLockedRef, currentLightPreset, routeId, pushToast],
	);

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

			if (mapViewAdapterDisposerRef.current) {
				mapViewAdapterDisposerRef.current();
				mapViewAdapterDisposerRef.current = null;
			}

			if (paletteDisposerRef.current) {
				paletteDisposerRef.current();
				paletteDisposerRef.current = null;
			}
		};
	}, []);

	return {
		handleMapLoad,
	};
};
