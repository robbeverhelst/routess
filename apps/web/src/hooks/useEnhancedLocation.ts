import { useCallback, useEffect, useRef, useState } from "react";
import { Logger } from "@/lib/logger";
import { type LocationOptions, LocationService, type LocationState, locationService } from "@/services/LocationService";

export interface UseEnhancedLocationOptions {
	autoStart?: boolean;
	trackingMode?: "walking" | "driving" | "battery-optimized" | "custom";
	customOptions?: Partial<LocationOptions>;
	onLocationUpdate?: (state: LocationState) => void;
	onError?: (error: string, state: LocationState) => void;
	onPermissionChange?: (permission: PermissionState) => void;
}

export interface UseEnhancedLocationReturn {
	// Location state
	location: [number, number] | null;
	accuracy: number | null;
	heading: number | null;
	speed: number | null;
	timestamp: number | null;
	error: string | null;
	isLoading: boolean;
	isTracking: boolean;
	permissionState: "granted" | "denied" | "prompt" | "unknown";
	lastUpdateTime: number | null;

	// Utility states
	hasValidLocation: boolean;
	hasCurrentLocation: boolean;
	hasLastKnownLocation: boolean;
	isHighAccuracy: boolean;
	locationAge: number | null;

	// Control functions
	startTracking: (options?: Partial<LocationOptions>) => void;
	stopTracking: () => void;
	getCurrentLocation: (options?: Partial<LocationOptions>) => Promise<LocationState>;
	updateOptions: (options: Partial<LocationOptions>) => void;

	// Utility functions
	getLastKnownLocation: () => [number, number] | null;
	setTrackingMode: (mode: "walking" | "driving" | "battery-optimized") => void;
}

export function useEnhancedLocation(options: UseEnhancedLocationOptions = {}): UseEnhancedLocationReturn {
	const {
		autoStart = false,
		trackingMode = "walking",
		customOptions,
		onLocationUpdate,
		onError,
		onPermissionChange,
	} = options;

	// State from location service
	const [locationState, setLocationState] = useState<LocationState>(locationService.getState());

	// Derived utility states
	const [hasValidLocation, setHasValidLocation] = useState(locationService.hasValidLocation());
	const [hasCurrentLocation, setHasCurrentLocation] = useState(locationService.hasCurrentLocation());
	const [hasLastKnownLocation, setHasLastKnownLocation] = useState(locationService.hasLastKnownLocation());
	const [isHighAccuracy, setIsHighAccuracy] = useState(locationService.isHighAccuracy());
	const [locationAge, setLocationAge] = useState(locationService.getLocationAge());

	// Refs to store callback functions to avoid re-registering
	const onLocationUpdateRef = useRef(onLocationUpdate);
	const onErrorRef = useRef(onError);
	const onPermissionChangeRef = useRef(onPermissionChange);

	// Update refs when callbacks change
	useEffect(() => {
		onLocationUpdateRef.current = onLocationUpdate;
	}, [onLocationUpdate]);

	useEffect(() => {
		onErrorRef.current = onError;
	}, [onError]);

	useEffect(() => {
		onPermissionChangeRef.current = onPermissionChange;
	}, [onPermissionChange]);

	// Update derived states when location state changes
	const updateDerivedStates = useCallback(() => {
		setHasValidLocation(locationService.hasValidLocation());
		setHasCurrentLocation(locationService.hasCurrentLocation());
		setHasLastKnownLocation(locationService.hasLastKnownLocation());
		setIsHighAccuracy(locationService.isHighAccuracy());
		setLocationAge(locationService.getLocationAge());
	}, []);

	// Set up location service callbacks
	useEffect(() => {
		const callbacks = {
			onLocationUpdate: (state: LocationState) => {
				setLocationState(state);
				updateDerivedStates();
				if (onLocationUpdateRef.current) {
					onLocationUpdateRef.current(state);
				}
			},
			onError: (error: string, state: LocationState) => {
				setLocationState(state);
				updateDerivedStates();
				if (onErrorRef.current) {
					onErrorRef.current(error, state);
				}
			},
			onPermissionChange: (permission: PermissionState) => {
				// Update the state to reflect permission change
				setLocationState((prev) => ({ ...prev, permissionState: permission }));
				if (onPermissionChangeRef.current) {
					onPermissionChangeRef.current(permission);
				}
			},
			onTrackingStateChange: (isTracking: boolean) => {
				setLocationState((prev) => ({ ...prev, isTracking }));
				Logger.info(`[useEnhancedLocation] Tracking state changed: ${isTracking}`);
			},
		};

		locationService.setCallbacks(callbacks);

		// Initial state sync
		setLocationState(locationService.getState());
		updateDerivedStates();

		return () => {
			// Note: We don't clear callbacks here as the service is a singleton
			// and might be used by other components
		};
	}, [updateDerivedStates]);

	// Apply tracking mode and custom options
	useEffect(() => {
		let modeOptions: Partial<LocationOptions> = {};

		switch (trackingMode) {
			case "walking":
				modeOptions = LocationService.getWalkingConfig();
				break;
			case "driving":
				modeOptions = LocationService.getDrivingConfig();
				break;
			case "battery-optimized":
				modeOptions = LocationService.getBatteryOptimizedConfig();
				break;
			case "custom":
				modeOptions = customOptions || {};
				break;
		}

		if (Object.keys(modeOptions).length > 0) {
			locationService.updateOptions(modeOptions);
		}
	}, [trackingMode, customOptions]);

	// Auto-start tracking if requested
	useEffect(() => {
		if (autoStart && !locationState.isTracking) {
			Logger.info("[useEnhancedLocation] Auto-starting location tracking");
			locationService.startTracking();
		}
	}, [autoStart, locationState.isTracking]);

	// Control functions
	const startTracking = useCallback((trackingOptions?: Partial<LocationOptions>) => {
		Logger.info("[useEnhancedLocation] Starting location tracking");
		locationService.startTracking(trackingOptions);
	}, []);

	const stopTracking = useCallback(() => {
		Logger.info("[useEnhancedLocation] Stopping location tracking");
		locationService.stopTracking();
	}, []);

	const getCurrentLocation = useCallback(async (locationOptions?: Partial<LocationOptions>): Promise<LocationState> => {
		Logger.info("[useEnhancedLocation] Getting current location");
		return locationService.getCurrentLocation(locationOptions);
	}, []);

	const updateLocationOptions = useCallback((newOptions: Partial<LocationOptions>) => {
		Logger.info("[useEnhancedLocation] Updating location options:", newOptions);
		locationService.updateOptions(newOptions);
	}, []);

	const getLastKnownLocation = useCallback((): [number, number] | null => {
		return locationService.getLastKnownLocation();
	}, []);

	const setTrackingMode = useCallback((mode: "walking" | "driving" | "battery-optimized") => {
		Logger.info(`[useEnhancedLocation] Setting tracking mode to: ${mode}`);

		let modeOptions: Partial<LocationOptions>;
		switch (mode) {
			case "walking":
				modeOptions = LocationService.getWalkingConfig();
				break;
			case "driving":
				modeOptions = LocationService.getDrivingConfig();
				break;
			case "battery-optimized":
				modeOptions = LocationService.getBatteryOptimizedConfig();
				break;
		}

		locationService.updateOptions(modeOptions);
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			// Only stop tracking if this hook was the one that started it with autoStart
			if (autoStart && locationState.isTracking) {
				Logger.info("[useEnhancedLocation] Component unmounting, stopping auto-started tracking");
				locationService.stopTracking();
			}
		};
	}, [autoStart, locationState.isTracking]);

	return {
		// Location state
		location: locationState.location,
		accuracy: locationState.accuracy,
		heading: locationState.heading,
		speed: locationState.speed,
		timestamp: locationState.timestamp,
		error: locationState.error,
		isLoading: locationState.isLoading,
		isTracking: locationState.isTracking,
		permissionState: locationState.permissionState,
		lastUpdateTime: locationState.lastUpdateTime,

		// Utility states
		hasValidLocation,
		hasCurrentLocation,
		hasLastKnownLocation,
		isHighAccuracy,
		locationAge,

		// Control functions
		startTracking,
		stopTracking,
		getCurrentLocation,
		updateOptions: updateLocationOptions,

		// Utility functions
		getLastKnownLocation,
		setTrackingMode,
	};
}
