import { loadLanguageFromLocalStorage } from "@/features/routing/services/LocalStorageService";
import { t } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { haversineDistance } from "@/lib/utils/geospatial";

export interface LocationState {
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
}

export interface LocationOptions {
	enableHighAccuracy?: boolean;
	timeout?: number;
	maximumAge?: number;
	distanceFilter?: number; // Minimum distance in meters before update
	updateInterval?: number; // Minimum time in ms between updates
	retryAttempts?: number;
	retryDelay?: number;
}

export interface LocationServiceCallbacks {
	onLocationUpdate?: (state: LocationState) => void;
	onError?: (error: string, state: LocationState) => void;
	onPermissionChange?: (permission: PermissionState) => void;
	onTrackingStateChange?: (isTracking: boolean) => void;
}

export class LocationService {
	private static instance: LocationService | null = null;
	private state: LocationState;
	private callbacks: LocationServiceCallbacks = {};
	private watchId: number | null = null;
	private retryTimeoutId: number | null = null;
	private lastKnownGoodLocation: [number, number] | null = null;
	private retryCount = 0;
	private isDestroyed = false;
	private permissionWatcher: PermissionStatus | null = null;

	// Default options optimized for walking/navigation
	private defaultOptions: LocationOptions = {
		enableHighAccuracy: true,
		timeout: 15000, // 15 seconds
		maximumAge: 5000, // 5 seconds
		distanceFilter: 5, // 5 meters minimum movement
		updateInterval: 2000, // 2 seconds minimum between updates
		retryAttempts: 5,
		retryDelay: 1000, // Start with 1 second, exponential backoff
	};

	private currentOptions: LocationOptions;

	private constructor() {
		this.state = {
			location: this.loadLastKnownLocation(),
			accuracy: null,
			heading: null,
			speed: null,
			timestamp: null,
			error: null,
			isLoading: false,
			isTracking: false,
			permissionState: "unknown",
			lastUpdateTime: null,
		};
		this.currentOptions = { ...this.defaultOptions };
		this.lastKnownGoodLocation = this.state.location;
		this.initializePermissionWatcher();
	}

	public static getInstance(): LocationService {
		if (!LocationService.instance) {
			LocationService.instance = new LocationService();
		}
		return LocationService.instance;
	}

	public static destroyInstance(): void {
		if (LocationService.instance) {
			LocationService.instance.destroy();
			LocationService.instance = null;
		}
	}

	private loadLastKnownLocation(): [number, number] | null {
		try {
			const stored = localStorage.getItem("lastKnownLocation");
			if (stored) {
				const parsed = JSON.parse(stored);
				if (
					Array.isArray(parsed) &&
					parsed.length === 2 &&
					typeof parsed[0] === "number" &&
					typeof parsed[1] === "number"
				) {
					Logger.info("[LocationService] Loaded last known location from storage");
					return parsed as [number, number];
				}
			}
		} catch (error) {
			Logger.error("[LocationService] Error loading last known location:", error);
		}
		return null;
	}

	private saveLastKnownLocation(location: [number, number]): void {
		try {
			localStorage.setItem("lastKnownLocation", JSON.stringify(location));
			this.lastKnownGoodLocation = location;
		} catch (error) {
			Logger.error("[LocationService] Error saving last known location:", error);
		}
	}

	private async initializePermissionWatcher(): Promise<void> {
		if (!("permissions" in navigator)) {
			Logger.warn("[LocationService] Permissions API not supported");
			return;
		}

		try {
			const permission = await navigator.permissions.query({ name: "geolocation" });
			this.state.permissionState = permission.state;
			this.permissionWatcher = permission;

			permission.addEventListener("change", () => {
				this.state.permissionState = permission.state;
				this.notifyCallbacks("onPermissionChange", permission.state);

				if (permission.state === "denied" && this.state.isTracking) {
					this.stopTracking();
					this.updateState({
						error: "Location permission denied. Please enable location access in your browser settings.",
						isLoading: false,
					});
				} else if (permission.state === "granted" && !this.state.isTracking && this.watchId === null) {
					// Auto-resume tracking if permission was re-granted
					Logger.info("[LocationService] Permission re-granted, resuming tracking");
					this.startTracking();
				}
			});
		} catch (error) {
			Logger.error("[LocationService] Error setting up permission watcher:", error);
		}
	}

	public setCallbacks(callbacks: LocationServiceCallbacks): void {
		this.callbacks = { ...this.callbacks, ...callbacks };
	}

	public updateOptions(options: Partial<LocationOptions>): void {
		this.currentOptions = { ...this.currentOptions, ...options };

		// If tracking is active, restart with new options
		if (this.state.isTracking) {
			Logger.info("[LocationService] Options updated, restarting tracking");
			this.stopTracking();
			this.startTracking();
		}
	}

	public getState(): LocationState {
		return { ...this.state };
	}

	public async getCurrentLocation(options?: Partial<LocationOptions>): Promise<LocationState> {
		if (!this.isGeolocationSupported()) {
			const currentLanguage = loadLanguageFromLocalStorage();
			const error = t("location.error.notSupported", currentLanguage);
			this.updateState({ error, isLoading: false });
			throw new Error(error);
		}

		const opts = { ...this.currentOptions, ...options };
		this.updateState({ isLoading: true, error: null });

		return new Promise((resolve, reject) => {
			const timeoutId = setTimeout(
				() => {
					const error = "Location request timed out";
					this.updateState({ error, isLoading: false });
					reject(new Error(error));
				},
				opts.timeout || this.defaultOptions.timeout || 15000,
			);

			navigator.geolocation.getCurrentPosition(
				(position) => {
					clearTimeout(timeoutId);
					this.handleLocationSuccess(position);
					resolve(this.getState());
				},
				(error) => {
					clearTimeout(timeoutId);
					this.handleLocationError(error);
					reject(new Error(this.state.error || "Unknown location error"));
				},
				{
					enableHighAccuracy: opts.enableHighAccuracy,
					timeout: opts.timeout,
					maximumAge: opts.maximumAge,
				},
			);
		});
	}

	public startTracking(options?: Partial<LocationOptions>): void {
		if (this.isDestroyed) {
			Logger.warn("[LocationService] Cannot start tracking - service is destroyed");
			return;
		}

		if (!this.isGeolocationSupported()) {
			const currentLanguage = loadLanguageFromLocalStorage();
			this.updateState({
				error: t("location.error.notSupported", currentLanguage),
				isLoading: false,
			});
			return;
		}

		if (this.state.isTracking) {
			Logger.info("[LocationService] Already tracking location");
			return;
		}

		if (options) {
			this.updateOptions(options);
		}

		this.updateState({ isTracking: true, isLoading: true, error: null });
		this.retryCount = 0;
		this.startLocationWatch();

		Logger.info("[LocationService] Started location tracking with options:", this.currentOptions);
	}

	public stopTracking(): void {
		if (this.watchId !== null) {
			navigator.geolocation.clearWatch(this.watchId);
			this.watchId = null;
		}

		if (this.retryTimeoutId !== null) {
			clearTimeout(this.retryTimeoutId);
			this.retryTimeoutId = null;
		}

		this.updateState({ isTracking: false, isLoading: false });
		this.retryCount = 0;

		Logger.info("[LocationService] Stopped location tracking");
	}

	private startLocationWatch(): void {
		if (this.watchId !== null) {
			navigator.geolocation.clearWatch(this.watchId);
		}

		this.watchId = navigator.geolocation.watchPosition(
			(position) => this.handleLocationSuccess(position),
			(error) => this.handleLocationError(error),
			{
				enableHighAccuracy: this.currentOptions.enableHighAccuracy,
				timeout: this.currentOptions.timeout,
				maximumAge: this.currentOptions.maximumAge,
			},
		);
	}

	private handleLocationSuccess(position: GeolocationPosition): void {
		const now = Date.now();
		const coords = position.coords;

		// Validate location data
		if (!this.isValidLocation(coords)) {
			Logger.warn("[LocationService] Invalid location data received:", coords);
			return;
		}

		const newLocation: [number, number] = [coords.longitude, coords.latitude];

		// Apply distance filter
		if (this.shouldFilterByDistance(newLocation)) {
			return;
		}

		// Apply time filter
		if (this.shouldFilterByTime(now)) {
			return;
		}

		// Update state with new location
		this.updateState({
			location: newLocation,
			accuracy: coords.accuracy,
			heading: coords.heading,
			speed: coords.speed,
			timestamp: position.timestamp,
			error: null,
			isLoading: false,
			lastUpdateTime: now,
		});

		// Save to localStorage
		this.saveLastKnownLocation(newLocation);

		// Reset retry count on success
		this.retryCount = 0;

		Logger.debug("[LocationService] Location updated:", {
			location: newLocation,
			accuracy: coords.accuracy,
			speed: coords.speed,
			heading: coords.heading,
		});
	}

	private handleLocationError(error: GeolocationPositionError): void {
		const currentLanguage = loadLanguageFromLocalStorage();
		let errorMessage = "Unable to access your location";
		let shouldRetry = false;
		let shouldStopTracking = false;

		switch (error.code) {
			case error.PERMISSION_DENIED:
				errorMessage = t("location.error.permissionDenied", currentLanguage);
				this.updateState({ permissionState: "denied" });
				shouldStopTracking = true; // Stop tracking for permission denied
				break;
			case error.POSITION_UNAVAILABLE:
				errorMessage = t("location.error.positionUnavailable", currentLanguage);
				shouldRetry = true;
				// For position unavailable, we'll be more patient and try longer
				break;
			case error.TIMEOUT:
				errorMessage = t("location.error.timeout", currentLanguage);
				shouldRetry = true;
				break;
			default:
				errorMessage = `Location error: ${error.message}`;
				shouldRetry = true;
				break;
		}

		// Log position unavailable as warning since it's common and often temporary
		if (error.code === error.POSITION_UNAVAILABLE) {
			Logger.warn("[LocationService] Position unavailable (common GPS issue):", {
				code: error.code,
				message: error.message,
			});
		} else {
			Logger.error("[LocationService] Location error:", {
				code: error.code,
				message: error.message,
			});
		}

		// Stop tracking immediately for unrecoverable errors
		if (shouldStopTracking) {
			this.updateState({
				error: errorMessage,
				isLoading: false,
				isTracking: false,
			});
			this.stopTracking();
			return;
		}

		this.updateState({
			error: errorMessage,
			isLoading: shouldRetry && this.retryCount < (this.currentOptions.retryAttempts || 0),
		});

		// Retry logic for recoverable errors
		if (shouldRetry && this.state.isTracking && this.retryCount < (this.currentOptions.retryAttempts || 0)) {
			this.scheduleRetry();
		} else if (this.state.isTracking && this.currentOptions.enableHighAccuracy) {
			// If we've exhausted retries but still tracking, try with lower accuracy
			this.tryFallbackOptions();
		} else if (this.state.isTracking && error.code === error.POSITION_UNAVAILABLE) {
			// For position unavailable, keep trying with extended patience
			Logger.info("[LocationService] Position unavailable - continuing with extended retry");
			this.retryCount = Math.max(0, this.retryCount - 2); // Reduce retry count to extend attempts
			this.scheduleRetry();
		} else if (this.state.isTracking) {
			// If we've exhausted all options, stop tracking
			Logger.warn("[LocationService] All location attempts failed, stopping tracking");
			this.updateState({
				error: "Unable to get your location after multiple attempts. Please check your GPS and try again.",
				isLoading: false,
				isTracking: false,
			});
			this.stopTracking();
		}
	}

	private scheduleRetry(): void {
		this.retryCount++;
		const delay = (this.currentOptions.retryDelay || 1000) * 2 ** (this.retryCount - 1); // Exponential backoff

		Logger.info(`[LocationService] Scheduling retry ${this.retryCount} in ${delay}ms`);

		this.retryTimeoutId = window.setTimeout(() => {
			if (this.state.isTracking && !this.isDestroyed) {
				Logger.info(`[LocationService] Retrying location request (attempt ${this.retryCount})`);
				this.startLocationWatch();
			}
		}, delay);
	}

	private tryFallbackOptions(): void {
		if (this.currentOptions.enableHighAccuracy) {
			Logger.info("[LocationService] Trying fallback with lower accuracy");
			this.updateOptions({
				enableHighAccuracy: false,
				timeout: 20000,
				maximumAge: 60000,
			});
			this.retryCount = 0; // Reset retry count for fallback attempt
		} else {
			// Already tried fallback, stop tracking
			Logger.warn("[LocationService] Fallback options also failed, stopping tracking");
			this.updateState({
				error: "Unable to get your location. Please check your GPS settings and try again.",
				isLoading: false,
				isTracking: false,
			});
			this.stopTracking();
		}
	}

	private isValidLocation(coords: GeolocationCoordinates): boolean {
		return (
			typeof coords.latitude === "number" &&
			typeof coords.longitude === "number" &&
			!Number.isNaN(coords.latitude) &&
			!Number.isNaN(coords.longitude) &&
			coords.latitude >= -90 &&
			coords.latitude <= 90 &&
			coords.longitude >= -180 &&
			coords.longitude <= 180 &&
			coords.accuracy > 0
		);
	}

	private shouldFilterByDistance(newLocation: [number, number]): boolean {
		if (!this.state.location || !this.currentOptions.distanceFilter) {
			return false;
		}

		const distance = this.calculateDistance(this.state.location, newLocation);
		return distance < this.currentOptions.distanceFilter;
	}

	private shouldFilterByTime(now: number): boolean {
		if (!this.state.lastUpdateTime || !this.currentOptions.updateInterval) {
			return false;
		}

		return now - this.state.lastUpdateTime < this.currentOptions.updateInterval;
	}

	private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
		// Use shared geospatial utility and convert km to meters
		return haversineDistance(coord1, coord2) * 1000;
	}

	private updateState(updates: Partial<LocationState>): void {
		this.state = { ...this.state, ...updates };
		this.notifyCallbacks("onLocationUpdate", this.state);

		if (updates.error) {
			this.notifyCallbacks("onError", updates.error, this.state);
		}

		if (updates.isTracking !== undefined) {
			this.notifyCallbacks("onTrackingStateChange", updates.isTracking);
		}
	}

	private notifyCallbacks(callbackName: keyof LocationServiceCallbacks, ...args: unknown[]): void {
		const callback = this.callbacks[callbackName];
		if (callback) {
			try {
				(callback as (...callbackArgs: unknown[]) => void)(...args);
			} catch (error) {
				Logger.error(`[LocationService] Error in ${callbackName} callback:`, error);
			}
		}
	}

	private isGeolocationSupported(): boolean {
		return "geolocation" in navigator;
	}

	public destroy(): void {
		this.isDestroyed = true;
		this.stopTracking();

		if (this.permissionWatcher) {
			// Note: There's no standard way to remove permission event listeners
			// The listener will be cleaned up when the page unloads
			this.permissionWatcher = null;
		}

		this.callbacks = {};
		Logger.info("[LocationService] Service destroyed");
	}

	// Utility methods for external use
	public hasValidLocation(): boolean {
		return this.state.location !== null && !this.state.error;
	}

	public hasCurrentLocation(): boolean {
		return this.hasValidLocation() && this.state.timestamp !== null && Date.now() - this.state.timestamp < 30000; // Within last 30 seconds
	}

	public hasLastKnownLocation(): boolean {
		return this.lastKnownGoodLocation !== null;
	}

	public getLastKnownLocation(): [number, number] | null {
		return this.lastKnownGoodLocation;
	}

	public getLocationAge(): number | null {
		if (!this.state.timestamp) return null;
		return Date.now() - this.state.timestamp;
	}

	public isHighAccuracy(): boolean {
		return this.state.accuracy !== null && this.state.accuracy <= 10; // Within 10 meters
	}

	// Preset configurations for different use cases
	public static getWalkingConfig(): LocationOptions {
		return {
			enableHighAccuracy: true,
			timeout: 20000, // Increased to 20 seconds for better GPS acquisition
			maximumAge: 10000, // Allow slightly older readings (10 seconds)
			distanceFilter: 3, // 3 meters for walking
			updateInterval: 1500, // 1.5 seconds for responsive updates
			retryAttempts: 5, // More retry attempts for position unavailable
			retryDelay: 3000, // Longer delay between retries
		};
	}

	public static getDrivingConfig(): LocationOptions {
		return {
			enableHighAccuracy: true,
			timeout: 8000,
			maximumAge: 5000,
			distanceFilter: 10, // 10 meters for driving
			updateInterval: 3000, // 3 seconds
			retryAttempts: 5,
			retryDelay: 1000,
		};
	}

	public static getBatteryOptimizedConfig(): LocationOptions {
		return {
			enableHighAccuracy: false,
			timeout: 15000,
			maximumAge: 30000,
			distanceFilter: 50, // 50 meters
			updateInterval: 10000, // 10 seconds
			retryAttempts: 2,
			retryDelay: 5000,
		};
	}
}

// Export singleton instance
export const locationService = LocationService.getInstance();
