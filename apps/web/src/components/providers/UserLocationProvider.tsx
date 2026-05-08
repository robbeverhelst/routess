import type { Map as MapboxMap } from "mapbox-gl";
import type React from "react";
import { createContext, useCallback, useContext, useEffect } from "react";
import { updateUserLocationLayer } from "@/features/routing/managers/MapLayerManager";
import { useEnhancedLocation } from "@/hooks/useEnhancedLocation";
import { Logger } from "@/lib/logger";

interface UserLocationContextType {
	// Location state
	location: [number, number] | null;
	error: string | null;
	isLoading: boolean;
	isTracking: boolean;
	accuracy: number | null;
	hasCurrentLocation: boolean;
	hasLastKnownLocation: boolean;

	// Location actions
	startTracking: () => void;
	stopTracking: () => void;
	getCurrentLocation: (
		options?: Partial<{ enableHighAccuracy: boolean; timeout: number; maximumAge: number }>,
	) => Promise<{
		location: [number, number] | null;
		accuracy: number | null;
		error: string | null;
	}>;
	getLastKnownLocation: () => [number, number] | null;

	// Combined handler for locate button
	handleLocateButtonClick: () => Promise<void>;
}

const UserLocationContext = createContext<UserLocationContextType | null>(null);

export const useUserLocation = () => {
	const context = useContext(UserLocationContext);
	if (!context) {
		throw new Error("useUserLocation must be used within a UserLocationProvider");
	}
	return context;
};
// Export context for separate import
export { UserLocationContext };

interface UserLocationProviderProps {
	children: React.ReactNode;
	mapRef: React.RefObject<MapboxMap | null>;
	hasRoute: boolean;
	isMapReady: boolean;
}

export const UserLocationProvider: React.FC<UserLocationProviderProps> = ({
	children,
	mapRef,
	hasRoute,
	isMapReady,
}) => {
	const {
		location: userLocation,
		error: locationError,
		isLoading: isUserLocationLoading,
		isTracking: isLocationTracking,
		accuracy: locationAccuracy,
		hasCurrentLocation,
		hasLastKnownLocation,
		startTracking: startLocationTracking,
		stopTracking: stopLocationTracking,
		getCurrentLocation,
		getLastKnownLocation,
	} = useEnhancedLocation({
		autoStart: false, // Start manually when needed
		trackingMode: "walking", // Optimized for walking
		onLocationUpdate: (state) => {
			// Update map with new location
			if (mapRef.current && state.location) {
				updateUserLocationLayer(mapRef.current, state.location);
			}
		},
	});

	// Auto-start tracking when user has a route
	useEffect(() => {
		if (isMapReady && hasRoute && !isLocationTracking) {
			Logger.info("[UserLocationProvider] Auto-starting location tracking for route navigation");
			startLocationTracking();
		}
	}, [isMapReady, hasRoute, isLocationTracking, startLocationTracking]);

	// Auto-stop tracking display when there are persistent errors
	useEffect(() => {
		if (isLocationTracking && locationError) {
			const timer = setTimeout(() => {
				if (isLocationTracking && locationError) {
					Logger.info("[UserLocationProvider] Auto-stopping location tracking due to persistent errors");
					stopLocationTracking();
				}
			}, 10000); // Stop after 10 seconds of persistent errors

			return () => clearTimeout(timer);
		}
	}, [isLocationTracking, locationError, stopLocationTracking]);

	// Update map with user location from hook
	useEffect(() => {
		if (!mapRef.current) return;

		if (isMapReady && userLocation) {
			updateUserLocationLayer(mapRef.current, userLocation);
		}
	}, [userLocation, isMapReady, mapRef]);

	// Combined handler for the locate button that handles both locating and tracking
	const handleLocateButtonClick = useCallback(async () => {
		try {
			// Always try to get a fresh location first - this will trigger permission request if needed
			Logger.info("[UserLocationProvider] Requesting fresh location...");
			const freshLocation = await getCurrentLocation({
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 0, // Force fresh reading
			});

			// Center on the fresh location if we got one
			if (freshLocation.location && mapRef.current) {
				mapRef.current.flyTo({ center: freshLocation.location, zoom: 17 });
				Logger.info("[UserLocationProvider] Centered on fresh location:", freshLocation.location);
			}

			// If we have a route and we're not tracking yet, start tracking
			if (hasRoute && !isLocationTracking) {
				Logger.info("[UserLocationProvider] Starting location tracking after successful locate");
				startLocationTracking();
			}
		} catch (error) {
			Logger.warn("[UserLocationProvider] Failed to get fresh location:", error);

			// Fall back to trying existing location or last known
			if (hasCurrentLocation && userLocation && mapRef.current) {
				mapRef.current.flyTo({ center: userLocation, zoom: 17 });
				Logger.info("[UserLocationProvider] Centered on current location");
			} else if (hasLastKnownLocation) {
				const lastKnown = getLastKnownLocation();
				if (lastKnown && mapRef.current) {
					mapRef.current.flyTo({ center: lastKnown, zoom: 15 });
					Logger.info("[UserLocationProvider] Centered on last known location");
				}
			} else {
				Logger.info("[UserLocationProvider] No location available to center on");
			}
		}
	}, [
		getCurrentLocation,
		mapRef,
		hasRoute,
		isLocationTracking,
		startLocationTracking,
		hasCurrentLocation,
		userLocation,
		hasLastKnownLocation,
		getLastKnownLocation,
	]);

	const contextValue: UserLocationContextType = {
		// Location state
		location: userLocation,
		error: locationError,
		isLoading: isUserLocationLoading,
		isTracking: isLocationTracking,
		accuracy: locationAccuracy,
		hasCurrentLocation,
		hasLastKnownLocation,

		// Location actions
		startTracking: startLocationTracking,
		stopTracking: stopLocationTracking,
		getCurrentLocation,
		getLastKnownLocation,

		// Combined handler
		handleLocateButtonClick,
	};

	return <UserLocationContext.Provider value={contextValue}>{children}</UserLocationContext.Provider>;
};
