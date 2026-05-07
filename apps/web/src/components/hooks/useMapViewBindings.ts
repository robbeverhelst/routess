import type { Map as MapboxMap } from "mapbox-gl";
import { useCallback, useEffect } from "react";
import { initializeSourcesAndLayers } from "@/features/routing/managers/MapLayerManager";
import { syncMapView } from "@/features/routing/managers/MapViewAdapter";
import { readMapPalette } from "@/features/routing/managers/mapPalette";
import { onAppEvent } from "@/lib/app-events";
import { Logger } from "@/lib/logger";
import { getSolarPositionForTimeOfDay } from "@/lib/solar";
import { useMapViewStore } from "@/stores/mapViewStore";
import { type RedesignMapStyle, useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { useRoutingStore } from "@/stores/routingStore";

interface UseMapViewBindingsOptions {
	map: MapboxMap | null;
	userLocation: [number, number] | null;
	isOnline: boolean;
}

// Wires the map view store and Mapbox map together. Subscribes to:
// - app events (zoom-in/out, set-map-style, set-pois)
// - mapViewStore changes (lightPreset → setConfigProperty, sunPosition compute)
// - online/offline (auto-lock when offline)
// - style.load (re-init layers, re-apply POI visibility)
//
// Returns a single callback (`onMapStyleLoaded`) that MapCanvas fires after
// the underlying Mapbox style finishes loading.
export const useMapViewBindings = ({ map, userLocation, isOnline }: UseMapViewBindingsOptions) => {
	const lightPreset = useMapViewStore((s) => s.lightPreset);
	const setSunPosition = useMapViewStore((s) => s.setSunPosition);
	const sunPosition = useMapViewStore((s) => s.sunPosition);
	const setMapStyle = useRedesignSettingsStore((s) => s.setMapStyle);
	const setShowPois = useRedesignSettingsStore((s) => s.setShowPois);
	const showPois = useRedesignSettingsStore((s) => s.showPois);
	const mapStyleKey = useRedesignSettingsStore((s) => s.mapStyle);
	const isMapLocked = useRoutingStore((s) => s.isMapLocked);
	const setIsMapLocked = useRoutingStore((s) => s.setIsMapLocked);

	const applyPoiVisibility = useCallback(
		(visible: boolean) => {
			if (!map) return;
			try {
				map.setConfigProperty?.("basemap", "showPointOfInterestLabels", visible);
			} catch (err) {
				Logger.debug("[useMapViewBindings] setConfigProperty for POI labels not supported", err);
			}
			try {
				const layers = map.getStyle()?.layers ?? [];
				for (const layer of layers) {
					if (layer.id.includes("poi-label") || layer.id.startsWith("poi")) {
						map.setLayoutProperty(layer.id, "visibility", visible ? "visible" : "none");
					}
				}
			} catch (err) {
				Logger.debug("[useMapViewBindings] Could not toggle POI layers via setLayoutProperty", err);
			}
		},
		[map],
	);

	// App-event subscriptions (one set, lifecycle-bound to map availability)
	useEffect(() => {
		if (!map) return;
		const onZoomIn = () => map.zoomIn();
		const onZoomOut = () => map.zoomOut();
		const onSetStyle = (detail: { styleKey?: RedesignMapStyle }) => {
			if (detail?.styleKey) setMapStyle(detail.styleKey);
		};
		const onSetPois = (detail: { visible?: boolean }) => {
			if (typeof detail?.visible === "boolean") setShowPois(detail.visible);
		};

		const unsubscribers = [
			onAppEvent("routess:zoom-in", onZoomIn),
			onAppEvent("routess:zoom-out", onZoomOut),
			onAppEvent("routess:set-map-style", onSetStyle),
			onAppEvent("routess:set-pois", onSetPois),
		];
		return () => {
			for (const unsubscribe of unsubscribers) unsubscribe();
		};
	}, [map, setMapStyle, setShowPois]);

	// Apply POI visibility when toggle changes
	useEffect(() => {
		if (!map) return;
		applyPoiVisibility(showPois);
	}, [applyPoiVisibility, map, showPois]);

	// Auto-lock when going offline
	useEffect(() => {
		if (!isOnline && !isMapLocked) {
			setIsMapLocked(true);
			Logger.info("[useMapViewBindings] Map automatically locked due to offline status");
		}
	}, [isOnline, isMapLocked, setIsMapLocked]);

	// Compute initial sun position when location becomes available
	useEffect(() => {
		if (userLocation && !sunPosition) {
			setSunPosition(getSolarPositionForTimeOfDay(lightPreset, userLocation[1], userLocation[0]));
		}
	}, [userLocation, sunPosition, lightPreset, setSunPosition]);

	// Recompute sun position when light preset changes (and we have a location)
	useEffect(() => {
		if (!userLocation) return;
		setSunPosition(getSolarPositionForTimeOfDay(lightPreset, userLocation[1], userLocation[0]));
	}, [lightPreset, userLocation, setSunPosition]);

	// Apply light preset to map
	useEffect(() => {
		if (!map) return;
		try {
			map.setConfigProperty("basemap", "lightPreset", lightPreset);
		} catch (err) {
			Logger.debug("[useMapViewBindings] Light preset update skipped for current style", err);
		}
	}, [map, lightPreset]);

	// MapStyleLoaded handler: re-init layers + re-apply POIs after a style change
	const onMapStyleLoaded = useCallback(() => {
		if (!map) return;
		if (mapStyleKey === "satellite") {
			map.setProjection("globe");
			map.setFog({
				color: "rgb(186, 210, 235)",
				"high-color": "rgb(36, 92, 223)",
				"horizon-blend": 0.02,
				"space-color": "rgb(11, 11, 25)",
				"star-intensity": 0.6,
			});
		}
		Logger.info("[useMapViewBindings] Re-initializing map layers after style change");
		initializeSourcesAndLayers(map, readMapPalette());
		syncMapView(map);
		applyPoiVisibility(showPois);
		Logger.info(`[useMapViewBindings] Map style active: ${mapStyleKey}`);
	}, [map, mapStyleKey, applyPoiVisibility, showPois]);

	return { onMapStyleLoaded };
};
