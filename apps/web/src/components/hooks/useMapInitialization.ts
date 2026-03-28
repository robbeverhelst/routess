import type { Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { PopupInfo as MIMPopupInfo } from "@/features/routing/managers/MapInteractionManager";
import { initializeMapInteractions } from "@/features/routing/managers/MapInteractionManager";
import {
	initializeSourcesAndLayers,
	updateRouteLayer,
	updateWaypointsLayer,
} from "@/features/routing/managers/MapLayerManager";
import { setCurrentRoutePath } from "@/features/routing/services/RouteCalculationService";
import { loadSharedRouteIntoMap } from "@/features/routing/services/RouteIOService";
import { Logger } from "@/lib/logger";
import { setupRouting } from "@/lib/routing";
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
					updateWaypointsLayer(map, currentState.waypoints, currentState.isMapLocked);

					if (currentState.routePath.length > 0) {
						updateRouteLayer(map, currentState.routePath);

						// Update the UI state from Zustand store
						setRouteDistance(currentState.routeDistance);
						setRouteDuration(currentState.routeDuration);
						setHasRoute(currentState.hasRoute);

						// Keep the route calculation service in sync with persisted state.
						setCurrentRoutePath(currentState.routePath);
					}
				}, 100); // 100ms delay to ensure layers are ready
			}

			const urlParams = new URLSearchParams(window.location.search);
			const encodedRoute = urlParams.get("route") || routeId;

			if (encodedRoute) {
				Logger.info("[useMapInitialization] Found shared route data, attempting to load...");

				const result = await loadSharedRouteIntoMap({
					map,
					accessToken: mapboxToken,
					encodedRoute,
					setRouteDistance,
					setRouteDuration,
					setHasRoute,
				});

				if (!result.success) {
					handleRouteInfoError(result.message || "Failed to load shared route.");
				} else if (urlParams.get("route")) {
					window.history.replaceState({}, document.title, window.location.pathname);
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
