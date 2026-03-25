import type { Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { PopupInfo as MIMPopupInfo } from "@/features/routing/managers/MapInteractionManager";
import { initializeMapInteractions } from "@/features/routing/managers/MapInteractionManager";
import { initializeSourcesAndLayers } from "@/features/routing/managers/MapLayerManager";
import { Logger } from "@/lib/logger";
import { setupRouting } from "@/lib/routing";
import { decompressAndParse } from "@/lib/shareUtils";
import { useRoutingStore } from "@/stores/routingStore";

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
}: UseMapInitializationProps) => {
	const routingDisposerRef = useRef<(() => void) | null>(null);
	const routeInitTimeoutRef = useRef<number | null>(null);

	// Handle map load
	const handleMapLoad = useCallback(
		async (event: { target: MapboxMap }) => {
			Logger.info("[useMapInitialization] Map loaded, setting up routing");
			const map = event.target;

			setupRouting(map, isMapLockedRef, mapboxToken);

			// Initialize map sources and layers first
			initializeSourcesAndLayers(map);

			// Initialize map interactions (click handlers, etc.)
			const disposer = initializeMapInteractions(
				map,
				mapboxToken,
				setRouteDistance,
				setRouteDuration,
				setHasRoute,
				setPopup,
				handleWaypointError,
				isMapLockedRef,
			);

			// Store the disposer for cleanup
			routingDisposerRef.current = disposer;

			// Apply light preset immediately
			map.setConfigProperty("basemap", "lightPreset", currentLightPreset);

			Logger.info("[useMapInitialization] Routing setup complete");

			// Restore route from Zustand store if it exists (after page refresh)
			const currentState = useRoutingStore.getState();

			if (currentState.waypoints.length > 0) {
				// Small delay to ensure map layers are fully initialized
				setTimeout(() => {
					// Restore waypoints and route visualization
					import("@/features/routing/managers/MapLayerManager").then(({ updateWaypointsLayer, updateRouteLayer }) => {
						updateWaypointsLayer(map, currentState.waypoints, currentState.isMapLocked);

						if (currentState.routePath.length > 0) {
							updateRouteLayer(map, currentState.routePath);

							// Update the UI state from Zustand store
							setRouteDistance(currentState.routeDistance);
							setRouteDuration(currentState.routeDuration);
							setHasRoute(currentState.hasRoute);

							// Also update the RouteCalculationService module state
							import("@/features/routing/services/RouteCalculationService").then(({ setCurrentRoutePath }) => {
								setCurrentRoutePath(currentState.routePath);
							});
						}
					});
				}, 100); // 100ms delay to ensure layers are ready
			}

			// Check for shared route data in URL
			const urlParams = new URLSearchParams(window.location.search);
			const routeDataParam = urlParams.get("route");

			// Check for routeId from router props
			if (routeId && !routeDataParam) {
				Logger.info("[useMapInitialization] Loading route from routeId:", routeId);
				try {
					const loadedData = decompressAndParse(routeId);
					if (loadedData && map && mapboxToken) {
						Logger.info("[useMapInitialization] Route loading from routeId not yet implemented.");
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
					handleRouteInfoError("Failed to read shared route data. The link may be corrupted or invalid.");
				}

				if (loadedData && map && mapboxToken) {
					try {
						Logger.info("[useMapInitialization] Route loading from URL not yet implemented.");
						// Clean the URL
						window.history.replaceState({}, document.title, window.location.pathname);
					} catch (err) {
						Logger.error("[useMapInitialization] Error setting route data from URL:", err);
						handleRouteInfoError("Failed to load shared route. The link may be invalid or corrupted.");
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
