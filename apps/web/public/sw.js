// Routess PWA Service Worker
// Version is injected at container startup.
const CACHE_VERSION = "routess-__VITE_APP_VERSION__";
const CACHE_NAMES = {
	APP_SHELL: `${CACHE_VERSION}-app-shell`,
	API_CACHE: `${CACHE_VERSION}-api-cache`,
	MAP_ASSETS: `${CACHE_VERSION}-map-assets`,
	RUNTIME: `${CACHE_VERSION}-runtime`,
};

// App Shell - Critical files that should always be cached
const APP_SHELL_FILES = [
	"/",
	"/index.html",
	"/manifest.json",
	"/logo.png",
	// Icons
	"/icons/icon-192x192.png",
	"/icons/icon-512x512.png",
	"/icons/icon-192x192-maskable.png",
	"/icons/icon-512x512-maskable.png",
	// Will be populated with actual build assets during install
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
	// Mapbox APIs
	/^https:\/\/api\.mapbox\.com\/geocoding/,
	/^https:\/\/api\.mapbox\.com\/directions/,
	/^https:\/\/api\.mapbox\.com\/matching/,
	/^https:\/\/api\.mapbox\.com\/optimized-trips/,
	// Add your backend API patterns here if you have any
];

// Map assets to cache
const MAP_ASSET_PATTERNS = [
	// Mapbox map styles, sprites, fonts
	/^https:\/\/api\.mapbox\.com\/styles/,
	/^https:\/\/api\.mapbox\.com\/fonts/,
	/^https:\/\/api\.mapbox\.com\/v1\/sprite/,
	// Map tiles (we'll cache these with special handling)
	/^https:\/\/[a-z]\.tiles\.mapbox\.com/,
];

// Cache strategies
const _CACHE_STRATEGIES = {
	APP_SHELL: "cache-first",
	API: "network-first-with-cache-fallback",
	MAP_ASSETS: "cache-first-with-network-fallback",
	MAP_TILES: "stale-while-revalidate",
	RUNTIME: "network-first",
};

// Cache expiration times (in milliseconds)
const CACHE_EXPIRATION = {
	API_CACHE: 24 * 60 * 60 * 1000, // 24 hours
	MAP_ASSETS: 7 * 24 * 60 * 60 * 1000, // 7 days
	MAP_TILES: 30 * 24 * 60 * 60 * 1000, // 30 days
	RUNTIME: 60 * 60 * 1000, // 1 hour
};

// Maximum cache sizes
const MAX_CACHE_ENTRIES = {
	API_CACHE: 100,
	MAP_ASSETS: 200,
	MAP_TILES: 500,
	RUNTIME: 50,
};

const ROUTE_CACHE_PREFIX = "/__routess_route_cache__/";

// Install event - Cache app shell
self.addEventListener("install", (event) => {
	event.waitUntil(
		(async () => {
			try {
				// Cache app shell
				const appShellCache = await caches.open(CACHE_NAMES.APP_SHELL);
				await appShellCache.addAll(APP_SHELL_FILES);

				// Initialize other caches
				await caches.open(CACHE_NAMES.API_CACHE);
				await caches.open(CACHE_NAMES.MAP_ASSETS);
				await caches.open(CACHE_NAMES.RUNTIME);

				// Skip waiting to activate immediately
				self.skipWaiting();
			} catch (_error) {}
		})(),
	);
});

// Activate event - Clean up old caches
self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			try {
				// Clean up old caches
				const cacheNames = await caches.keys();
				const oldCaches = cacheNames.filter(
					(name) => name.startsWith("routess-") && !Object.values(CACHE_NAMES).includes(name),
				);

				await Promise.all(
					oldCaches.map((cacheName) => {
						return caches.delete(cacheName);
					}),
				);

				// Take control of all clients
				await self.clients.claim();
			} catch (_error) {}
		})(),
	);
});

// Fetch event - Implement caching strategies
self.addEventListener("fetch", (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests
	if (request.method !== "GET") {
		return;
	}

	// Skip chrome-extension and other non-http requests
	if (!url.protocol.startsWith("http")) {
		return;
	}

	event.respondWith(handleRequest(request));
});

// Main request handler with different strategies
async function handleRequest(request) {
	const _url = new URL(request.url);

	try {
		// Navigation / HTML - Network First so a fresh deploy is picked up immediately.
		// Cache-first here would pin users to a stale index.html that references
		// old hashed JS bundles, requiring a manual cache clear to ever upgrade.
		if (isNavigationRequest(request)) {
			return await networkFirstForNavigation(request, CACHE_NAMES.APP_SHELL);
		}

		// App Shell (hashed JS/CSS, icons, manifest) - Cache First (filenames are immutable)
		if (isAppShellRequest(request)) {
			return await cacheFirst(request, CACHE_NAMES.APP_SHELL);
		}

		// API Requests - Network First with Cache Fallback
		if (isApiRequest(request)) {
			return await networkFirstWithCacheFallback(request, CACHE_NAMES.API_CACHE);
		}

		// Map Assets - Cache First with Network Fallback
		if (isMapAssetRequest(request)) {
			return await cacheFirstWithNetworkFallback(request, CACHE_NAMES.MAP_ASSETS);
		}

		// Map Tiles - Stale While Revalidate
		if (isMapTileRequest(request)) {
			return await staleWhileRevalidate(request, CACHE_NAMES.MAP_ASSETS);
		}

		// Runtime - Network First
		return await networkFirstWithCacheFallback(request, CACHE_NAMES.RUNTIME);
	} catch (_error) {
		// Fallback for navigation requests
		if (request.mode === "navigate") {
			const cache = await caches.open(CACHE_NAMES.APP_SHELL);
			return (await cache.match("/")) || new Response("App offline", { status: 503 });
		}

		return new Response("Network error", { status: 503 });
	}
}

// Request type checkers
function isNavigationRequest(request) {
	const url = new URL(request.url);
	return (
		url.origin === self.location.origin &&
		(request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html"))
	);
}

function isAppShellRequest(request) {
	const url = new URL(request.url);
	return (
		url.origin === self.location.origin &&
		(url.pathname.endsWith(".css") ||
			url.pathname.endsWith(".js") ||
			url.pathname.startsWith("/icons/") ||
			url.pathname === "/manifest.json" ||
			url.pathname === "/logo.png")
	);
}

function isApiRequest(request) {
	return API_CACHE_PATTERNS.some((pattern) => pattern.test(request.url));
}

function isMapAssetRequest(request) {
	return MAP_ASSET_PATTERNS.some((pattern) => pattern.test(request.url)) && !isMapTileRequest(request);
}

function isMapTileRequest(request) {
	const url = new URL(request.url);
	return url.hostname.includes("tiles.mapbox.com") || url.pathname.includes("/tiles/");
}

// Caching strategies implementation

// Network First for navigation/HTML — keeps users on the latest deploy when online,
// falls back to the cached shell only when offline.
async function networkFirstForNavigation(request, cacheName) {
	const cache = await caches.open(cacheName);

	try {
		const networkResponse = await fetch(request);
		if (networkResponse.ok) {
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (error) {
		const cachedResponse = (await cache.match(request)) || (await cache.match("/"));
		if (cachedResponse) {
			return cachedResponse;
		}
		throw error;
	}
}

// Cache First - Good for hashed static assets
async function cacheFirst(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cachedResponse = await cache.match(request);

	if (cachedResponse) {
		return cachedResponse;
	}

	const networkResponse = await fetch(request);
	if (networkResponse.ok) {
		cache.put(request, networkResponse.clone());
	}

	return networkResponse;
}

// Network First with Cache Fallback - Good for API requests
async function networkFirstWithCacheFallback(request, cacheName) {
	const cache = await caches.open(cacheName);

	try {
		const networkResponse = await fetch(request);

		if (networkResponse.ok) {
			cache.put(request, networkResponse.clone());

			// Clean up old entries
			await cleanupCache(cacheName);
		}

		return networkResponse;
	} catch (error) {
		const cachedResponse = await cache.match(request);

		if (cachedResponse) {
			// Check if cached response is still valid
			if (await isCacheEntryValid(cachedResponse, cacheName)) {
				return cachedResponse;
			}
		}

		throw error;
	}
}

// Cache First with Network Fallback - Good for map assets
async function cacheFirstWithNetworkFallback(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cachedResponse = await cache.match(request);

	if (cachedResponse && (await isCacheEntryValid(cachedResponse, cacheName))) {
		return cachedResponse;
	}

	try {
		const networkResponse = await fetch(request);
		if (networkResponse.ok) {
			cache.put(request, networkResponse.clone());
			await cleanupCache(cacheName);
		}
		return networkResponse;
	} catch (error) {
		if (cachedResponse) {
			return cachedResponse;
		}
		throw error;
	}
}

// Stale While Revalidate - Good for map tiles
async function staleWhileRevalidate(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cachedResponse = await cache.match(request);

	// Always try to fetch in background
	const fetchPromise = fetch(request)
		.then((networkResponse) => {
			if (networkResponse.ok) {
				cache.put(request, networkResponse.clone());
				cleanupCache(cacheName); // Don't await this
			}
			return networkResponse;
		})
		.catch((_error) => {});

	// Return cached version immediately if available
	if (cachedResponse) {
		return cachedResponse;
	}

	// If no cache, wait for network
	return await fetchPromise;
}

// Cache management utilities
async function isCacheEntryValid(response, cacheName) {
	const dateHeader = response.headers.get("date");
	if (!dateHeader) return true; // No date header, assume valid

	const cacheDate = new Date(dateHeader);
	const now = new Date();
	const age = now.getTime() - cacheDate.getTime();

	const maxAge = CACHE_EXPIRATION[getCacheType(cacheName)] || CACHE_EXPIRATION.RUNTIME;

	return age < maxAge;
}

function getCacheType(cacheName) {
	if (cacheName.includes("api-cache")) return "API_CACHE";
	if (cacheName.includes("map-assets")) return "MAP_ASSETS";
	if (cacheName.includes("runtime")) return "RUNTIME";
	return "RUNTIME";
}

async function cleanupCache(cacheName) {
	const cache = await caches.open(cacheName);
	const requests = await cache.keys();
	const cacheType = getCacheType(cacheName);
	const maxEntries = MAX_CACHE_ENTRIES[cacheType] || MAX_CACHE_ENTRIES.RUNTIME;

	if (requests.length > maxEntries) {
		// Remove oldest entries (simple FIFO)
		const entriesToDelete = requests.slice(0, requests.length - maxEntries);
		await Promise.all(entriesToDelete.map((request) => cache.delete(request)));
	}
}

// Message handling for cache management from the app. Messages may be
// fire-and-forget or request/response via MessageChannel; both are valid.
self.addEventListener("message", (event) => {
	const message = event.data;
	if (!message || typeof message.type !== "string") return;

	event.waitUntil(handleMessage(message, event.ports?.[0]));
});

async function handleMessage(message, responsePort) {
	const { type, data } = message;

	try {
		switch (type) {
			case "SKIP_WAITING":
				await self.skipWaiting();
				break;

			case "GET_CACHE_STATUS": {
				const status = await getCacheStatus();
				postMessageResponse(responsePort, { type: "CACHE_STATUS", data: status });
				break;
			}

			case "CLEAR_CACHE":
				await clearSpecificCache(data?.cacheName);
				postMessageResponse(responsePort, { type: "CACHE_CLEARED", data: { cacheName: data?.cacheName } });
				break;

			case "PRECACHE_ROUTE":
				await precacheRoute(data?.routeData);
				postMessageResponse(responsePort, { type: "ROUTE_PRECACHED", data: data?.routeData });
				break;
		}
	} catch (error) {
		postMessageResponse(responsePort, {
			type: "SERVICE_WORKER_ERROR",
			data: { requestType: type, message: error instanceof Error ? error.message : "Service worker request failed" },
		});
	}
}

function postMessageResponse(port, payload) {
	if (!port) return;
	port.postMessage(payload);
}

// Utility functions for cache management
async function getCacheStatus() {
	const cacheNames = await caches.keys();
	const status = {};

	for (const cacheName of cacheNames) {
		if (cacheName.startsWith("routess-")) {
			const cache = await caches.open(cacheName);
			const keys = await cache.keys();
			status[cacheName] = {
				entries: keys.length,
				size: await getCacheSize(cache),
			};
		}
	}

	return status;
}

async function getCacheSize(cache) {
	const keys = await cache.keys();
	let totalSize = 0;

	for (const key of keys) {
		const response = await cache.match(key);
		if (response) {
			const blob = await response.blob();
			totalSize += blob.size;
		}
	}

	return totalSize;
}

async function clearSpecificCache(cacheName) {
	if (cacheName?.startsWith("routess-")) {
		await caches.delete(cacheName);
	}
}

async function precacheRoute(routeData) {
	if (!routeData || typeof routeData !== "object") {
		throw new Error("Route data is required");
	}

	const cacheKey = getRouteCacheKey(routeData);
	const cache = await caches.open(CACHE_NAMES.RUNTIME);
	await cache.put(
		cacheKey,
		new Response(
			JSON.stringify({
				cachedAt: new Date().toISOString(),
				routeData,
			}),
			{
				headers: {
					"content-type": "application/json",
					date: new Date().toUTCString(),
				},
			},
		),
	);
	await cleanupCache(CACHE_NAMES.RUNTIME);
}

function getRouteCacheKey(routeData) {
	const rawKey = typeof routeData.url === "string" && routeData.url ? routeData.url : `route_${Date.now()}`;
	return new Request(`${ROUTE_CACHE_PREFIX}${encodeURIComponent(rawKey)}`);
}
