// Routess PWA Service Worker
// Built by vite-plugin-pwa (injectManifest): the build injects the hashed
// asset list into self.__WB_MANIFEST so offline cold start has every chunk.
// Version is injected at container startup.
const CACHE_VERSION = "routess-__VITE_APP_VERSION__";
const CACHE_NAMES = {
	APP_SHELL: `${CACHE_VERSION}-app-shell`,
	API_CACHE: `${CACHE_VERSION}-api-cache`,
	MAP_ASSETS: `${CACHE_VERSION}-map-assets`,
	MAP_TILES: `${CACHE_VERSION}-map-tiles`,
	RUNTIME: `${CACHE_VERSION}-runtime`,
	// Deliberately not version-keyed: offline routes are user data and must
	// survive deploys (the activate cleanup keeps every name in CACHE_NAMES).
	ROUTES: "routess-routes-v1",
};

// Build-time precache manifest injected by vite-plugin-pwa: [{url, revision}]
const PRECACHE_MANIFEST = self.__WB_MANIFEST || [];

// App Shell - Critical files that should always be cached
const APP_SHELL_FILES = [
	"/",
	"/manifest.json",
	// Icons
	"/icons/icon-192x192.png",
	"/icons/icon-512x512.png",
	"/icons/icon-192x192-maskable.png",
	"/icons/icon-512x512-maskable.png",
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
	// Mapbox APIs
	/^https:\/\/api\.mapbox\.com\/geocoding/,
	/^https:\/\/api\.mapbox\.com\/directions/,
	/^https:\/\/api\.mapbox\.com\/matching/,
	/^https:\/\/api\.mapbox\.com\/optimized-trips/,
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

// Map tiles. mapbox-gl v3 serves every basemap tile from api.mapbox.com, not
// from the legacy *.tiles.mapbox.com hosts, so matching on hostname alone sent
// all of them to the 50-entry RUNTIME cache and thrashed it on every pan.
const MAP_TILE_PATTERNS = [
	/^https:\/\/api\.mapbox\.com\/v4\//, // vector tiles
	/^https:\/\/api\.mapbox\.com\/raster\/v1\//, // terrain DEM
	/^https:\/\/api\.mapbox\.com\/rasterarrays\/v1\//, // landmark icons
	/^https:\/\/api\.mapbox\.com\/3dtiles\/v1\//, // 3D buildings
	/^https:\/\/api\.mapbox\.com\/models\/v1\//, // 3D models
	/^https:\/\/[a-z]\.tiles\.mapbox\.com\//, // legacy tile CDN
];

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
	ROUTES: 200,
};

const ROUTE_CACHE_PREFIX = "/__routess_route_cache__/";
const SHARED_FILE_CACHE_KEY = "/__routess_shared_file__";
const SHARE_TARGET_PATH = "/share-target";

// Match regardless of server Vary headers: install-time addAll stores
// no-cors requests while module scripts arrive in cors mode, and a
// Vary: Origin response would otherwise never match offline.
const MATCH_OPTS = { ignoreVary: true };

// Runtime-substituted at container startup; caching it cache-first would pin
// users to the env vars of a previous deploy. Handled network-first instead.
const RUNTIME_CONFIG_PATH = "/env-config.js";

// Install event - Cache app shell + build assets
self.addEventListener("install", (event) => {
	event.waitUntil(
		(async () => {
			try {
				const appShellCache = await caches.open(CACHE_NAMES.APP_SHELL);
				// env-config.js is requested before this worker controls the page,
				// so runtime caching never captures it; precache it here or an
				// offline cold start boots without its runtime config.
				const precacheUrls = new Set([...APP_SHELL_FILES, RUNTIME_CONFIG_PATH]);
				for (const entry of PRECACHE_MANIFEST) {
					precacheUrls.add(new URL(entry.url, self.location.origin).pathname);
				}
				await appShellCache.addAll([...precacheUrls]);

				// Initialize other caches
				await caches.open(CACHE_NAMES.API_CACHE);
				await caches.open(CACHE_NAMES.MAP_ASSETS);
				await caches.open(CACHE_NAMES.RUNTIME);
				await caches.open(CACHE_NAMES.ROUTES);

				// No skipWaiting here: the new worker waits until the user confirms
				// the update toast (SKIP_WAITING message) or every tab is closed, so
				// a deploy never yanks the page out from under someone mid-edit.
			} catch (_error) {
				// Install best-effort: a failed precache must not block the worker.
			}
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
			} catch (_error) {
				// Cache cleanup is best-effort; stale caches get retried next activate.
			}
		})(),
	);
});

// Fetch event - Implement caching strategies
self.addEventListener("fetch", (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Web Share Target: stash the shared file, then bounce to the app.
	if (request.method === "POST" && url.origin === self.location.origin && url.pathname === SHARE_TARGET_PATH) {
		event.respondWith(handleShareTarget(event));
		return;
	}

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

async function handleShareTarget(event) {
	try {
		const formData = await event.request.formData();
		const file = formData.get("gpx");
		if (file && typeof file !== "string") {
			const cache = await caches.open(CACHE_NAMES.RUNTIME);
			await cache.put(
				SHARED_FILE_CACHE_KEY,
				new Response(file, {
					headers: {
						"content-type": "application/gpx+xml",
						"x-routess-file-name": encodeURIComponent(file.name || "shared.gpx"),
						date: new Date().toUTCString(),
					},
				}),
			);
		}
	} catch (_error) {
		// Still redirect into the app; the import flow reports the missing file.
	}
	return Response.redirect("/?action=shared-file", 303);
}

// Main request handler with different strategies
async function handleRequest(request) {
	const url = new URL(request.url);

	try {
		// Navigation / HTML - Network First so a fresh deploy is picked up immediately.
		// Cache-first here would pin users to a stale index.html that references
		// old hashed JS bundles, requiring a manual cache clear to ever upgrade.
		if (isNavigationRequest(request)) {
			return await networkFirstForNavigation(request, CACHE_NAMES.APP_SHELL);
		}

		// Runtime config - Network First, but always usable from cache when
		// offline (no expiry) so an offline cold start still gets its config.
		// Falls back to its own cached copy only, never the "/" HTML.
		if (url.origin === self.location.origin && url.pathname === RUNTIME_CONFIG_PATH) {
			return await networkFirstNoExpiry(request, CACHE_NAMES.APP_SHELL);
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

		// Map Tiles - Stale While Revalidate, in their own cache so tile churn
		// never evicts the style/sprite/glyph entries the map needs to render.
		if (isMapTileRequest(request)) {
			return await staleWhileRevalidate(request, CACHE_NAMES.MAP_TILES);
		}

		// Runtime - Network First
		return await networkFirstWithCacheFallback(request, CACHE_NAMES.RUNTIME);
	} catch (_error) {
		// Fallback for navigation requests
		if (request.mode === "navigate") {
			const cache = await caches.open(CACHE_NAMES.APP_SHELL);
			return (await cache.match("/", MATCH_OPTS)) || new Response("App offline", { status: 503 });
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
	if (url.origin !== self.location.origin) {
		return false;
	}
	// Never cache-first the runtime config or the worker itself.
	if (url.pathname === RUNTIME_CONFIG_PATH || url.pathname === "/sw.js") {
		return false;
	}
	return (
		url.pathname.endsWith(".css") ||
		url.pathname.endsWith(".js") ||
		url.pathname.endsWith(".woff2") ||
		url.pathname.startsWith("/icons/") ||
		url.pathname.startsWith("/splash/") ||
		url.pathname === "/manifest.json"
	);
}

function isApiRequest(request) {
	return API_CACHE_PATTERNS.some((pattern) => pattern.test(request.url));
}

function isMapAssetRequest(request) {
	return MAP_ASSET_PATTERNS.some((pattern) => pattern.test(request.url)) && !isMapTileRequest(request);
}

function isMapTileRequest(request) {
	if (MAP_TILE_PATTERNS.some((pattern) => pattern.test(request.url))) return true;

	const url = new URL(request.url);
	// Self-hosted node-network tiles (go-pmtiles serves /nodes/{z}/{x}/{y}.mvt).
	if (url.pathname.startsWith("/nodes/") && url.pathname.endsWith(".mvt")) return true;

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
		const cachedResponse = (await cache.match(request, MATCH_OPTS)) || (await cache.match("/", MATCH_OPTS));
		if (cachedResponse) {
			return cachedResponse;
		}
		throw error;
	}
}

// Network First, cache fallback without expiry and without the "/" HTML
// fallback - for the runtime config, which must be fresh online and present
// offline but must never be answered with index.html.
async function networkFirstNoExpiry(request, cacheName) {
	const cache = await caches.open(cacheName);

	try {
		const networkResponse = await fetch(request);
		if (networkResponse.ok) {
			cache.put(request, networkResponse.clone());
		}
		return networkResponse;
	} catch (error) {
		const cachedResponse = await cache.match(request, MATCH_OPTS);
		if (cachedResponse) {
			return cachedResponse;
		}
		throw error;
	}
}

// Cache First - Good for hashed static assets
async function cacheFirst(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cachedResponse = await cache.match(request, MATCH_OPTS);

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
		const cachedResponse = await cache.match(request, MATCH_OPTS);

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
	const cachedResponse = await cache.match(request, MATCH_OPTS);

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
	const cachedResponse = await cache.match(request, MATCH_OPTS);

	// Always try to fetch in background
	const fetchPromise = fetch(request)
		.then((networkResponse) => {
			if (networkResponse.ok) {
				cache.put(request, networkResponse.clone());
				maybeCleanupCache(cacheName); // Don't await this
			}
			return networkResponse;
		})
		.catch((_error) => {
			// Background revalidation failure is fine; the cached copy stands.
		});

	// Return cached version immediately if available
	if (cachedResponse) {
		return cachedResponse;
	}

	// If no cache, wait for network
	return await fetchPromise;
}

// Cache management utilities
async function isCacheEntryValid(response, cacheName) {
	// Offline routes never expire; the FIFO cap is the only limit.
	if (getCacheType(cacheName) === "ROUTES") return true;

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
	if (cacheName.includes("map-tiles")) return "MAP_TILES";
	if (cacheName.includes("map-assets")) return "MAP_ASSETS";
	if (cacheName.includes("routes")) return "ROUTES";
	if (cacheName.includes("runtime")) return "RUNTIME";
	return "RUNTIME";
}

// cleanupCache enumerates every key in the cache, so calling it per stored tile
// turns one pan into hundreds of full cache walks. Amortise it instead; the cap
// is a soft ceiling, not a hard one.
const CLEANUP_WRITE_INTERVAL = 25;
const writesSinceCleanup = new Map();

function maybeCleanupCache(cacheName) {
	const writes = (writesSinceCleanup.get(cacheName) ?? 0) + 1;
	if (writes < CLEANUP_WRITE_INTERVAL) {
		writesSinceCleanup.set(cacheName, writes);
		return;
	}
	writesSinceCleanup.set(cacheName, 0);
	void cleanupCache(cacheName);
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
	const cache = await caches.open(CACHE_NAMES.ROUTES);
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
	await cleanupCache(CACHE_NAMES.ROUTES);
}

function getRouteCacheKey(routeData) {
	const rawKey = typeof routeData.url === "string" && routeData.url ? routeData.url : `route_${Date.now()}`;
	return new Request(`${ROUTE_CACHE_PREFIX}${encodeURIComponent(rawKey)}`);
}
