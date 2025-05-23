// Maps PWA Service Worker
// Version 1.0.0

const CACHE_VERSION = 'maps-v1.0.0';
const CACHE_NAMES = {
  APP_SHELL: `${CACHE_VERSION}-app-shell`,
  API_CACHE: `${CACHE_VERSION}-api-cache`,
  MAP_ASSETS: `${CACHE_VERSION}-map-assets`,
  RUNTIME: `${CACHE_VERSION}-runtime`
};

// App Shell - Critical files that should always be cached
const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  // Icons
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-192x192-maskable.png',
  '/icons/icon-512x512-maskable.png',
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
const CACHE_STRATEGIES = {
  APP_SHELL: 'cache-first',
  API: 'network-first-with-cache-fallback',
  MAP_ASSETS: 'cache-first-with-network-fallback',
  MAP_TILES: 'stale-while-revalidate',
  RUNTIME: 'network-first'
};

// Cache expiration times (in milliseconds)
const CACHE_EXPIRATION = {
  API_CACHE: 24 * 60 * 60 * 1000, // 24 hours
  MAP_ASSETS: 7 * 24 * 60 * 60 * 1000, // 7 days
  MAP_TILES: 30 * 24 * 60 * 60 * 1000, // 30 days
  RUNTIME: 60 * 60 * 1000 // 1 hour
};

// Maximum cache sizes
const MAX_CACHE_ENTRIES = {
  API_CACHE: 100,
  MAP_ASSETS: 200,
  MAP_TILES: 500,
  RUNTIME: 50
};

// Install event - Cache app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker version:', CACHE_VERSION);
  
  event.waitUntil(
    (async () => {
      try {
        // Cache app shell
        const appShellCache = await caches.open(CACHE_NAMES.APP_SHELL);
        
        // Get the actual built assets from the HTML
        const response = await fetch('/');
        const html = await response.text();
        
        // Extract CSS and JS files from the HTML
        const cssMatches = html.match(/href="([^"]*\.css[^"]*)"/g) || [];
        const jsMatches = html.match(/src="([^"]*\.js[^"]*)"/g) || [];
        
        const extractedAssets = [
          ...cssMatches.map(match => match.match(/href="([^"]*)"/)[1]),
          ...jsMatches.map(match => match.match(/src="([^"]*)"/)[1])
        ];
        
        const allShellFiles = [...APP_SHELL_FILES, ...extractedAssets];
        
        console.log('[SW] Caching app shell files:', allShellFiles);
        await appShellCache.addAll(allShellFiles);
        
        // Initialize other caches
        await caches.open(CACHE_NAMES.API_CACHE);
        await caches.open(CACHE_NAMES.MAP_ASSETS);
        await caches.open(CACHE_NAMES.RUNTIME);
        
        console.log('[SW] App shell cached successfully');
        
        // Skip waiting to activate immediately
        self.skipWaiting();
      } catch (error) {
        console.error('[SW] Failed to cache app shell:', error);
      }
    })()
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker version:', CACHE_VERSION);
  
  event.waitUntil(
    (async () => {
      try {
        // Clean up old caches
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name => 
          name.startsWith('maps-v') && !Object.values(CACHE_NAMES).includes(name)
        );
        
        await Promise.all(
          oldCaches.map(cacheName => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
        
        // Take control of all clients
        await self.clients.claim();
        
        console.log('[SW] Service worker activated and took control');
      } catch (error) {
        console.error('[SW] Failed to activate service worker:', error);
      }
    })()
  );
});

// Fetch event - Implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  event.respondWith(handleRequest(request));
});

// Main request handler with different strategies
async function handleRequest(request) {
  const url = new URL(request.url);
  
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
    console.error('[SW] Error handling request:', request.url, error);
    
    // Fallback for navigation requests
    if (request.mode === 'navigate') {
      const cache = await caches.open(CACHE_NAMES.APP_SHELL);
      return await cache.match('/') || new Response('App offline', { status: 503 });
    }
    
    return new Response('Network error', { status: 503 });
  }
}

// Request type checkers
function isAppShellRequest(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin && (
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/logo.png'
  );
}

function isApiRequest(request) {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(request.url));
}

function isMapAssetRequest(request) {
  return MAP_ASSET_PATTERNS.some(pattern => pattern.test(request.url)) && 
         !isMapTileRequest(request);
}

function isMapTileRequest(request) {
  const url = new URL(request.url);
  return url.hostname.includes('tiles.mapbox.com') || 
         url.pathname.includes('/tiles/');
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
      // Cache successful responses
      cache.put(request, networkResponse.clone());
      
      // Clean up old entries
      await cleanupCache(cacheName);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache for:', request.url);
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
  
  if (cachedResponse && await isCacheEntryValid(cachedResponse, cacheName)) {
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
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      cleanupCache(cacheName); // Don't await this
    }
    return networkResponse;
  }).catch(error => {
    console.log('[SW] Background fetch failed for:', request.url);
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
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return true; // No date header, assume valid
  
  const cacheDate = new Date(dateHeader);
  const now = new Date();
  const age = now.getTime() - cacheDate.getTime();
  
  const maxAge = CACHE_EXPIRATION[getCacheType(cacheName)] || CACHE_EXPIRATION.RUNTIME;
  
  return age < maxAge;
}

function getCacheType(cacheName) {
  if (cacheName.includes('api-cache')) return 'API_CACHE';
  if (cacheName.includes('map-assets')) return 'MAP_ASSETS';
  if (cacheName.includes('runtime')) return 'RUNTIME';
  return 'RUNTIME';
}

async function cleanupCache(cacheName) {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  const cacheType = getCacheType(cacheName);
  const maxEntries = MAX_CACHE_ENTRIES[cacheType] || MAX_CACHE_ENTRIES.RUNTIME;
  
  if (requests.length > maxEntries) {
    // Remove oldest entries (simple FIFO)
    const entriesToDelete = requests.slice(0, requests.length - maxEntries);
    await Promise.all(
      entriesToDelete.map(request => cache.delete(request))
    );
    console.log(`[SW] Cleaned up ${entriesToDelete.length} old entries from ${cacheName}`);
  }
}

// Message handling for cache management from the app
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0].postMessage({ type: 'CACHE_STATUS', data: status });
      });
      break;
      
    case 'CLEAR_CACHE':
      clearSpecificCache(data.cacheName).then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED', data: { cacheName: data.cacheName } });
      });
      break;
      
    case 'PRECACHE_ROUTE':
      precacheRoute(data.routeData).then(() => {
        event.ports[0].postMessage({ type: 'ROUTE_PRECACHED', data: data.routeData });
      });
      break;
  }
});

// Utility functions for cache management
async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {};
  
  for (const cacheName of cacheNames) {
    if (cacheName.startsWith('maps-v')) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      status[cacheName] = {
        entries: keys.length,
        size: await getCacheSize(cache)
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
  if (cacheName && cacheName.startsWith('maps-v')) {
    await caches.delete(cacheName);
    console.log('[SW] Cleared cache:', cacheName);
  }
}

async function precacheRoute(routeData) {
  // This could be used to precache map tiles along a route
  console.log('[SW] Precaching route data:', routeData);
  // Implementation would depend on your specific route data structure
}

console.log('[SW] Service worker script loaded'); 