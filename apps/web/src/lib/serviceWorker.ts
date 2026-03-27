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

	// Register the service worker
	async register(): Promise<ServiceWorkerRegistration | null> {
		if (!this.isSupported()) {
			Logger.warn("[SW Manager] Service workers not supported");
			return null;
		}

		try {
			Logger.info("[SW Manager] Registering service worker...");

			this.registration = await navigator.serviceWorker.register("/sw.js", {
				scope: "/",
			});

			Logger.info("[SW Manager] Service worker registered successfully");

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
		if (!this.registration) return;

		// Listen for service worker updates
		this.registration.addEventListener("updatefound", () => {
			Logger.info("[SW Manager] Service worker update found");
			const newWorker = this.registration?.installing;

			if (newWorker) {
				this.emit("statechange", this.getState());

				newWorker.addEventListener("statechange", () => {
					Logger.info("[SW Manager] New service worker state:", newWorker.state);

					if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
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
			Logger.info("[SW Manager] Service worker controller changed");
			this.emit("controlling");
			this.emit("statechange", this.getState());

			// Reload the page when a new service worker takes control
			if (this.updateAvailable) {
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
		Logger.info("[SW Manager] Received message from service worker:", type, data);

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
			Logger.info("[SW Manager] Checked for service worker updates");
		} catch (error) {
			Logger.error("[SW Manager] Failed to check for updates:", error);
		}
	}

	// Skip waiting and activate new service worker
	async skipWaiting(): Promise<void> {
		if (!this.registration || !this.registration.waiting) {
			Logger.warn("[SW Manager] No waiting service worker to activate");
			return;
		}

		try {
			// Send skip waiting message to the waiting service worker
			this.registration.waiting.postMessage({ type: "SKIP_WAITING" });
			Logger.info("[SW Manager] Sent skip waiting message to service worker");
		} catch (error) {
			Logger.error("[SW Manager] Failed to skip waiting:", error);
		}
	}

	// Get current service worker state
	getState(): ServiceWorkerState {
		return {
			isSupported: this.isSupported(),
			isRegistered: !!this.registration,
			isControlling: !!navigator.serviceWorker.controller,
			hasUpdate: this.updateAvailable,
			isInstalling: !!this.registration?.installing,
			registration: this.registration,
		};
	}

	// Cache management methods
	async getCacheStatus(): Promise<CacheStatus | null> {
		const controller = navigator.serviceWorker.controller;
		if (!controller) {
			Logger.warn("[SW Manager] No service worker controller available");
			return null;
		}

		return new Promise((resolve) => {
			const messageChannel = new MessageChannel();

			messageChannel.port1.onmessage = (event) => {
				if (event.data.type === "CACHE_STATUS") {
					resolve(event.data.data);
				}
			};

			controller.postMessage({ type: "GET_CACHE_STATUS" }, [messageChannel.port2]);

			// Timeout after 5 seconds
			setTimeout(() => resolve(null), 5000);
		});
	}

	async clearCache(cacheName: string): Promise<boolean> {
		const controller = navigator.serviceWorker.controller;
		if (!controller) {
			Logger.warn("[SW Manager] No service worker controller available");
			return false;
		}

		return new Promise((resolve) => {
			const messageChannel = new MessageChannel();

			messageChannel.port1.onmessage = (event) => {
				if (event.data.type === "CACHE_CLEARED") {
					resolve(true);
				}
			};

			controller.postMessage({ type: "CLEAR_CACHE", data: { cacheName } }, [messageChannel.port2]);

			// Timeout after 10 seconds
			setTimeout(() => resolve(false), 10000);
		});
	}

	async precacheRoute(routeData: Record<string, unknown>): Promise<boolean> {
		const controller = navigator.serviceWorker.controller;
		if (!controller) {
			Logger.warn("[SW Manager] No service worker controller available");
			return false;
		}

		return new Promise((resolve) => {
			const messageChannel = new MessageChannel();

			messageChannel.port1.onmessage = (event) => {
				if (event.data.type === "ROUTE_PRECACHED") {
					resolve(true);
				}
			};

			controller.postMessage({ type: "PRECACHE_ROUTE", data: { routeData } }, [messageChannel.port2]);

			// Timeout after 30 seconds
			setTimeout(() => resolve(false), 30000);
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
			Logger.info("[SW Manager] Service worker unregistered:", result);
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

// Auto-register service worker when module loads (in production)
if (import.meta.env.PROD) {
	serviceWorkerManager.register().catch((error) => {
		Logger.error("[SW Manager] Auto-registration failed:", error);
	});
}

// Export for manual registration in development
export default serviceWorkerManager;
