import { useCallback, useEffect, useState } from "react";
import { Logger } from "@/lib/logger";
import serviceWorkerManager, {
	type CacheStatus,
	type NetworkStatus,
	type ServiceWorkerState,
} from "@/lib/serviceWorker";

export interface UseServiceWorkerReturn {
	// Service Worker State
	swState: ServiceWorkerState;
	isOnline: boolean;
	networkStatus: NetworkStatus;

	// Cache Management
	cacheStatus: CacheStatus | null;
	isCacheLoading: boolean;

	// Actions
	updateServiceWorker: () => Promise<void>;
	refreshCacheStatus: () => Promise<void>;
	clearCache: (cacheName: string) => Promise<boolean>;
	clearAllCaches: () => Promise<void>;
	precacheRoute: (routeData: Record<string, unknown>) => Promise<boolean>;

	// Utilities
	formatCacheSize: (bytes: number) => string;
	getTotalCacheSize: () => number;
	getCacheEntryCount: () => number;
}

export function useServiceWorker(): UseServiceWorkerReturn {
	const [swState, setSwState] = useState<ServiceWorkerState>(serviceWorkerManager.getState());
	const [isOnline, setIsOnline] = useState<boolean>(!serviceWorkerManager.isOffline());
	const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(serviceWorkerManager.getNetworkStatus());
	const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
	const [isCacheLoading, setIsCacheLoading] = useState<boolean>(false);

	// Update service worker state
	const updateSwState = useCallback(() => {
		setSwState(serviceWorkerManager.getState());
	}, []);

	// Update network status
	const updateNetworkStatus = useCallback(() => {
		const online = !serviceWorkerManager.isOffline();
		setIsOnline(online);
		setNetworkStatus(serviceWorkerManager.getNetworkStatus());
		Logger.info("[useServiceWorker] Network status changed:", { online });
	}, []);

	// Refresh cache status
	const refreshCacheStatus = useCallback(async () => {
		setIsCacheLoading(true);
		try {
			const status = await serviceWorkerManager.getCacheStatus();
			setCacheStatus(status);
			Logger.info("[useServiceWorker] Cache status refreshed:", status);
		} catch (error) {
			Logger.error("[useServiceWorker] Failed to refresh cache status:", error);
		} finally {
			setIsCacheLoading(false);
		}
	}, []);

	// Update service worker
	const updateServiceWorker = useCallback(async () => {
		try {
			await serviceWorkerManager.skipWaiting();
			Logger.info("[useServiceWorker] Service worker update initiated");
		} catch (error) {
			Logger.error("[useServiceWorker] Failed to update service worker:", error);
		}
	}, []);

	// Clear specific cache
	const clearCache = useCallback(
		async (cacheName: string): Promise<boolean> => {
			try {
				const success = await serviceWorkerManager.clearCache(cacheName);
				if (success) {
					Logger.info("[useServiceWorker] Cache cleared:", cacheName);
					// Refresh cache status after clearing
					await refreshCacheStatus();
				}
				return success;
			} catch (error) {
				Logger.error("[useServiceWorker] Failed to clear cache:", cacheName, error);
				return false;
			}
		},
		[refreshCacheStatus],
	);

	// Clear all caches
	const clearAllCaches = useCallback(async () => {
		if (!cacheStatus) return;

		try {
			const cacheNames = Object.keys(cacheStatus);
			const clearPromises = cacheNames.map((cacheName) => serviceWorkerManager.clearCache(cacheName));

			await Promise.all(clearPromises);
			Logger.info("[useServiceWorker] All caches cleared");

			// Refresh cache status
			await refreshCacheStatus();
		} catch (error) {
			Logger.error("[useServiceWorker] Failed to clear all caches:", error);
		}
	}, [cacheStatus, refreshCacheStatus]);

	// Precache route
	const precacheRoute = useCallback(
		async (routeData: Record<string, unknown>): Promise<boolean> => {
			try {
				const success = await serviceWorkerManager.precacheRoute(routeData);
				if (success) {
					Logger.info("[useServiceWorker] Route precached successfully");
					// Refresh cache status after precaching
					await refreshCacheStatus();
				}
				return success;
			} catch (error) {
				Logger.error("[useServiceWorker] Failed to precache route:", error);
				return false;
			}
		},
		[refreshCacheStatus],
	);

	// Get total cache size
	const getTotalCacheSize = useCallback((): number => {
		if (!cacheStatus) return 0;

		return Object.values(cacheStatus).reduce((total, cache) => total + cache.size, 0);
	}, [cacheStatus]);

	// Get total cache entry count
	const getCacheEntryCount = useCallback((): number => {
		if (!cacheStatus) return 0;

		return Object.values(cacheStatus).reduce((total, cache) => total + cache.entries, 0);
	}, [cacheStatus]);

	// Format cache size
	const formatCacheSize = useCallback((bytes: number): string => {
		return serviceWorkerManager.formatCacheSize(bytes);
	}, []);

	// Set up event listeners
	useEffect(() => {
		// Service worker state changes
		const handleStateChange = () => {
			updateSwState();
		};

		const handleUpdateAvailable = () => {
			Logger.info("[useServiceWorker] Service worker update available");
			updateSwState();
		};

		const handleControlling = () => {
			Logger.info("[useServiceWorker] Service worker now controlling");
			updateSwState();
		};

		const handleError = (error: unknown) => {
			Logger.error("[useServiceWorker] Service worker error:", error);
			updateSwState();
		};

		// Register service worker event listeners
		serviceWorkerManager.on("statechange", handleStateChange);
		serviceWorkerManager.on("updateavailable", handleUpdateAvailable);
		serviceWorkerManager.on("controlling", handleControlling);
		serviceWorkerManager.on("error", handleError);

		// Network status listeners
		const handleOnline = () => updateNetworkStatus();
		const handleOffline = () => updateNetworkStatus();

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		// Initial cache status load
		refreshCacheStatus();

		// Cleanup
		return () => {
			serviceWorkerManager.off("statechange", handleStateChange);
			serviceWorkerManager.off("updateavailable", handleUpdateAvailable);
			serviceWorkerManager.off("controlling", handleControlling);
			serviceWorkerManager.off("error", handleError);

			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, [updateSwState, updateNetworkStatus, refreshCacheStatus]);

	// Development should never keep a stale PWA worker around.
	useEffect(() => {
		if (import.meta.env.DEV && serviceWorkerManager.isSupported()) {
			void navigator.serviceWorker
				.getRegistrations()
				.then(async (registrations) => {
					await Promise.all(registrations.map((registration) => registration.unregister()));

					if ("caches" in window) {
						const cacheNames = await caches.keys();
						await Promise.all(
							cacheNames
								.filter((cacheName) => cacheName.startsWith("routess-"))
								.map((cacheName) => caches.delete(cacheName)),
						);
					}

					Logger.info("[useServiceWorker] Disabled service workers and cleared Routess caches in development.");
				})
				.catch((error) => {
					Logger.error("[useServiceWorker] Development cleanup failed:", error);
				});
		}
	}, []);

	return {
		// State
		swState,
		isOnline,
		networkStatus,
		cacheStatus,
		isCacheLoading,

		// Actions
		updateServiceWorker,
		refreshCacheStatus,
		clearCache,
		clearAllCaches,
		precacheRoute,

		// Utilities
		formatCacheSize,
		getTotalCacheSize,
		getCacheEntryCount,
	};
}
