import type { Coordinate } from "@routess/core";
import { closestPointOnSegment, haversineDistance } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { updateLineToRouteLayer, updateUserLocationLayer } from "@/features/routing/managers/MapLayerManager";
import { useDeviceHeading } from "@/hooks/useDeviceHeading";
import { useEnhancedLocation } from "@/hooks/useEnhancedLocation";
import { Logger } from "@/lib/logger";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { useIsMapLocked, useRoutePath } from "@/stores/routingStore";

// Show the off-track guide line only once the user is meaningfully off the
// route, so it stays hidden while they're essentially on it.
const OFF_TRACK_THRESHOLD_KM = 0.05; // 50 m

function nearestPointOnPath(point: Coordinate, path: Coordinate[]): { coord: Coordinate; distanceKm: number } | null {
	if (path.length < 2) return null;
	let best: { coord: Coordinate; distanceKm: number } | null = null;
	for (let i = 0; i < path.length - 1; i++) {
		const coord = closestPointOnSegment(point, path[i], path[i + 1]);
		const distanceKm = haversineDistance(point, coord);
		if (!best || distanceKm < best.distanceKm) best = { coord, distanceKm };
	}
	return best;
}

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
		heading: movementHeading,
	} = useEnhancedLocation({
		autoStart: false, // Start manually when needed
		trackingMode: "walking", // Optimized for walking
		onLocationUpdate: (state) => {
			// Update map with new location (with the latest known heading).
			if (mapRef.current && state.location) {
				updateUserLocationLayer(mapRef.current, state.location, headingRef.current);
			}
		},
	});

	const routePath = useRoutePath();
	const isMapLocked = useIsMapLocked();
	const showOffTrackGuideLine = useRedesignSettingsStore((s) => s.showOffTrackGuideLine);

	// Facing direction for the location cone: prefer the device compass (works
	// while stationary), fall back to GPS course-over-ground while moving.
	const compassHeading = useDeviceHeading();
	const showHeadingCone = useRedesignSettingsStore((s) => s.showHeadingCone);
	const rawHeading = compassHeading ?? movementHeading ?? null;
	const effectiveHeading = showHeadingCone ? rawHeading : null;
	const headingRef = useRef<number | null>(effectiveHeading);
	useEffect(() => {
		headingRef.current = effectiveHeading;
	}, [effectiveHeading]);

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

	// Update map with user location + heading from hook. Re-runs on heading
	// change too, so the cone rotates even while the user stands still.
	useEffect(() => {
		if (!mapRef.current) return;

		if (isMapReady && userLocation) {
			updateUserLocationLayer(mapRef.current, userLocation, effectiveHeading);
		}
	}, [userLocation, isMapReady, mapRef, effectiveHeading]);

	// Off-track guide line: a dashed connector from the user to the nearest
	// point on the route. Only in follow/lock mode, when enabled, and once
	// they're >50m off the route.
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !isMapReady) return;
		if (!showOffTrackGuideLine || !isMapLocked || !userLocation || routePath.length < 2) {
			updateLineToRouteLayer(map, null);
			return;
		}
		const nearest = nearestPointOnPath(userLocation, routePath);
		if (!nearest || nearest.distanceKm <= OFF_TRACK_THRESHOLD_KM) {
			updateLineToRouteLayer(map, null);
			return;
		}
		updateLineToRouteLayer(map, {
			type: "Feature",
			properties: {},
			geometry: { type: "LineString", coordinates: [userLocation, nearest.coord] },
		});
	}, [userLocation, routePath, isMapLocked, showOffTrackGuideLine, isMapReady, mapRef]);

	// Combined handler for the locate button that handles both locating and tracking
	const handleLocateButtonClick = useCallback(async () => {
		// Optimistic pre-fly: if we already have a usable location (current
		// or last-known) move the camera immediately so the button feels
		// responsive. A fresh GPS fix can take several seconds on desktop
		// and indoors, and the previous `maximumAge: 0` forced that wait on
		// every click. We still request a fresh fix below to correct the
		// position once it arrives.
		const optimistic = userLocation ?? (hasLastKnownLocation ? getLastKnownLocation() : null);
		let didPreFly = false;
		if (optimistic && mapRef.current) {
			mapRef.current.flyTo({ center: optimistic, zoom: 15 });
			didPreFly = true;
		}

		try {
			Logger.info("[UserLocationProvider] Requesting fresh location...");
			const freshLocation = await getCurrentLocation({
				enableHighAccuracy: true,
				timeout: 8000,
				// Accept a cached fix up to 30s old — plenty fresh for
				// "where am I right now" and lets the browser skip a
				// full GPS reacquire when it already has one.
				maximumAge: 30000,
			});

			if (freshLocation.location && mapRef.current) {
				mapRef.current.flyTo({ center: freshLocation.location, zoom: 17 });
				Logger.info("[UserLocationProvider] Centered on fresh location:", freshLocation.location);
			}

			if (hasRoute && !isLocationTracking) {
				Logger.info("[UserLocationProvider] Starting location tracking after successful locate");
				startLocationTracking();
			}
		} catch (error) {
			Logger.warn("[UserLocationProvider] Failed to get fresh location:", error);
			if (!didPreFly) {
				Logger.info("[UserLocationProvider] No location available to center on");
			}
		}
	}, [
		getCurrentLocation,
		mapRef,
		hasRoute,
		isLocationTracking,
		startLocationTracking,
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
