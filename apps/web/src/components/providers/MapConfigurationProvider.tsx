import type { Map as MapboxMap } from "mapbox-gl";
import type React from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { TimeOfDay } from "@/components/ui/route-controls";
import {
	initializeSourcesAndLayers,
	updateRouteLayer,
	updateWaypointsLayer,
} from "@/features/routing/managers/MapLayerManager";
import {
	loadLightPresetFromLocalStorage,
	loadMapLockStateFromLocalStorage,
	loadMapStyleFromLocalStorage,
	loadSunDirectionSettingFromLocalStorage,
	type MapStyle,
	saveLightPresetToLocalStorage,
	saveMapLockStateToLocalStorage,
	saveMapStyleToLocalStorage,
	saveSunDirectionSettingToLocalStorage,
} from "@/features/routing/services/LocalStorageService";
import { Logger } from "@/lib/logger";
import { getSolarPositionForTimeOfDay, type SolarPosition } from "@/lib/solar";
import { useRoutingStore } from "@/stores/routingStore";

// Define bearing presets for cycling - simplified to 4 cardinal directions
const BEARING_PRESETS = [0, 90, 180, 270]; // N, E, S, W

// Order of presets for cycling
const lightPresetsOrder: TimeOfDay[] = ["dawn", "day", "dusk", "night"];

type RedesignMapStyleKey = "streets" | "outdoors" | "satellite" | "terrain" | "dark" | "minimal";

const REDESIGN_STYLE_URLS: Record<RedesignMapStyleKey, string> = {
	streets: "mapbox://styles/mapbox/streets-v12",
	outdoors: "mapbox://styles/mapbox/outdoors-v12",
	satellite: "mapbox://styles/mapbox/satellite-streets-v12",
	terrain: "mapbox://styles/mapbox/outdoors-v12",
	dark: "mapbox://styles/mapbox/dark-v11",
	minimal: "mapbox://styles/mapbox/light-v11",
};

interface MapConfigurationContextType {
	// Map style state
	currentMapStyle: MapStyle;
	onToggleMapStyle: () => void;

	// Map lock state
	isMapLocked: boolean;
	onToggleLock: () => void;

	// Lighting state
	currentLightPreset: TimeOfDay;
	onCycleTimeOfDay: () => void;

	// Bearing state
	currentBearing: number;
	onCycleBearing: () => void;
	setCurrentBearing: (bearing: number) => void;

	// Sun position state
	showSunDirection: boolean;
	onToggleSunDirection: (enabled: boolean) => void;
	currentSunPosition: SolarPosition | null;

	// Map zoom controls
	onZoomIn: () => void;
	onZoomOut: () => void;
}

const MapConfigurationContext = createContext<MapConfigurationContextType | null>(null);

export const useMapConfiguration = () => {
	const context = useContext(MapConfigurationContext);
	if (!context) {
		throw new Error("useMapConfiguration must be used within a MapConfigurationProvider");
	}
	return context;
};
// Export context for separate import
export { MapConfigurationContext };

interface MapConfigurationProviderProps {
	children: React.ReactNode;
	mapRef: React.RefObject<MapboxMap | null>;
	userLocation: [number, number] | null;
	hasRoute: boolean;
	isOnline: boolean;
	initialBearing?: number;
}

export const MapConfigurationProvider: React.FC<MapConfigurationProviderProps> = ({
	children,
	mapRef,
	userLocation,
	hasRoute,
	isOnline,
	initialBearing = 0,
}) => {
	// Get current route data from Zustand store
	const waypoints = useRoutingStore((state) => state.waypoints);
	const routePath = useRoutingStore((state) => state.routePath);
	const isMapLocked = useRoutingStore((state) => state.isMapLocked);
	const setIsMapLocked = useRoutingStore((state) => state.setIsMapLocked);

	// Initialize Zustand store with localStorage value on mount
	useEffect(() => {
		const savedLockState = loadMapLockStateFromLocalStorage();
		setIsMapLocked(savedLockState);
	}, [setIsMapLocked]);
	const [currentLightPreset, setCurrentLightPreset] = useState<TimeOfDay>(loadLightPresetFromLocalStorage() || "day");
	const [currentBearing, setCurrentBearing] = useState<number>(initialBearing);
	const [currentMapStyle, setCurrentMapStyle] = useState<MapStyle>(loadMapStyleFromLocalStorage());
	const [showSunDirection, setShowSunDirection] = useState<boolean>(loadSunDirectionSettingFromLocalStorage());
	const [currentSunPosition, setCurrentSunPosition] = useState<SolarPosition | null>(null);

	const restoreRouteLayers = useCallback(
		(styleKey?: RedesignMapStyleKey) => {
			if (!mapRef.current) return;

			if (styleKey === "satellite") {
				mapRef.current.setProjection("globe");
				mapRef.current.setFog({
					color: "rgb(186, 210, 235)",
					"high-color": "rgb(36, 92, 223)",
					"horizon-blend": 0.02,
					"space-color": "rgb(11, 11, 25)",
					"star-intensity": 0.6,
				});
			}

			Logger.info("[MapConfigurationProvider] Re-initializing map layers after style change");
			initializeSourcesAndLayers(mapRef.current);

			if (waypoints.length > 0) {
				updateWaypointsLayer(mapRef.current, waypoints, isMapLocked);
			}

			if (routePath && routePath.length > 0) {
				updateRouteLayer(mapRef.current, routePath);
			}
		},
		[isMapLocked, mapRef, routePath, waypoints],
	);

	const applyMapStyle = useCallback(
		(styleKey: RedesignMapStyleKey) => {
			if (!mapRef.current) return;

			const nextMapStyle: MapStyle = styleKey === "satellite" ? "satellite" : "standard";
			const styleUrl = REDESIGN_STYLE_URLS[styleKey];

			mapRef.current.setStyle(styleUrl);
			setCurrentMapStyle(nextMapStyle);

			if (styleKey === "dark") {
				setCurrentLightPreset("night");
			}

			mapRef.current.once("style.load", () => restoreRouteLayers(styleKey));
			Logger.info(`[MapConfigurationProvider] Map style changed to: ${styleKey}`);
		},
		[mapRef, restoreRouteLayers],
	);

	// Effect to automatically lock map when offline
	useEffect(() => {
		if (!isOnline && !isMapLocked) {
			setIsMapLocked(true);
			saveMapLockStateToLocalStorage(true);
			Logger.info("[MapConfigurationProvider] Map automatically locked due to offline status");
		}
	}, [isOnline, isMapLocked, setIsMapLocked]);

	// Effect to calculate initial sun position when user location becomes available
	useEffect(() => {
		if (userLocation && !currentSunPosition) {
			const sunPos = getSolarPositionForTimeOfDay(currentLightPreset, userLocation[1], userLocation[0]);
			setCurrentSunPosition(sunPos);
			Logger.info(
				`[MapConfigurationProvider] Initial sun position calculated: azimuth=${sunPos.azimuth.toFixed(1)}°, elevation=${sunPos.elevation.toFixed(1)}°`,
			);
		}
	}, [userLocation, currentLightPreset, currentSunPosition]);

	// Effect to save states to localStorage
	useEffect(() => {
		saveLightPresetToLocalStorage(currentLightPreset);
	}, [currentLightPreset]);

	useEffect(() => {
		saveMapStyleToLocalStorage(currentMapStyle);
	}, [currentMapStyle]);

	useEffect(() => {
		saveSunDirectionSettingToLocalStorage(showSunDirection);
	}, [showSunDirection]);

	// Map lock toggle handler
	const handleToggleLock = useCallback(() => {
		const newLockedState = !isMapLocked;
		setIsMapLocked(newLockedState);
		saveMapLockStateToLocalStorage(newLockedState);

		if (newLockedState && mapRef.current && hasRoute) {
			try {
				Logger.info("[MapConfigurationProvider] Map locked, zooming to full route view");
				// Zoom to route logic would be implemented here or passed via callback
			} catch (err) {
				Logger.error("[MapConfigurationProvider] Error zooming to route on lock:", err);
			}
		}
	}, [isMapLocked, setIsMapLocked, hasRoute, mapRef]);

	// Time of day cycling handler
	const handleCycleTimeOfDay = useCallback(() => {
		if (mapRef.current) {
			const map = mapRef.current;
			const currentIndex = lightPresetsOrder.indexOf(currentLightPreset);
			const nextIndex = (currentIndex + 1) % lightPresetsOrder.length;
			const nextLightPreset = lightPresetsOrder[nextIndex];

			setCurrentLightPreset(nextLightPreset);
			map.setConfigProperty("basemap", "lightPreset", nextLightPreset);

			// Calculate sun position if user location is available
			if (userLocation) {
				const sunPos = getSolarPositionForTimeOfDay(
					nextLightPreset,
					userLocation[1], // latitude
					userLocation[0], // longitude
				);
				setCurrentSunPosition(sunPos);
				Logger.info(
					`[MapConfigurationProvider] Sun position for ${nextLightPreset}: azimuth=${sunPos.azimuth.toFixed(1)}°, elevation=${sunPos.elevation.toFixed(1)}°`,
				);
			}

			Logger.info(`[MapConfigurationProvider] Light preset changed to: ${nextLightPreset}`);
		}
	}, [currentLightPreset, mapRef, userLocation]);

	// Bearing cycling handler
	const handleCycleBearing = useCallback(() => {
		if (mapRef.current) {
			const map = mapRef.current;
			const currentIndex = BEARING_PRESETS.indexOf(currentBearing);
			const safeCurrentIndex = currentIndex === -1 ? BEARING_PRESETS.indexOf(0) : currentIndex;
			const nextIndex = (safeCurrentIndex + 1) % BEARING_PRESETS.length;
			const nextBearing = BEARING_PRESETS[nextIndex];

			map.flyTo({ bearing: nextBearing, duration: 500 });
			setCurrentBearing(nextBearing);
			Logger.info(`[MapConfigurationProvider] Bearing set to: ${nextBearing}`);
		}
	}, [mapRef, currentBearing]);

	// Map style toggle handler
	const handleToggleMapStyle = useCallback(() => {
		applyMapStyle(currentMapStyle === "standard" ? "satellite" : "streets");
	}, [applyMapStyle, currentMapStyle]);

	const applyPoiVisibility = useCallback(
		(visible: boolean) => {
			const map = mapRef.current;
			if (!map) return;
			// Mapbox Standard style exposes a config property; older v11/v12 styles
			// expose discrete POI label layers. Try both so the toggle works across
			// the styles the redesign exposes (streets, outdoors, satellite, dark…).
			try {
				map.setConfigProperty?.("basemap", "showPointOfInterestLabels", visible);
			} catch (err) {
				Logger.debug("[MapConfigurationProvider] setConfigProperty for POI labels not supported on this style", err);
			}
			try {
				const layers = map.getStyle()?.layers ?? [];
				for (const layer of layers) {
					if (layer.id.includes("poi-label") || layer.id.startsWith("poi")) {
						map.setLayoutProperty(layer.id, "visibility", visible ? "visible" : "none");
					}
				}
			} catch (err) {
				Logger.debug("[MapConfigurationProvider] Could not toggle POI layers via setLayoutProperty", err);
			}
		},
		[mapRef],
	);

	useEffect(() => {
		const onZoomIn = () => mapRef.current?.zoomIn();
		const onZoomOut = () => mapRef.current?.zoomOut();
		const onSetStyle = (event: Event) => {
			const styleKey = (event as CustomEvent<{ styleKey?: RedesignMapStyleKey }>).detail?.styleKey;
			if (styleKey && styleKey in REDESIGN_STYLE_URLS) {
				applyMapStyle(styleKey);
			}
		};
		const onSetPois = (event: Event) => {
			const visible = (event as CustomEvent<{ visible?: boolean }>).detail?.visible;
			if (typeof visible === "boolean") applyPoiVisibility(visible);
		};

		window.addEventListener("routess:zoom-in", onZoomIn);
		window.addEventListener("routess:zoom-out", onZoomOut);
		window.addEventListener("routess:set-map-style", onSetStyle);
		window.addEventListener("routess:set-pois", onSetPois);

		return () => {
			window.removeEventListener("routess:zoom-in", onZoomIn);
			window.removeEventListener("routess:zoom-out", onZoomOut);
			window.removeEventListener("routess:set-map-style", onSetStyle);
			window.removeEventListener("routess:set-pois", onSetPois);
		};
	}, [applyMapStyle, applyPoiVisibility, mapRef]);

	// Effect to update waypoint visibility when lock state changes
	useEffect(() => {
		if (mapRef.current && hasRoute && waypoints.length > 0) {
			Logger.info(
				"[MapConfigurationProvider] Map lock toggled, updating waypoint visibility. Locked:",
				isMapLocked,
				"waypoints:",
				waypoints.length,
			);
			updateWaypointsLayer(mapRef.current, waypoints, isMapLocked);
		}
	}, [isMapLocked, hasRoute, mapRef, waypoints]);

	// Zoom handlers
	const handleZoomIn = useCallback(() => {
		mapRef.current?.zoomIn();
	}, [mapRef]);

	const handleZoomOut = useCallback(() => {
		mapRef.current?.zoomOut();
	}, [mapRef]);

	// Sun direction toggle handler
	const handleToggleSunDirection = useCallback((enabled: boolean) => {
		setShowSunDirection(enabled);
	}, []);

	const contextValue: MapConfigurationContextType = {
		// Map style state
		currentMapStyle,
		onToggleMapStyle: handleToggleMapStyle,

		// Map lock state
		isMapLocked,
		onToggleLock: handleToggleLock,

		// Lighting state
		currentLightPreset,
		onCycleTimeOfDay: handleCycleTimeOfDay,

		// Bearing state
		currentBearing,
		onCycleBearing: handleCycleBearing,
		setCurrentBearing,

		// Sun position state
		showSunDirection,
		onToggleSunDirection: handleToggleSunDirection,
		currentSunPosition,

		// Map zoom controls
		onZoomIn: handleZoomIn,
		onZoomOut: handleZoomOut,
	};

	return <MapConfigurationContext.Provider value={contextValue}>{children}</MapConfigurationContext.Provider>;
};
