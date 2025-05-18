import { useEffect, useRef, useState, useCallback } from 'react';
import Map from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { RouteControls, type TimeOfDay } from '@/components/ui/route-controls';
import { LocationSearch } from '@/components/ui/location-search';
import { Sidebar } from '@/components/ui/sidebar';
import { 
  setupRouting, 
  resetRouting, 
  stepBack,
  stepForward,
  reverseRoute,
  updateUserLocationPoint,
  setRouteData,
  insertWaypointAtLocation,
  addWaypoint,
  removeWaypoint,
  teardownRouting
} from '@/lib/routing';
import { zoomToRoute } from '@/features/routing/utils/RoutingUtils';
import { decompressAndParse } from '@/lib/shareUtils';
// import type { MapTouchEvent, MapMouseEvent } from 'mapbox-gl'; // REMOVED - No longer used
import {
  getWaypoints, 
} from '@/features/routing/managers/WaypointManager';
import { updateWaypointsLayer, ROUTE_LAYER_ID, ROUTE_CASING_LAYER_ID } from '@/features/routing/managers/MapLayerManager';
import {
  hasUndo as historyHasUndo,
  hasRedo as historyHasRedo,
} from '@/features/routing/managers/HistoryManager';
import { useUserLocation } from '@/hooks/useUserLocation';
import { MapPopup, type PopupInfo as MapPopupInfo } from '@/components/ui/MapPopup';
import { useRouteData } from '@/hooks/useRouteData';
import { useUndoRedoState } from '@/hooks/useUndoRedoState';
import { getCurrentRoutePath } from '@/features/routing/services/RouteCalculationService';

// Get Mapbox access token from environment variables
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

// Fallback for development (remove in production)
// if (!MAPBOX_TOKEN) {
//   console.error('Mapbox token not found in environment variables! Please add VITE_MAPBOX_ACCESS_TOKEN to your .env file');
// }

// More detailed check for debugging
if (import.meta.env.DEV && (!MAPBOX_TOKEN || MAPBOX_TOKEN.length < 10)) { // Check if it's falsy or too short to be a real token
  console.error(
    `[MapWithRouting] Mapbox token issue: 
    Raw import.meta.env.VITE_MAPBOX_ACCESS_TOKEN: '${import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}', 
    Assigned MAPBOX_TOKEN value: '${MAPBOX_TOKEN}', 
    Type of MAPBOX_TOKEN: '${typeof MAPBOX_TOKEN}'. 
    Please verify VITE_MAPBOX_ACCESS_TOKEN in your .env file or CI secrets.`
  );
} else if (import.meta.env.DEV) {
  console.log(
    `[MapWithRouting] Mapbox token loaded. 
    Type: ${typeof MAPBOX_TOKEN}, 
    Value length: ${MAPBOX_TOKEN?.length ?? 0} (token partially redacted)`
  );
}

interface MapboxMapProps {
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  width?: string | number;
  height?: string | number;
}

// Default Europe-centered view if user location unavailable
const DEFAULT_VIEW_STATE = {
  longitude: 10.5,
  latitude: 51.2,
  zoom: 4
};

// Synchronously check localStorage for waypoints at the time of component initialization
let detectedRouteInLocalStorageOnInit = false;
try {
  const storedData = localStorage.getItem('mapWaypoints'); // Key used in routing.ts
  if (storedData) {
    const parsed = JSON.parse(storedData);
    if (parsed && parsed.waypoints && parsed.waypoints.length > 0) {
      detectedRouteInLocalStorageOnInit = true;
      console.log('[MapWithRouting Init] Detected route in localStorage on component initialization.');
    }
  }
} catch (e) {
  console.error('[MapWithRouting Init] Error reading waypoints from localStorage on init:', e);
}

// Check for last known location in localStorage
let lastKnownLocationFromStorage: [number, number] | null = null;
try {
  const lastKnownStr = localStorage.getItem('lastKnownLocation');
  if (lastKnownStr) {
    const parsed = JSON.parse(lastKnownStr);
    if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[0] === 'number' && typeof parsed[1] === 'number') {
      lastKnownLocationFromStorage = parsed as [number, number];
      console.log('[MapWithRouting Init] Detected last known location in localStorage.');
    }
  }
} catch (e) {
  console.error('[MapWithRouting Init] Error reading lastKnownLocation from localStorage on init:', e);
}

// Define route colors for day and night modes
const DAY_ROUTE_COLOR = '#3887be';
const DAY_ROUTE_HOVER_COLOR = '#FF8C00';
const DAY_ROUTE_CASING_COLOR = '#003366';
const DAY_ROUTE_CASING_OPACITY = 0.2;

const NIGHT_ROUTE_COLOR = '#7FDBFF';
const NIGHT_ROUTE_HOVER_COLOR = '#FFDC00';
const NIGHT_ROUTE_CASING_COLOR = '#A4D8F0';
const NIGHT_ROUTE_CASING_OPACITY = 0.3;

// Order of presets for cycling
const lightPresetsOrder: TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];

export default function MapWithRouting({
  initialViewState = DEFAULT_VIEW_STATE,
  width = '100%',
  height = '100%'
}: MapboxMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [waypointError, setWaypointError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isRouteCoordsReady, setIsRouteCoordsReady] = useState(false);
  const waypointErrorTimeout = useRef<number | null>(null);
  const animationFrameIdRef = useRef<number | null>(null); // For halo animation
  const initialRouteZoomDoneRef = useRef<boolean>(false); // Added ref
  const routingDisposerRef = useRef<(() => void) | null>(null); // Ref to store the disposer
  const routeInitTimeoutRef = useRef<number | null>(null); // Reference to store timeout ID
  const [isMapLocked, setIsMapLocked] = useState(false);
  const isMapLockedRef = useRef(isMapLocked); // Create a ref for isMapLocked
  const [currentLightPreset, setCurrentLightPreset] = useState<TimeOfDay>('day'); // Initial preset
  
  const { 
    location: userLocation, 
    error: locationError, 
    isLoading: isUserLocationLoading, 
    hasInitiallyZoomedRef: hasInitiallyZoomedToUser 
  } = useUserLocation();

  const {
    routeDistance,
    routeDuration,
    hasRoute,
    shareNotification,
    displayedShareUrl,
    showRouteInfoError,
    routeInfoErrorMessage,
    setRouteDistance,
    setRouteDuration,
    setHasRoute,
    handleShareRoute,
    handleCopySharedUrl: handleCopySharedUrlFromHook,
    handleRouteInfoError: handleRouteInfoErrorFromHook,
    clearShareState
  } = useRouteData();

  const { canUndo, canRedo } = useUndoRedoState();

  const [popup, setPopup] = useState<MapPopupInfo | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Use user location for initial view state if available, 
  // UNLESS a route was detected in localStorage at component initialization.
  const effectiveInitialViewState = detectedRouteInLocalStorageOnInit
    ? DEFAULT_VIEW_STATE // If route in LS, start with default, zoomToRoute will adjust
    : userLocation
    ? {
        longitude: userLocation[0],
        latitude: userLocation[1],
        zoom: 15
      }
    : lastKnownLocationFromStorage 
    ? {
        longitude: lastKnownLocationFromStorage[0],
        latitude: lastKnownLocationFromStorage[1],
        zoom: 14
      }
    : initialViewState; // Fallback to prop or default if no userLocation and no LS route

  // Show waypoint error message
  const handleWaypointError = useCallback((message: string | null) => {
    setWaypointError(message);
    if (waypointErrorTimeout.current) {
      clearTimeout(waypointErrorTimeout.current);
    }
    if (message) {
      waypointErrorTimeout.current = window.setTimeout(() => {
        setWaypointError(null);
      }, 5000); // Clear error after 5 seconds
    }
  }, []);

  // Handle map load
  const handleMapLoad = useCallback((event: { target: mapboxgl.Map }) => {
    console.log('[MapWithRouting] Map loaded, setting up routing');
    mapRef.current = event.target;
    const disposer = setupRouting(
      event.target,
      MAPBOX_TOKEN,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
      setPopup,
      handleWaypointError,
      isMapLockedRef
    );
    routingDisposerRef.current = disposer;
    setIsMapReady(true);
    
    // If we detected a route in localStorage, make sure isRouteCoordsReady gets set
    if (detectedRouteInLocalStorageOnInit) {
      // Create a timeout to ensure setIsRouteCoordsReady is called even if something goes wrong
      routeInitTimeoutRef.current = window.setTimeout(() => {
        if (!isRouteCoordsReady) {
          console.log('[MapWithRouting] Forcing isRouteCoordsReady after timeout');
          setIsRouteCoordsReady(true);
        }
      }, 1500); // Give it 1.5 seconds to initialize properly
    }
    
    console.log('[MapWithRouting] Routing setup complete');

    // Check for shared route data in URL
    const urlParams = new URLSearchParams(window.location.search);
    const routeDataParam = urlParams.get('route');

    if (routeDataParam) {
      console.log('[MapWithRouting] Found route data in URL, attempting to load...');
      let loadedData: ReturnType<typeof decompressAndParse> | null = null;
      try {
        loadedData = decompressAndParse(routeDataParam);
      } catch (err) {
        console.error('[MapWithRouting] Could not decompress or parse route param:', err);
        handleRouteInfoErrorFromHook('Failed to read shared route data. The link may be corrupted or invalid.');
        // No return here, allow map to load normally without shared route
      }

      if (loadedData && mapRef.current && MAPBOX_TOKEN) {
        setRouteData(
          mapRef.current,
          MAPBOX_TOKEN,
          loadedData.w, // waypoints
          loadedData.f, // directFlags
          setRouteDistance,
          setRouteDuration,
          setHasRoute,
          setIsRouteCoordsReady
        ).then(() => {
          console.log('[MapWithRouting] Route data loaded from URL successfully.');
          // Optionally, clean the URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }).catch(err => {
          console.error('[MapWithRouting] Error setting route data from URL:', err);
          // Show an error to the user if loading fails
          handleRouteInfoErrorFromHook('Failed to load shared route. The link may be invalid or corrupted.');
        });
      } else if (loadedData === null && routeDataParam) {
        // This case is hit if decompressAndParse failed and error was already handled by the catch block.
        // No further action needed here as error is already displayed.
      } else {
        // This case implies routeDataParam was present but loadedData is null for other reasons
        // (e.g. decompressAndParse returned null without throwing, or one of the other conditions failed)
        console.warn('[MapWithRouting] Failed to process route data from URL (e.g. map not ready, token missing, or data invalid but not throwing). RouteDataParam was present.');
        // Avoid showing a generic error if a specific one was already shown by the catch block for decompressAndParse
        if(loadedData !== null) { // Only show this if decompressAndParse didn't fail and show its own error
            handleRouteInfoErrorFromHook('Could not load shared route. The link appears to be invalid or data is missing.');
        }
      }
    }
  }, [setRouteDistance, setRouteDuration, setHasRoute, setPopup, handleWaypointError, handleRouteInfoErrorFromHook, isMapLocked, isRouteCoordsReady]);

  // Effect to keep the ref's current value in sync with the state
  useEffect(() => {
    isMapLockedRef.current = isMapLocked;
    // Additionally, when the lock state changes, update the waypoint layer
    if (mapRef.current) {
      const currentWaypoints = getWaypoints();
      updateWaypointsLayer(mapRef.current, currentWaypoints, isMapLocked);
    }
  }, [isMapLocked, mapRef]); // Depend on isMapLocked and mapRef

  const handleZoomToRoute = useCallback(() => {
    if (mapRef.current && hasRoute) {
      const currentRouteCoords = getCurrentRoutePath();
      if (currentRouteCoords && currentRouteCoords.length > 0) {
        zoomToRoute(mapRef.current, currentRouteCoords);
      } else {
        console.warn('[MapWithRouting] No route path coordinates available to zoom to.');
      }
    }
  }, [hasRoute]);

  // Clean up the timeout when component unmounts
  useEffect(() => {
    return () => {
      if (routeInitTimeoutRef.current) {
        clearTimeout(routeInitTimeoutRef.current);
        routeInitTimeoutRef.current = null;
      }
      
      if (routingDisposerRef.current) {
        console.log('[MapWithRouting] Cleaning up map interaction listeners.');
        routingDisposerRef.current();
        routingDisposerRef.current = null;
      }
      // Call the general routing teardown
      console.log('[MapWithRouting] Tearing down routing module subscriptions and refs.');
      teardownRouting();

      if (mapRef.current) {
        console.log('[MapWithRouting] Removing map instance (commented out).');
        // mapRef.current.remove(); // This can cause issues if map is removed elsewhere or if used in strict mode with double invokes
      }
    };
  }, []); // Empty dependency array means this runs once on mount and cleanup on unmount

  // Effect to handle prioritized initial map position
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;
    
    // Only execute this if no initial zoom has happened yet
    if (hasInitiallyZoomedToUser.current || initialRouteZoomDoneRef.current) return;
    
    console.log('[MapWithRouting] Determining initial map position with priority order...');

    // Priority 1: Zoom to route if available
    if (hasRoute && isRouteCoordsReady) {
      console.log('[MapWithRouting] Priority 1: Zooming to available route');
      const currentRouteCoords = getCurrentRoutePath();
      if (currentRouteCoords && currentRouteCoords.length > 0) {
        zoomToRoute(mapRef.current, currentRouteCoords);
        initialRouteZoomDoneRef.current = true;
        hasInitiallyZoomedToUser.current = true;
        console.log('[MapWithRouting] Successfully zoomed to initial route.');
        return;
      } else {
        console.warn('[MapWithRouting] hasRoute is true but no route coordinates available');
      }
    } else if (detectedRouteInLocalStorageOnInit && mapRef.current) {
      // For routes from localStorage, first check if the route path is already available
      const currentRouteCoords = getCurrentRoutePath();
      if (currentRouteCoords && currentRouteCoords.length > 0) {
        console.log('[MapWithRouting] Route coordinates available from localStorage, zooming to route');
        zoomToRoute(mapRef.current, currentRouteCoords);
        initialRouteZoomDoneRef.current = true;
        hasInitiallyZoomedToUser.current = true;
        console.log('[MapWithRouting] Successfully zoomed to route from localStorage.');
        return;
      }
      
      // If a route is detected in localStorage but hasRoute is not yet true and no coordinates available,
      // wait for the route to be properly loaded before proceeding to other options
      console.log('[MapWithRouting] Route detected in localStorage, waiting for route data to be ready');
      return;
    }

    // Priority 2: Zoom to current user location if available
    if (userLocation && !isUserLocationLoading && !locationError) {
      console.log('[MapWithRouting] Priority 2: Zooming to current user location');
      mapRef.current.flyTo({ 
        center: userLocation, 
        zoom: 15,
        bearing: 0,
        pitch: 45,
        padding: { top: 0, bottom: 0, left: 0, right: 0 }
      });
      hasInitiallyZoomedToUser.current = true;
      console.log('[MapWithRouting] Successfully zoomed to current user location.');
      return;
    }

    // Priority 3: Zoom to last known location from localStorage
    if (lastKnownLocationFromStorage) {
      console.log('[MapWithRouting] Priority 3: Zooming to last known location from localStorage');
      mapRef.current.flyTo({ 
        center: lastKnownLocationFromStorage, 
        zoom: 14,
        bearing: 0,
        pitch: 30,
        padding: { top: 0, bottom: 0, left: 0, right: 0 }
      });
      hasInitiallyZoomedToUser.current = true;
      console.log('[MapWithRouting] Successfully zoomed to last known location from localStorage.');
      return;
    }

    // Priority 4: Use default location (already set in initialViewState)
    console.log('[MapWithRouting] Priority 4: Using default location (already set in initialViewState)');
    
  }, [isMapReady, hasRoute, isRouteCoordsReady, userLocation, isUserLocationLoading, locationError, lastKnownLocationFromStorage, detectedRouteInLocalStorageOnInit]);

  // Effect to update map with user location from hook
  useEffect(() => {
    if (!mapRef.current) return; // Exit if mapRef is not yet set

    if (isMapReady && userLocation) { 
      updateUserLocationPoint(mapRef.current!, userLocation); // Use non-null assertion
    }
  }, [userLocation, isMapReady]);

  // Animate user location halo
  useEffect(() => {
    if (!isMapReady || !mapRef.current) {
      return;
    }

    const map = mapRef.current;
    const MIN_HALO_RADIUS = 10;
    const MAX_HALO_RADIUS = 14;
    const PULSE_DURATION_MS = 2000; // Duration of one pulse cycle

    let startTime: number | null = null;

    const animateHalo = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
      }
      const elapsedTime = timestamp - startTime;
      const pulseProgress = (elapsedTime % PULSE_DURATION_MS) / PULSE_DURATION_MS; // 0 to 1
      
      // Use a sine wave for smooth pulsing (in-out easing)
      const easedProgress = (Math.sin(pulseProgress * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      const currentRadius = MIN_HALO_RADIUS + easedProgress * (MAX_HALO_RADIUS - MIN_HALO_RADIUS);

      try {
        if (map.getLayer('user-location-halo') && map.getSource('user-location-point')) {
          map.setPaintProperty('user-location-halo', 'circle-radius', currentRadius);
        }
      } catch (e) {
        // Layer or source might not exist if map is being changed/removed
        // console.warn('Error setting paint property for halo:', e);
        if (typeof e === 'undefined') console.log('Suppressed error');
      }
      animationFrameIdRef.current = requestAnimationFrame(animateHalo);
    };

    animationFrameIdRef.current = requestAnimationFrame(animateHalo);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      // Optionally, reset to a default radius if needed when component unmounts or effect re-runs
      // try {
      //   if (map.getLayer('user-location-halo')) {
      //     map.setPaintProperty('user-location-halo', 'circle-radius', 16); // Default radius from routing.ts
      //   }
      // } catch (error) {
      //   // console.warn('Error resetting halo radius:', error);
      // }
    };
  }, [isMapReady]);

  // Clean up waypoint error message after timeout
  useEffect(() => {
    if (waypointError && !waypointErrorTimeout.current) {
      waypointErrorTimeout.current = window.setTimeout(() => {
        setWaypointError(null);
        waypointErrorTimeout.current = null;
      }, 5000); // Hide error after 5 seconds
    }
    
    return () => {
      if (waypointErrorTimeout.current) {
        clearTimeout(waypointErrorTimeout.current);
        waypointErrorTimeout.current = null;
      }
    };
  }, [waypointError]);

  // Handler functions for controls
  const handleUndo = useCallback(() => {
    if (historyHasUndo()) {
      console.log('[MapWithRouting] Calling stepBack');
      stepBack();
    } else {
      console.warn('[MapWithRouting] Undo called but no history to undo.');
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (historyHasRedo()) {
      console.log('[MapWithRouting] Calling stepForward');
      stepForward();
    } else {
      console.warn('[MapWithRouting] Redo called but no history to redo.');
    }
  }, []);

  const handleReset = useCallback(() => {
    if (!mapRef.current) return;
    // Call the main reset logic from routing.ts
    resetRouting(
      mapRef.current,
      setRouteDistance,
      setRouteDuration,
      setHasRoute
    );
    // Clear component-specific states in MapWithRouting.tsx
    setPopup(null);
    clearShareState();
    setWaypointError(null);
    
    console.log('[MapWithRouting] handleReset completed, UI states cleared.');
  }, [setRouteDistance, setRouteDuration, setHasRoute, clearShareState]);

  const handleReverseRoute = useCallback(async () => {
    if (!mapRef.current || !MAPBOX_TOKEN || !hasRoute) return;
    console.log('[MapWithRouting] Attempting to reverse route.');
    await reverseRoute(
      mapRef.current, 
      MAPBOX_TOKEN!, 
      setRouteDistance, 
      setRouteDuration, 
      setHasRoute,
      isMapLockedRef.current 
    );
    console.log('[MapWithRouting] Reverse route call executed.');
  }, [MAPBOX_TOKEN, hasRoute, setRouteDistance, setRouteDuration, setHasRoute, isMapLockedRef]);

  const handleLocate = useCallback(() => {
    if (mapRef.current && userLocation && !locationError) {
      mapRef.current.flyTo({ center: userLocation, zoom: 17 });
    } else if ((!userLocation || locationError) && mapRef.current) {
      // If no location is available or there's an error, log it for debugging
      console.log('Location not available or has error:', locationError);
    }
  }, [userLocation, locationError]);

  const handleImportError = useCallback((message: string) => {
    // Reuse handleWaypointError or create a more specific one if needed
    handleWaypointError(`Import Error: ${message}`);
  }, [handleWaypointError]);

  // Handle direct waypoint button click
  const handleAddDirectWaypoint = useCallback(() => {
    if (!mapRef.current || !popup) return;
    
    console.log('[MapWithRouting] Adding direct waypoint at:', [popup.longitude, popup.latitude]);
    
    addWaypoint(
      mapRef.current,
      [popup.longitude, popup.latitude],
      true, // isDirect = true
      MAPBOX_TOKEN!,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
      handleWaypointError,
      isMapLockedRef.current
    );
    
    setPopup(null);
  }, [popup, handleWaypointError, MAPBOX_TOKEN, setRouteDistance, setRouteDuration, setHasRoute, isMapLockedRef]);

  // Handle remove waypoint button click
  const handleRemoveWaypoint = useCallback(() => {
    if (!mapRef.current || !popup || popup.type !== 'remove' || popup.waypointIndex === undefined) return;
    
    console.log('[MapWithRouting] Removing waypoint at index:', popup.waypointIndex);
    
    removeWaypoint(
      mapRef.current,
      popup.waypointIndex,
      MAPBOX_TOKEN!,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
      handleWaypointError,
      isMapLockedRef.current
    );
    
    setPopup(null);
  }, [popup, MAPBOX_TOKEN, setRouteDistance, setRouteDuration, setHasRoute, handleWaypointError, isMapLockedRef]);

  // New: Handle "Add waypoint here" button click from route context menu
  const handleAddWaypointOnRoute = useCallback(async () => {
    if (!mapRef.current || !popup || popup.type !== 'add_on_route' || !MAPBOX_TOKEN) return;

    console.log('[MapWithRouting] Adding waypoint on route at:', [popup.longitude, popup.latitude]);

    await insertWaypointAtLocation(
      mapRef.current,
      [popup.longitude, popup.latitude],
      MAPBOX_TOKEN!,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
      handleWaypointError,
      isMapLockedRef.current
    );

    setPopup(null);
  }, [popup, MAPBOX_TOKEN, setRouteDistance, setRouteDuration, setHasRoute, handleWaypointError, isMapLockedRef]);

  // Add a new handler for location search
  const handleSelectLocation = useCallback((location: { lng: number; lat: number; name: string }) => {
    if (!mapRef.current) return;
    
    console.log('[MapWithRouting] Selected location:', location);
    
    // Fly to the selected location
    mapRef.current.flyTo({
      center: [location.lng, location.lat],
      zoom: 14,
      duration: 1500
    });
    
    // Optional: Show a temporary tooltip with the location name
    setPopup({
      longitude: location.lng,
      latitude: location.lat,
      type: 'info',
      message: location.name
    });
    
    // Clear the tooltip after 3 seconds
    setTimeout(() => {
      setPopup(null);
    }, 3000);
  }, []);

  const handleToggleLock = useCallback(() => { // Add handleToggleLock function
    setIsMapLocked(prev => {
      const newLockedState = !prev;
      // If we're locking the map, trigger zoom to route
      if (newLockedState && mapRef.current && hasRoute) {
        try {
          console.log('[MapWithRouting] Map locked, zooming to full route view');
          const currentRouteCoords = getCurrentRoutePath();
          if (currentRouteCoords && currentRouteCoords.length > 0) {
            zoomToRoute(mapRef.current, currentRouteCoords);
          } else {
            console.warn('[MapWithRouting] No route coordinates available for auto-zoom on lock');
          }
        } catch (err) {
          console.error('[MapWithRouting] Error zooming to route on lock:', err);
        }
      }
      return newLockedState;
    });
  }, [hasRoute]);

  const handleCycleTimeOfDay = useCallback(() => {
    if (mapRef.current) {
      const map = mapRef.current;
      const currentIndex = lightPresetsOrder.indexOf(currentLightPreset);
      const nextIndex = (currentIndex + 1) % lightPresetsOrder.length;
      const nextLightPreset = lightPresetsOrder[nextIndex];
      
      setCurrentLightPreset(nextLightPreset);
      map.setConfigProperty('basemap', 'lightPreset', nextLightPreset);

      const isDarkMode = nextLightPreset === 'dusk' || nextLightPreset === 'night';

      if (map.getLayer(ROUTE_LAYER_ID)) {
        map.setPaintProperty(ROUTE_LAYER_ID, 'line-color', [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          isDarkMode ? NIGHT_ROUTE_HOVER_COLOR : DAY_ROUTE_HOVER_COLOR,
          isDarkMode ? NIGHT_ROUTE_COLOR : DAY_ROUTE_COLOR
        ]);
      }

      if (map.getLayer(ROUTE_CASING_LAYER_ID)) {
        map.setPaintProperty(ROUTE_CASING_LAYER_ID, 'line-color', isDarkMode ? NIGHT_ROUTE_CASING_COLOR : DAY_ROUTE_CASING_COLOR);
        map.setPaintProperty(ROUTE_CASING_LAYER_ID, 'line-opacity', isDarkMode ? NIGHT_ROUTE_CASING_OPACITY : DAY_ROUTE_CASING_OPACITY);
      }
    }
  }, [currentLightPreset, mapRef]);
  
  // Effect to set initial light preset on map load, if map is ready before this effect runs.
  // Or, if you prefer, set it once handleMapLoad has confirmed map readiness.
  useEffect(() => {
    if (mapRef.current && isMapReady) { // Ensure map is ready
        const map = mapRef.current;
        map.setConfigProperty('basemap', 'lightPreset', currentLightPreset);
        // Also apply initial route colors based on the initial light preset
        const isDarkMode = currentLightPreset === 'dusk' || currentLightPreset === 'night';
        if (map.getLayer(ROUTE_LAYER_ID)) {
            map.setPaintProperty(ROUTE_LAYER_ID, 'line-color', [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                isDarkMode ? NIGHT_ROUTE_HOVER_COLOR : DAY_ROUTE_HOVER_COLOR,
                isDarkMode ? NIGHT_ROUTE_COLOR : DAY_ROUTE_COLOR
            ]);
        }
        if (map.getLayer(ROUTE_CASING_LAYER_ID)) {
            map.setPaintProperty(ROUTE_CASING_LAYER_ID, 'line-color', isDarkMode ? NIGHT_ROUTE_CASING_COLOR : DAY_ROUTE_CASING_COLOR);
            map.setPaintProperty(ROUTE_CASING_LAYER_ID, 'line-opacity', isDarkMode ? NIGHT_ROUTE_CASING_OPACITY : DAY_ROUTE_CASING_OPACITY);
        }
    }
  }, [isMapReady, currentLightPreset]); // Rerun if currentLightPreset changes (e.g. initial load) or map becomes ready

  return (
    <div className="relative w-full h-full">
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          ...effectiveInitialViewState,
          pitch: 45,
          bearing: 0,
          zoom:
  typeof effectiveInitialViewState.zoom === 'number'
    ? effectiveInitialViewState.zoom + 3
    : 7      // sensible default
        }}
        style={{ width, height }}
        mapStyle="mapbox://styles/mapbox/standard"
        reuseMaps
        attributionControl={false}
        projection="mercator"
        antialias={true}
        onLoad={handleMapLoad}
      >
        {popup && mapRef.current && (
          <MapPopup 
            popupInfo={popup}
            mapInstance={mapRef.current!}
            onAddDirectWaypoint={handleAddDirectWaypoint}
            onRemoveWaypoint={handleRemoveWaypoint}
            onAddWaypointOnRoute={handleAddWaypointOnRoute}
          />
        )}
      </Map>

      {/* Mobile Controls Layout - REMOVING mt-12 from RouteControls wrapper */}
      <div className="absolute top-4 left-0 right-0 z-10 p-4 md:hidden">
        <div className="flex justify-between items-start w-full">
          {/* Top-Left: RouteControls (stacked) */}
          <div className="flex flex-col items-start gap-2 md:mt-0"> {/* Removed mt-12 */}
            <RouteControls
              onUndo={handleUndo}
              onRedo={handleRedo}
              onReset={handleReset}
              onLocate={handleLocate}
              canUndo={canUndo}
              canRedo={canRedo}
              hasUserLocation={!!userLocation && !locationError}
              hasRoute={hasRoute}
              isLocked={isMapLocked}
              onToggleLock={handleToggleLock}
              onCycleTimeOfDay={handleCycleTimeOfDay}
              currentTimeOfDay={currentLightPreset}
            />
          </div>

          {/* Top-Right: Search Icon + Sidebar (Hamburger) + Conditional Search Bar - REMAINS ALIGNED WITH TOP-4 PADDING */}
          <div className="flex flex-col items-end gap-2 flex-grow">
            <div className="flex items-center justify-end gap-2 w-full"> {/* This container ensures LocationSearch can expand */}
              <LocationSearch
                mapboxToken={MAPBOX_TOKEN}
                onSelectLocation={handleSelectLocation}
                isMobileContext={true}
                isMobileSearchOpen={isSearchOpen}
                onToggleMobileSearch={() => setIsSearchOpen(!isSearchOpen)}
              />
              {!isSearchOpen && (
                <Sidebar
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onReset={handleReset}
                  onReverseRoute={handleReverseRoute}
                  onZoomToRoute={handleZoomToRoute}
                  onShare={handleShareRoute}
                  displayedShareUrl={displayedShareUrl}
                  onCopySharedUrl={handleCopySharedUrlFromHook}
                  onClearShareDisplay={clearShareState}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  hasRoute={hasRoute}
                  routeDistance={routeDistance}
                  routeDuration={routeDuration}
                  // Props for GPX import/export
                  map={mapRef.current}
                  accessToken={MAPBOX_TOKEN}
                  setRouteDistance={setRouteDistance}
                  setRouteDuration={setRouteDuration}
                  setHasRoute={setHasRoute}
                  onImportError={handleImportError}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: RouteControls - Top Center */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10 hidden md:flex">
        <RouteControls
            onUndo={handleUndo}
            onRedo={handleRedo}
            onReset={handleReset}
            onLocate={handleLocate}
            canUndo={canUndo}
            canRedo={canRedo}
            hasUserLocation={!!userLocation && !locationError}
            hasRoute={hasRoute}
            isLocked={isMapLocked}
            onToggleLock={handleToggleLock}
            onCycleTimeOfDay={handleCycleTimeOfDay}
            currentTimeOfDay={currentLightPreset}
        />
      </div>

      {/* Desktop: Search and Sidebar - Top Right */}
      <div className="absolute top-8 right-8 z-10 hidden md:flex items-center gap-2">
        <LocationSearch
          mapboxToken={MAPBOX_TOKEN}
          onSelectLocation={handleSelectLocation}
        />
        <Sidebar
          onUndo={handleUndo}
          onRedo={handleRedo}
          onReset={handleReset}
          onReverseRoute={handleReverseRoute}
          onZoomToRoute={handleZoomToRoute}
          onShare={handleShareRoute}
          displayedShareUrl={displayedShareUrl}
          onCopySharedUrl={handleCopySharedUrlFromHook}
          onClearShareDisplay={clearShareState}
          canUndo={canUndo}
          canRedo={canRedo}
          hasRoute={hasRoute}
          routeDistance={routeDistance}
          routeDuration={routeDuration}
          // Props for GPX import/export
          map={mapRef.current}
          accessToken={MAPBOX_TOKEN}
          setRouteDistance={setRouteDistance}
          setRouteDuration={setRouteDuration}
          setHasRoute={setHasRoute}
          onImportError={handleImportError}
        />
      </div>

      {/* Waypoint error notification - MOVED TO BOTTOM LEFT */}
      {waypointError && (
        <div className="absolute bottom-8 left-8 z-10 max-w-xs bg-orange-50 p-3 rounded-md border border-orange-200 text-sm text-orange-800 shadow-md">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <span>{waypointError}</span>
          </div>
        </div>
      )}

      {/* Custom Distance Box - Bottom Left */}
      {hasRoute && routeDistance && (
        <div className="absolute bottom-16 left-8 z-10 bg-white/20 text-black p-4 rounded-md shadow-md backdrop-blur-sm flex items-baseline gap-0.5">
          <span className="text-5xl font-bold">{routeDistance.split(' ')[0]}</span>
          <span className="text-base">{routeDistance.split(' ')[1]}</span>
        </div>
      )}

      {showRouteInfoError && (
        <div 
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#2c3e50',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '5px',
            zIndex: 1000,
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}
        >
          {routeInfoErrorMessage}
        </div>
      )}

      {shareNotification && (
        <div 
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#2c3e50',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '5px',
            zIndex: 1000,
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}
        >
          {shareNotification}
        </div>
      )}
    </div>
  );
} 