// Service Worker Manager for Routess PWA
import { Logger } from "./logger";

export interface CacheStatus {
	[cacheName: string]: {
		entries: number;
		size: number;
	};
}

export interface ServiceWorkerState {
	isSupported: boolean;
	isRegistered: boolean;
	isControlling: boolean;
	hasUpdate: boolean;
	isInstalling: boolean;
	registration: ServiceWorkerRegistration | null;
}

export interface NetworkStatus {
	online: boolean;
	effectiveType: string;
	downlink: number;
	rtt: number;
}

type EventCallback = (data?: unknown) => void;

const CONTROLLER_RELOAD_GUARD_KEY = "routess:sw-controller-reload-at";
const CONTROLLER_RELOAD_GUARD_WINDOW_MS = 30_000;
const SERVICE_WORKER_REQUEST_TIMEOUT_MS = 10_000;
const ROUTE_PRECACHE_TIMEOUT_MS = 30_000;

class ServiceWorkerManager {
	private registration: ServiceWorkerRegistration | null = null;
	private updateAvailable = false;
	private listeners: Map<string, EventCallback[]> = new Map();

	constructor() {
		this.initializeListeners();
	}

	private initializeListeners() {
		// Initialize listener arrays
		this.listeners.set("statechange", []);
		this.listeners.set("updateavailable", []);
		this.listeners.set("controlling", []);
		this.listeners.set("error", []);
	}

	// Event listener management
	on(event: string, callback: EventCallback) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, []);
		}
		this.listeners.get(event)?.push(callback);
	}

	off(event: string, callback: EventCallback) {
		const eventListeners = this.listeners.get(event);
		if (eventListeners) {
			const index = eventListeners.indexOf(callback);
			if (index > -1) {
				eventListeners.splice(index, 1);
			}
		}
	}

	private emit(event: string, data?: unknown) {
		const eventListeners = this.listeners.get(event);
		if (eventListeners) {
			eventListeners.forEach((callback) => {
				callback(data);
			});
		}
	}

	// Check if service workers are supported
	isSupported(): boolean {
		return "serviceWorker" in navigator;
	}

	private getController(): ServiceWorker | null {
		if (!this.isSupported()) {
			return null;
		}

		return navigator.serviceWorker.controller ?? null;
	}

	private shouldReloadForControllerChange(): boolean {
		try {
			const lastReloadAt = window.sessionStorage.getItem(CONTROLLER_RELOAD_GUARD_KEY);
			const now = Date.now();

			if (lastReloadAt && now - Number(lastReloadAt) < CONTROLLER_RELOAD_GUARD_WINDOW_MS) {
				Logger.warn("[SW Manager] Suppressing repeated controller-change reload");
				return false;
			}

			window.sessionStorage.setItem(CONTROLLER_RELOAD_GUARD_KEY, String(now));
			return true;
		} catch (error) {
			Logger.warn("[SW Manager] Failed to persist controller-change reload guard:", error);
			return true;
		}
	}

	// Register the service worker
	async register(): Promise<ServiceWorkerRegistration | null> {
		if (!this.isSupported()) {
			Logger.debug("[SW Manager] Service workers not supported");
			return null;
		}

		try {
			Logger.debug("[SW Manager] Registering service worker...");

			this.registration = await navigator.serviceWorker.register("/sw.js", {
				scope: "/",
			});

			Logger.debug("[SW Manager] Service worker registered successfully");

			// Set up event listeners
			this.setupEventListeners();

			// Check for updates
			this.checkForUpdates();

			this.emit("statechange", this.getState());
			return this.registration;
		} catch (error) {
			Logger.error("[SW Manager] Service worker registration failed:", error);
			this.emit("error", error);
			return null;
		}
	}

	private setupEventListeners() {
		if (!this.registration || !this.isSupported()) return;

		// Listen for service worker updates
		this.registration.addEventListener("updatefound", () => {
			Logger.debug("[SW Manager] Service worker update found");
			const newWorker = this.registration?.installing;

			if (newWorker) {
				this.emit("statechange", this.getState());

				newWorker.addEventListener("statechange", () => {
					Logger.debug("[SW Manager] New service worker state:", newWorker.state);

					if (newWorker.state === "installed" && this.getController()) {
						// New service worker is installed and ready
						this.updateAvailable = true;
						this.emit("updateavailable", newWorker);
					}

					this.emit("statechange", this.getState());
				});
			}
		});

		// Listen for controller changes
		navigator.serviceWorker.addEventListener("controllerchange", () => {
			Logger.debug("[SW Manager] Service worker controller changed");
			this.emit("controlling");
			this.emit("statechange", this.getState());

			// Reload the page when a new service worker takes control
			if (this.updateAvailable && this.shouldReloadForControllerChange()) {
				window.location.reload();
			}
		});

		// Listen for messages from service worker
		navigator.serviceWorker.addEventListener("message", (event) => {
			this.handleServiceWorkerMessage(event);
		});
	}

	private handleServiceWorkerMessage(event: MessageEvent) {
		const { type, data } = event.data;
		Logger.debug("[SW Manager] Received message from service worker:", type, data);

		switch (type) {
			case "CACHE_STATUS":
				this.emit("cachestatus", data);
				break;
			case "CACHE_CLEARED":
				this.emit("cachecleared", data);
				break;
			case "ROUTE_PRECACHED":
				this.emit("routeprecached", data);
				break;
		}
	}

	// Check for service worker updates
	async checkForUpdates(): Promise<void> {
		if (!this.registration) return;

		try {
			await this.registration.update();
			Logger.debug("[SW Manager] Checked for service worker updates");
		} catch (error) {
			Logger.error("[SW Manager] Failed to check for updates:", error);
		}
	}

	// Skip waiting and activate new service worker
	async skipWaiting(): Promise<void> {
		if (!this.registration?.waiting) {
			Logger.warn("[SW Manager] No waiting service worker to activate");
			return;
		}

		try {
			// Send skip waiting message to the waiting service worker
			this.registration.waiting.postMessage({ type: "SKIP_WAITING" });
			Logger.debug("[SW Manager] Sent skip waiting message to service worker");
		} catch (error) {
			Logger.error("[SW Manager] Failed to skip waiting:", error);
		}
	}

	// Get current service worker state
	getState(): ServiceWorkerState {
		return {
			isSupported: this.isSupported(),
			isRegistered: !!this.registration,
			isControlling: !!this.getController(),
			hasUpdate: this.updateAvailable,
			isInstalling: !!this.registration?.installing,
			registration: this.registration,
		};
	}

	// Cache management methods
	async getCacheStatus(): Promise<CacheStatus | null> {
		const controller = this.getController();
		if (!controller) {
			Logger.debug("[SW Manager] No service worker controller available");
			return null;
		}

		return this.requestServiceWorker<CacheStatus>("GET_CACHE_STATUS", undefined, "CACHE_STATUS", 5000);
	}

	async clearCache(cacheName: string): Promise<boolean> {
		const controller = this.getController();
		if (!controller) {
			Logger.debug("[SW Manager] No service worker controller available");
			return false;
		}

		const response = await this.requestServiceWorker<{ cacheName: string }>(
			"CLEAR_CACHE",
			{ cacheName },
			"CACHE_CLEARED",
			SERVICE_WORKER_REQUEST_TIMEOUT_MS,
		);
		return response?.cacheName === cacheName;
	}

	async precacheRoute(routeData: Record<string, unknown>): Promise<boolean> {
		const controller = this.getController();
		if (!controller) {
			Logger.debug("[SW Manager] No service worker controller available");
			return false;
		}

		const response = await this.requestServiceWorker<Record<string, unknown>>(
			"PRECACHE_ROUTE",
			{ routeData },
			"ROUTE_PRECACHED",
			ROUTE_PRECACHE_TIMEOUT_MS,
		);
		return !!response;
	}

	private requestServiceWorker<T>(
		type: string,
		data: Record<string, unknown> | undefined,
		responseType: string,
		timeoutMs: number,
	): Promise<T | null> {
		const controller = this.getController();
		if (!controller) return Promise.resolve(null);

		return new Promise((resolve) => {
			const messageChannel = new MessageChannel();
			let settled = false;

			const finish = (value: T | null) => {
				if (settled) return;
				settled = true;
				window.clearTimeout(timeoutId);
				messageChannel.port1.close();
				resolve(value);
			};

			const timeoutId = window.setTimeout(() => finish(null), timeoutMs);

			messageChannel.port1.onmessage = (event) => {
				if (event.data?.type === responseType) {
					finish((event.data.data ?? null) as T | null);
					return;
				}

				if (event.data?.type === "SERVICE_WORKER_ERROR") {
					Logger.warn("[SW Manager] Service worker request failed:", type, event.data.data);
					finish(null);
				}
			};

			try {
				controller.postMessage(data ? { type, data } : { type }, [messageChannel.port2]);
			} catch (error) {
				Logger.warn("[SW Manager] Failed to send service worker message:", type, error);
				finish(null);
			}
		});
	}

	// Unregister service worker (for development/debugging)
	async unregister(): Promise<boolean> {
		if (!this.registration) {
			Logger.warn("[SW Manager] No service worker registration to unregister");
			return false;
		}

		try {
			const result = await this.registration.unregister();
			Logger.debug("[SW Manager] Service worker unregistered:", result);
			this.registration = null;
			this.updateAvailable = false;
			this.emit("statechange", this.getState());
			return result;
		} catch (error) {
			Logger.error("[SW Manager] Failed to unregister service worker:", error);
			return false;
		}
	}

	// Get cache size in human readable format
	formatCacheSize(bytes: number): string {
		if (bytes === 0) return "0 B";

		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
	}

	// Check if app is running offline
	isOffline(): boolean {
		return !navigator.onLine;
	}

	// Get network status
	getNetworkStatus(): NetworkStatus {
		const connection = (
			navigator as Navigator & {
				connection?: { effectiveType?: string; downlink?: number; rtt?: number };
			}
		).connection;

		return {
			online: navigator.onLine,
			effectiveType: connection?.effectiveType || "unknown",
			downlink: connection?.downlink || 0,
			rtt: connection?.rtt || 0,
		};
	}
}

// Create singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

// Registration happens explicitly in initPwa() (lib/pwa.ts), called from
// main.tsx, so it no longer depends on which modules happen to import this.
export default serviceWorkerManager;
