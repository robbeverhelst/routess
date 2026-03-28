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
		if (mapRef.current) {
			const newStyle: MapStyle = currentMapStyle === "standard" ? "satellite" : "standard";
			const mapStyleUrl =
				newStyle === "satellite" ? "mapbox://styles/mapbox/satellite-streets-v12" : "mapbox://styles/mapbox/standard";

			mapRef.current.setStyle(mapStyleUrl);
			setCurrentMapStyle(newStyle);

			// Re-initialize all layers after style change (style.load removes all custom layers)
			mapRef.current.once("style.load", () => {
				if (mapRef.current) {
					// For satellite view, ensure we maintain the space background
					if (newStyle === "satellite") {
						mapRef.current.setProjection("globe");
						mapRef.current.setFog({
							color: "rgb(186, 210, 235)",
							"high-color": "rgb(36, 92, 223)",
							"horizon-blend": 0.02,
							"space-color": "rgb(11, 11, 25)",
							"star-intensity": 0.6,
						});
					}

					// Re-initialize all map layers (route, waypoints, etc.)
					Logger.info("[MapConfigurationProvider] Re-initializing map layers after style change");

					// 1. Initialize the layer structure
					initializeSourcesAndLayers(mapRef.current);

					// 2. Restore current route data from Zustand store
					if (waypoints.length > 0) {
						Logger.info(
							"[MapConfigurationProvider] Restoring waypoints to map:",
							waypoints.length,
							"locked:",
							isMapLocked,
						);
						updateWaypointsLayer(mapRef.current, waypoints, isMapLocked);
					}

					if (routePath && routePath.length > 0) {
						Logger.info("[MapConfigurationProvider] Restoring route path to map:", routePath.length, "points");
						updateRouteLayer(mapRef.current, routePath);
					}
				}
			});

			Logger.info(`[MapConfigurationProvider] Map style changed to: ${newStyle}`);
		}
	}, [currentMapStyle, mapRef, waypoints, routePath, isMapLocked]);

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
