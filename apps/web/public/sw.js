// Maps PWA Service Worker
// Version 1.0.0

const CACHE_VERSION = "maps-v1.0.0";
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

// Install event - Cache app shell
self.addEventListener("install", (event) => {
	console.log("[SW] Installing service worker version:", CACHE_VERSION);

	event.waitUntil(
		(async () => {
			try {
				// Cache app shell
				const appShellCache = await caches.open(CACHE_NAMES.APP_SHELL);

				// Get the actual built assets from the HTML
				const response = await fetch("/");
				const html = await response.text();

				// Extract CSS and JS files from the HTML
				const cssMatches = html.match(/href="([^"]*\.css[^"]*)"/g) || [];
				const jsMatches = html.match(/src="([^"]*\.js[^"]*)"/g) || [];

				const extractedAssets = [
					...cssMatches.map((match) => match.match(/href="([^"]*)"/)[1]),
					...jsMatches.map((match) => match.match(/src="([^"]*)"/)[1]),
				];

				const allShellFiles = [...APP_SHELL_FILES, ...extractedAssets];

				console.log("[SW] Caching app shell files:", allShellFiles);
				await appShellCache.addAll(allShellFiles);

				// Initialize other caches
				await caches.open(CACHE_NAMES.API_CACHE);
				await caches.open(CACHE_NAMES.MAP_ASSETS);
				await caches.open(CACHE_NAMES.RUNTIME);

				console.log("[SW] App shell cached successfully");

				// Skip waiting to activate immediately
				self.skipWaiting();
			} catch (error) {
				console.error("[SW] Failed to cache app shell:", error);
			}
		})(),
	);
});

// Activate event - Clean up old caches
self.addEventListener("activate", (event) => {
	console.log("[SW] Activating service worker version:", CACHE_VERSION);

	event.waitUntil(
		(async () => {
			try {
				// Clean up old caches
				const cacheNames = await caches.keys();
				const oldCaches = cacheNames.filter(
					(name) => name.startsWith("maps-v") && !Object.values(CACHE_NAMES).includes(name),
				);

				await Promise.all(
					oldCaches.map((cacheName) => {
						console.log("[SW] Deleting old cache:", cacheName);
						return caches.delete(cacheName);
					}),
				);

				// Take control of all clients
				await self.clients.claim();

				console.log("[SW] Service worker activated and took control");
			} catch (error) {
				console.error("[SW] Failed to activate service worker:", error);
			}
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
		// App Shell - Cache First
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
	} catch (error) {
		console.error("[SW] Error handling request:", request.url, error);

		// Fallback for navigation requests
		if (request.mode === "navigate") {
			const cache = await caches.open(CACHE_NAMES.APP_SHELL);
			return (await cache.match("/")) || new Response("App offline", { status: 503 });
		}

		return new Response("Network error", { status: 503 });
	}
}

// Request type checkers
function isAppShellRequest(request) {
	const url = new URL(request.url);
	return (
		url.origin === self.location.origin &&
		(request.mode === "navigate" ||
			url.pathname === "/" ||
			url.pathname.endsWith(".html") ||
			url.pathname.endsWith(".css") ||
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

// Cache First - Good for app shell
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
			// For directions API, enhance the response with metadata before caching
			if (request.url.includes("api.mapbox.com/directions")) {
				const responseClone = networkResponse.clone();
				try {
					const routeData = await responseClone.json();
					if (routeData.routes?.[0]) {
						// Add metadata to help with offline reconstruction
						const enhancedResponse = new Response(
							JSON.stringify({
								...routeData,
								_cached_at: Date.now(),
								_request_url: request.url,
								_waypoints_hash: hashWaypoints(request.url),
							}),
							{
								status: networkResponse.status,
								statusText: networkResponse.statusText,
								headers: networkResponse.headers,
							},
						);

						cache.put(request, enhancedResponse);
						console.log("[SW] Cached enhanced route data for offline use");
					}
				} catch (_error) {
					// If enhancement fails, cache the original response
					cache.put(request, networkResponse.clone());
				}
			} else {
				// Cache other responses normally
				cache.put(request, networkResponse.clone());
			}

			// Clean up old entries
			await cleanupCache(cacheName);
		}

		return networkResponse;
	} catch (error) {
		console.log("[SW] Network failed, trying cache for:", request.url);
		const cachedResponse = await cache.match(request);

		if (cachedResponse) {
			// Check if cached response is still valid
			if (await isCacheEntryValid(cachedResponse, cacheName)) {
				console.log("[SW] Returning cached response for:", request.url);
				return cachedResponse;
			}
		}

		// Special handling for Mapbox Directions API - provide offline fallback
		if (request.url.includes("api.mapbox.com/directions")) {
			console.log("[SW] Generating offline route fallback for:", request.url);
			return generateOfflineRouteResponse(request);
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
		.catch((_error) => {
			console.log("[SW] Background fetch failed for:", request.url);
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
		console.log(`[SW] Cleaned up ${entriesToDelete.length} old entries from ${cacheName}`);
	}
}

// Message handling for cache management from the app
self.addEventListener("message", (event) => {
	const { type, data } = event.data;

	switch (type) {
		case "SKIP_WAITING":
			self.skipWaiting();
			break;

		case "GET_CACHE_STATUS":
			getCacheStatus().then((status) => {
				event.ports[0].postMessage({ type: "CACHE_STATUS", data: status });
			});
			break;

		case "CLEAR_CACHE":
			clearSpecificCache(data.cacheName).then(() => {
				event.ports[0].postMessage({ type: "CACHE_CLEARED", data: { cacheName: data.cacheName } });
			});
			break;

		case "PRECACHE_ROUTE":
			precacheRoute(data.routeData).then(() => {
				event.ports[0].postMessage({ type: "ROUTE_PRECACHED", data: data.routeData });
			});
			break;
	}
});

// Utility functions for cache management
async function getCacheStatus() {
	const cacheNames = await caches.keys();
	const status = {};

	for (const cacheName of cacheNames) {
		if (cacheName.startsWith("maps-v")) {
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
	if (cacheName?.startsWith("maps-v")) {
		await caches.delete(cacheName);
		console.log("[SW] Cleared cache:", cacheName);
	}
}

async function precacheRoute(routeData) {
	// This could be used to precache map tiles along a route
	console.log("[SW] Precaching route data:", routeData);
	// Implementation would depend on your specific route data structure
}

// Enhanced route caching and offline route generation
async function generateOfflineRouteResponse(request) {
	try {
		const url = new URL(request.url);
		const pathParts = url.pathname.split("/");

		// Extract coordinates from the URL path
		const coordinatesIndex = pathParts.findIndex(
			(part) => part === "walking" || part === "cycling" || part === "driving" || part === "driving-traffic",
		);
		if (coordinatesIndex === -1 || coordinatesIndex + 1 >= pathParts.length) {
			throw new Error("Could not parse coordinates from URL");
		}

		const coordinatesString = pathParts[coordinatesIndex + 1];
		const waypoints = coordinatesString.split(";").map((coord) => {
			const [lng, lat] = coord.split(",").map(Number);
			return [lng, lat];
		});

		if (waypoints.length < 2) {
			throw new Error("Need at least 2 waypoints for route");
		}

		// First, try to find cached route segments
		const cachedRouteGeometry = await tryReconstructFromCachedSegments(waypoints);

		if (cachedRouteGeometry && cachedRouteGeometry.length > waypoints.length) {
			// We found a good cached route, use it
			console.log("[SW] Using reconstructed route from cached segments");
			return createRouteResponse(cachedRouteGeometry, waypoints, true);
		}

		// Fallback to direct route with intermediate points for better visualization
		console.log("[SW] No cached route found, generating enhanced direct route");
		const enhancedGeometry = generateEnhancedDirectRoute(waypoints);
		return createRouteResponse(enhancedGeometry, waypoints, false);
	} catch (error) {
		console.error("[SW] Error generating offline route:", error);
		return new Response(
			JSON.stringify({
				code: "NoRoute",
				message: "Could not generate offline route",
			}),
			{
				status: 404,
				statusText: "Not Found",
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}

// Try to reconstruct route from cached API responses
async function tryReconstructFromCachedSegments(waypoints) {
	const cache = await caches.open(CACHE_NAMES.API_CACHE);
	const cachedRequests = await cache.keys();

	// Look for cached routes that might contain segments we need
	for (const request of cachedRequests) {
		if (request.url.includes("api.mapbox.com/directions")) {
			try {
				const cachedResponse = await cache.match(request);
				if (cachedResponse) {
					const cachedData = await cachedResponse.json();
					if (cachedData.routes?.[0]?.geometry) {
						const cachedGeometry = cachedData.routes[0].geometry.coordinates;
						const cachedWaypoints = cachedData.waypoints?.map((wp) => wp.location) || [];

						// Check if this cached route is similar to what we need
						if (isRouteSimilar(waypoints, cachedWaypoints, cachedGeometry)) {
							console.log("[SW] Found similar cached route");
							return cachedGeometry;
						}
					}
				}
			} catch (error) {
				console.log("[SW] Error checking cached route:", error);
			}
		}
	}

	return null;
}

// Check if a cached route is similar enough to use
function isRouteSimilar(requestedWaypoints, cachedWaypoints, cachedGeometry) {
	if (!cachedWaypoints || cachedWaypoints.length < 2) return false;

	const tolerance = 0.01; // ~1km tolerance

	// Check if start and end points are close enough
	const startMatch = isPointNear(requestedWaypoints[0], cachedWaypoints[0], tolerance);
	const endMatch = isPointNear(
		requestedWaypoints[requestedWaypoints.length - 1],
		cachedWaypoints[cachedWaypoints.length - 1],
		tolerance,
	);

	return startMatch && endMatch && cachedGeometry.length > requestedWaypoints.length;
}

// Check if two points are within tolerance
function isPointNear(point1, point2, tolerance) {
	return Math.abs(point1[0] - point2[0]) < tolerance && Math.abs(point1[1] - point2[1]) < tolerance;
}

// Generate enhanced direct route with intermediate points for better visualization
function generateEnhancedDirectRoute(waypoints) {
	const enhancedGeometry = [];

	for (let i = 0; i < waypoints.length - 1; i++) {
		const start = waypoints[i];
		const end = waypoints[i + 1];

		// Add start point
		if (i === 0) enhancedGeometry.push(start);

		// Add intermediate points for longer segments to make the line look more natural
		const distance = haversineDistance(start[1], start[0], end[1], end[0]);
		const numIntermediatePoints = Math.min(Math.floor(distance * 2), 10); // Max 10 intermediate points

		for (let j = 1; j <= numIntermediatePoints; j++) {
			const fraction = j / (numIntermediatePoints + 1);
			const intermediateLng = start[0] + fraction * (end[0] - start[0]);
			const intermediateLat = start[1] + fraction * (end[1] - start[1]);
			enhancedGeometry.push([intermediateLng, intermediateLat]);
		}

		// Add end point
		enhancedGeometry.push(end);
	}

	return enhancedGeometry;
}

// Create a standardized route response
function createRouteResponse(geometry, waypoints, isFromCache) {
	let totalDistance = 0;

	// Calculate total distance
	for (let i = 0; i < geometry.length - 1; i++) {
		const [lng1, lat1] = geometry[i];
		const [lng2, lat2] = geometry[i + 1];
		totalDistance += haversineDistance(lat1, lng1, lat2, lng2);
	}

	const totalDistanceMeters = totalDistance * 1000;
	const estimatedDuration = Math.round(totalDistanceMeters / 1.4); // ~5 km/h walking speed

	const offlineResponse = {
		routes: [
			{
				geometry: { coordinates: geometry, type: "LineString" },
				distance: totalDistanceMeters,
				duration: estimatedDuration,
				weight_name: "routability",
				weight: estimatedDuration,
				legs: waypoints.slice(0, -1).map((waypoint, i) => {
					const nextWaypoint = waypoints[i + 1];
					const legDistance = haversineDistance(waypoint[1], waypoint[0], nextWaypoint[1], nextWaypoint[0]) * 1000;
					return {
						distance: legDistance,
						duration: Math.round(legDistance / 1.4),
						summary: isFromCache ? "Cached route segment" : "Offline direct route",
						steps: [],
					};
				}),
			},
		],
		waypoints: waypoints.map((coord, i) => ({
			hint: "",
			distance: 0,
			name: i === 0 ? "Start" : i === waypoints.length - 1 ? "End" : `Waypoint ${i}`,
			location: coord,
		})),
		code: "Ok",
		uuid: `offline-route-${Date.now()}`,
	};

	console.log(`[SW] Generated ${isFromCache ? "cached" : "direct"} offline route:`, offlineResponse);

	return new Response(JSON.stringify(offlineResponse), {
		status: 200,
		statusText: "OK",
		headers: {
			"Content-Type": "application/json",
			"X-Offline-Route": "true",
			"X-Route-Source": isFromCache ? "cached" : "direct",
		},
	});
}

// Haversine distance calculation for offline routing
function haversineDistance(lat1, lng1, lat2, lng2) {
	const R = 6371; // Earth's radius in kilometers
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

// Generate a simple hash for waypoints to help match similar routes
function hashWaypoints(url) {
	try {
		const urlObj = new URL(url);
		const pathParts = urlObj.pathname.split("/");
		const coordinatesIndex = pathParts.findIndex(
			(part) => part === "walking" || part === "cycling" || part === "driving" || part === "driving-traffic",
		);
		if (coordinatesIndex !== -1 && coordinatesIndex + 1 < pathParts.length) {
			const coordinatesString = pathParts[coordinatesIndex + 1];
			// Simple hash based on rounded coordinates
			return coordinatesString
				.split(";")
				.map((coord) => {
					const [lng, lat] = coord.split(",").map(Number);
					return `${Math.round(lng * 100)},${Math.round(lat * 100)}`;
				})
				.join(";");
		}
	} catch (error) {
		console.log("[SW] Error hashing waypoints:", error);
	}
	return "";
}

console.log("[SW] Service worker script loaded");
