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
  teardownRouting,
  generateAndDisplayRouteAtoB,
  generateAndDisplayRouteLoop
} from '@/lib/routing';
import { zoomToRoute } from '@/features/routing/utils/RoutingUtils';
import { decompressAndParse, serializeAndCompress } from '@/lib/shareUtils';
// import type { MapTouchEvent, MapMouseEvent } from 'mapbox-gl'; // REMOVED - No longer used
import {
  getWaypoints, getDirectFlags
} from '@/features/routing/managers/WaypointManager';
import { updateWaypointsLayer, ROUTE_LAYER_ID, ROUTE_CASING_LAYER_ID, WAYPOINTS_LAYER_ID, ROUTE_ARROWS_LAYER_ID, initializeSourcesAndLayers, updateRouteLayer } from '@/features/routing/managers/MapLayerManager';
import {
  hasUndo as historyHasUndo,
  hasRedo as historyHasRedo,
} from '@/features/routing/managers/HistoryManager';
import { useUserLocation } from '@/hooks/useUserLocation';
import { MapPopup, type PopupInfo as MapPopupInfo } from '@/components/ui/MapPopup';
import { useRouteData } from '@/hooks/useRouteData';
import { useUndoRedoState } from '@/hooks/useUndoRedoState';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { getCurrentRoutePath } from '@/features/routing/services/RouteCalculationService';
import { closestPointOnSegment, haversine } from '@/features/routing/utils/RoutingUtils'; // Import helpers
import { Logger } from '@/lib/logger';
// Import the new modal and its types
import { RouteGeneratorModal, type RouteGenerationParams } from '@/components/ui/RouteGeneratorModal';
import { type SupportedLanguage } from '@/lib/i18n'; // Added

import { 
  loadMapLockStateFromLocalStorage, 
  saveMapLockStateToLocalStorage,
  loadLightPresetFromLocalStorage,
  saveLightPresetToLocalStorage,
  loadLastMapViewFromLocalStorage,
  saveLastMapViewToLocalStorage,
  loadLanguageFromLocalStorage,
  saveLanguageToLocalStorage,
  loadMapStyleFromLocalStorage,
  saveMapStyleToLocalStorage,
  type MapStyle
} from '@/features/routing/services/LocalStorageService';

// Get Mapbox access token from environment variables
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

// Map configuration constants
const MAP_PITCH = 30; // Default pitch angle for the map

// Fallback for development (remove in production)
// if (!MAPBOX_TOKEN) {
//   Logger.error('Mapbox token not found in environment variables! Please add VITE_MAPBOX_ACCESS_TOKEN to your .env file');
// }

// More detailed check for debugging
if (import.meta.env.DEV && (!MAPBOX_TOKEN || MAPBOX_TOKEN.length < 10)) { // Check if it's falsy or too short to be a real token
  Logger.error(
    `[MapWithRouting] Mapbox token issue: 
    Raw import.meta.env.VITE_MAPBOX_ACCESS_TOKEN: '${import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}', 
    Assigned MAPBOX_TOKEN value: '${MAPBOX_TOKEN}', 
    Type of MAPBOX_TOKEN: '${typeof MAPBOX_TOKEN}'. 
    Please verify VITE_MAPBOX_ACCESS_TOKEN in your .env file or CI secrets.`
  );
} else if (import.meta.env.DEV) {
  Logger.info(
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
    bearing?: number;
    pitch?: number;
  };
  width?: string | number;
  height?: string | number;
}

// Default Europe-centered view if user location unavailable
const DEFAULT_VIEW_STATE = {
  longitude: 10.5,
  latitude: 51.2,
  zoom: 4,
  bearing: 0,
  pitch: 0
};

// Synchronously check localStorage for waypoints at the time of component initialization
let detectedRouteInLocalStorageOnInit = false;
try {
  const storedData = localStorage.getItem('mapWaypoints'); // Key used in routing.ts
  if (storedData) {
    const parsed = JSON.parse(storedData);
    if (parsed && parsed.waypoints && parsed.waypoints.length > 0) {
      detectedRouteInLocalStorageOnInit = true;
      Logger.info('[MapWithRouting Init] Detected route in localStorage on component initialization.');
    }
  }
} catch (e) {
  Logger.error('[MapWithRouting Init] Error reading waypoints from localStorage on init:', e);
}

// Check for last known location in localStorage
let lastKnownLocationFromStorage: [number, number] | null = null;
try {
  const lastKnownStr = localStorage.getItem('lastKnownLocation');
  if (lastKnownStr) {
    const parsed = JSON.parse(lastKnownStr);
    if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[0] === 'number' && typeof parsed[1] === 'number') {
      lastKnownLocationFromStorage = parsed as [number, number];
      Logger.info('[MapWithRouting Init] Detected last known location in localStorage.');
    }
  }
} catch (e) {
  Logger.error('[MapWithRouting Init] Error reading lastKnownLocation from localStorage on init:', e);
}

// Try to load the last map view from localStorage first
const lastSavedMapView = loadLastMapViewFromLocalStorage();

// Define route colors for day and night modes
const DAY_ROUTE_COLOR = '#3887be';
const DAY_ROUTE_HOVER_COLOR = '#FF8C00';
const DAY_ROUTE_CASING_COLOR = '#003366';
const DAY_ROUTE_CASING_OPACITY = 0.2;

// Day mode waypoint colors (reflecting current MapLayerManager defaults)
const DAY_WAYPOINT_DEFAULT_COLOR = '#3887be';
const DAY_WAYPOINT_START_COLOR = '#2ecc71';
const DAY_WAYPOINT_END_COLOR = '#e74c3c';
const DAY_WAYPOINT_DIRECT_COLOR = '#f1c40f';
const DAY_WAYPOINT_STROKE_COLOR = '#FFFFFF';

// Day mode route arrow colors (reflecting current MapLayerManager defaults)
const DAY_ROUTE_ARROW_TEXT_COLOR = '#FFFFFF'; // Assuming this remains constant
const DAY_ROUTE_ARROW_HALO_COLOR = '#3887be';

const NIGHT_ROUTE_COLOR = DAY_ROUTE_COLOR; // Set to day mode blue
const NIGHT_ROUTE_HOVER_COLOR = '#FFDC00';
const NIGHT_ROUTE_CASING_COLOR = '#A4D8F0';
const NIGHT_ROUTE_CASING_OPACITY = 0.3;

// Night mode waypoint colors
const NIGHT_WAYPOINT_DEFAULT_COLOR = DAY_WAYPOINT_DEFAULT_COLOR; // Set to day mode blue for default waypoints
const NIGHT_WAYPOINT_START_COLOR = '#58D68D';
const NIGHT_WAYPOINT_END_COLOR = '#EC7063';
const NIGHT_WAYPOINT_DIRECT_COLOR = '#F7DC6F';
const NIGHT_WAYPOINT_STROKE_COLOR = '#E0E0E0';

// Night mode route arrow colors
const NIGHT_ROUTE_ARROW_TEXT_COLOR = '#FFFFFF'; // Text remains white
const NIGHT_ROUTE_ARROW_HALO_COLOR = '#005080';

// Order of presets for cycling
const lightPresetsOrder: TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];

// Define bearing presets for cycling - simplified to 4 cardinal directions
const BEARING_PRESETS = [0, 90, 180, 270]; // N, E, S, W

// Define IDs for the new source and layer for the line-to-route
const LINE_TO_ROUTE_SOURCE_ID = 'line-to-route-source';
const LINE_TO_ROUTE_LAYER_ID = 'line-to-route-layer';

// Helper function to find the nearest point on a polyline (array of coordinates)
// and the distance to that point.
function findNearestPointOnPolyline(point: [number, number], polyline: [number, number][]): { point: [number, number] | null; distance: number | null } {
  if (!polyline || polyline.length < 2) {
    return { point: null, distance: null };
  }

  let overallClosestPoint: [number, number] | null = null;
  let minDistanceFound = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const segmentStart = polyline[i];
    const segmentEnd = polyline[i + 1];
    const pointOnSegment = closestPointOnSegment(point, segmentStart, segmentEnd);
    const distanceToPoint = haversine(point, pointOnSegment); // distance is in km

    if (distanceToPoint < minDistanceFound) {
      minDistanceFound = distanceToPoint;
      overallClosestPoint = pointOnSegment;
    }
  }
  return { point: overallClosestPoint, distance: minDistanceFound === Infinity ? null : minDistanceFound };
}

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
  const [isMapLocked, setIsMapLocked] = useState(loadMapLockStateFromLocalStorage); // Initialize directly
  const isMapLockedRef = useRef(isMapLocked);
  const [currentLightPreset, setCurrentLightPreset] = useState<TimeOfDay>(loadLightPresetFromLocalStorage() || 'day'); // Initialize with localStorage or default to 'day'
  const [currentBearing, setCurrentBearing] = useState<number>(initialViewState.bearing ?? 0); // Initialize from initialViewState prop or default
  
  // New loading state for route generation
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  
  // Map style state
  const [currentMapStyle, setCurrentMapStyle] = useState<MapStyle>(loadMapStyleFromLocalStorage());

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
    clearShareState,
    setShareNotification
  } = useRouteData();

  const { canUndo, canRedo } = useUndoRedoState();

  const { isOnline } = useServiceWorker();

  const [popup, setPopup] = useState<MapPopupInfo | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // State for the new Route Generator Modal
  const [isRouteGeneratorModalOpen, setIsRouteGeneratorModalOpen] = useState(false);

  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(loadLanguageFromLocalStorage());

  // Effect to save language to localStorage when it changes
  useEffect(() => {
    saveLanguageToLocalStorage(currentLanguage);
  }, [currentLanguage]);

  // Effect to automatically lock map when offline
  useEffect(() => {
    if (!isOnline && !isMapLocked) {
      setIsMapLocked(true);
      isMapLockedRef.current = true;
      saveMapLockStateToLocalStorage(true);
      Logger.info('[MapWithRouting] Map automatically locked due to offline status');
    }
  }, [isOnline, isMapLocked]);

  // Handler for the new onCopyShareLink in RouteControls
  const handleCopyShareLinkToClipboard = useCallback(() => {
    const waypoints = getWaypoints();
    const directFlags = getDirectFlags();

    if (waypoints.length === 0) {
      handleRouteInfoErrorFromHook("Cannot share an empty route.");
      return;
    }

    // Always pass true for isLocked to match sidebar share behavior
    const encodedData = serializeAndCompress(waypoints, directFlags, true);

    if (encodedData) {
      const shareUrl = `${window.location.origin}${window.location.pathname}?route=${encodedData}`;
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          clearShareState(); // Clear previous share states like displayed URL in sidebar
          setShareNotification('Link copied to clipboard!');
          setTimeout(() => setShareNotification(''), 2000);
        })
        .catch(err => {
          Logger.error('[MapWithRouting] Failed to copy share link for RouteControls:', err);
          handleRouteInfoErrorFromHook('Failed to copy link. Please try again.');
        });
    } else {
      handleRouteInfoErrorFromHook('Could not generate shareable link.');
    }
  }, [handleRouteInfoErrorFromHook, setShareNotification, clearShareState]);

  // Effect to set initial bearing from map instance if not set by prop, after map is ready.
  // This updates the state if the map initializes with a different bearing than initialViewState.bearing (e.g. from map's own internal defaults if prop isn't passed)
  useEffect(() => {
    if (mapRef.current && isMapReady && typeof initialViewState.bearing === 'undefined') {
      // Only update if initialViewState didn't provide a bearing.
      // If it did, currentBearing state is already set from it.
      setCurrentBearing(mapRef.current.getBearing());
    }
  }, [isMapReady, initialViewState.bearing]);

  // Use user location for initial view state if available, 
  // UNLESS a route was detected in localStorage at component initialization.
  const effectiveInitialViewState = 
    lastSavedMapView ? { ...lastSavedMapView } :
    detectedRouteInLocalStorageOnInit
    ? DEFAULT_VIEW_STATE 
    : userLocation
    ? {
        longitude: userLocation[0],
        latitude: userLocation[1],
        zoom: 15,
        bearing: initialViewState.bearing ?? 0,
        pitch: MAP_PITCH
      }
    : lastKnownLocationFromStorage 
    ? {
        longitude: lastKnownLocationFromStorage[0],
        latitude: lastKnownLocationFromStorage[1],
        zoom: 14,
        bearing: initialViewState.bearing ?? 0,
        pitch: MAP_PITCH
      }
    : initialViewState; // Fallback to prop or default (which includes bearing and pitch)

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
  const handleMapLoad = useCallback(async (event: { target: mapboxgl.Map }) => {
    Logger.info('[MapWithRouting] Map loaded, setting up routing');
    mapRef.current = event.target;
    const disposer = await setupRouting(
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

    // Apply light preset immediately
    mapRef.current.setConfigProperty('basemap', 'lightPreset', currentLightPreset);
    // Apply initial colors based on the preset immediately
    const isDarkMode = currentLightPreset === 'dusk' || currentLightPreset === 'night';
    if (mapRef.current.getLayer(ROUTE_LAYER_ID)) {
        mapRef.current.setPaintProperty(ROUTE_LAYER_ID, 'line-color', [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            isDarkMode ? NIGHT_ROUTE_HOVER_COLOR : DAY_ROUTE_HOVER_COLOR,
            isDarkMode ? NIGHT_ROUTE_COLOR : DAY_ROUTE_COLOR
        ]);
    }
    if (mapRef.current.getLayer(ROUTE_CASING_LAYER_ID)) {
        mapRef.current.setPaintProperty(ROUTE_CASING_LAYER_ID, 'line-color', isDarkMode ? NIGHT_ROUTE_CASING_COLOR : DAY_ROUTE_CASING_COLOR);
        mapRef.current.setPaintProperty(ROUTE_CASING_LAYER_ID, 'line-opacity', isDarkMode ? NIGHT_ROUTE_CASING_OPACITY : DAY_ROUTE_CASING_OPACITY);
    }
    if (mapRef.current.getLayer(WAYPOINTS_LAYER_ID)) {
      mapRef.current.setPaintProperty(WAYPOINTS_LAYER_ID, 'circle-color', [
        'match',
        ['get', 'pointType'],
        'start', isDarkMode ? NIGHT_WAYPOINT_START_COLOR : DAY_WAYPOINT_START_COLOR,
        'end', isDarkMode ? NIGHT_WAYPOINT_END_COLOR : DAY_WAYPOINT_END_COLOR,
        'direct', isDarkMode ? NIGHT_WAYPOINT_DIRECT_COLOR : DAY_WAYPOINT_DIRECT_COLOR,
        isDarkMode ? NIGHT_WAYPOINT_DEFAULT_COLOR : DAY_WAYPOINT_DEFAULT_COLOR
      ]);
      mapRef.current.setPaintProperty(WAYPOINTS_LAYER_ID, 'circle-stroke-color', isDarkMode ? NIGHT_WAYPOINT_STROKE_COLOR : DAY_WAYPOINT_STROKE_COLOR);
    }
    if (mapRef.current.getLayer(ROUTE_ARROWS_LAYER_ID)) {
      mapRef.current.setPaintProperty(ROUTE_ARROWS_LAYER_ID, 'text-color', isDarkMode ? NIGHT_ROUTE_ARROW_TEXT_COLOR : DAY_ROUTE_ARROW_TEXT_COLOR);
      mapRef.current.setPaintProperty(ROUTE_ARROWS_LAYER_ID, 'text-halo-color', isDarkMode ? NIGHT_ROUTE_ARROW_HALO_COLOR : DAY_ROUTE_ARROW_HALO_COLOR);
    }

    setIsMapReady(true);
    
    // If we detected a route in localStorage, make sure isRouteCoordsReady gets set
    if (detectedRouteInLocalStorageOnInit) {
      // Create a timeout to ensure setIsRouteCoordsReady is called even if something goes wrong
      routeInitTimeoutRef.current = window.setTimeout(() => {
        if (!isRouteCoordsReady) {
          Logger.info('[MapWithRouting] Forcing isRouteCoordsReady after timeout');
          setIsRouteCoordsReady(true);
        }
      }, 1500); // Give it 1.5 seconds to initialize properly
    }
    
    Logger.info('[MapWithRouting] Routing setup complete');

    // Check for shared route data in URL
    const urlParams = new URLSearchParams(window.location.search);
    const routeDataParam = urlParams.get('route');

    if (routeDataParam) {
      Logger.info('[MapWithRouting] Found route data in URL, attempting to load...');
      let loadedData: ReturnType<typeof decompressAndParse> | null = null;
      try {
        loadedData = decompressAndParse(routeDataParam);
      } catch (err) {
        Logger.error('[MapWithRouting] Could not decompress or parse route param:', err);
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
          Logger.info('[MapWithRouting] Route data loaded from URL successfully.');
          // If lock state is present in shared data and is true, lock the map
          if (typeof loadedData.l === 'boolean' && loadedData.l === true) {
            Logger.info('[MapWithRouting] Shared route indicates locked state, applying lock.');
            setIsMapLocked(true); // This will also trigger saving to localStorage via useEffect
          }
          // Optionally, clean the URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }).catch(err => {
          Logger.error('[MapWithRouting] Error setting route data from URL:', err);
          // Show an error to the user if loading fails
          handleRouteInfoErrorFromHook('Failed to load shared route. The link may be invalid or corrupted.');
        });
      } else if (loadedData === null && routeDataParam) {
        // This case is hit if decompressAndParse failed and error was already handled by the catch block.
        // No further action needed here as error is already displayed.
      } else {
        // This case implies routeDataParam was present but loadedData is null for other reasons
        // (e.g. decompressAndParse returned null without throwing, or one of the other conditions failed)
        Logger.warn('[MapWithRouting] Failed to process route data from URL (e.g. map not ready, token missing, or data invalid but not throwing). RouteDataParam was present.');
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
        Logger.warn('[MapWithRouting] No route path coordinates available to zoom to.');
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
        Logger.info('[MapWithRouting] Cleaning up map interaction listeners.');
        routingDisposerRef.current();
        routingDisposerRef.current = null;
      }
      // Call the general routing teardown
      Logger.info('[MapWithRouting] Tearing down routing module subscriptions and refs.');
      teardownRouting();

      if (mapRef.current) {
        Logger.info('[MapWithRouting] Removing map instance (commented out).');
        // mapRef.current.remove(); // This can cause issues if map is removed elsewhere or if used in strict mode with double invokes
      }
    };
  }, []); // Empty dependency array means this runs once on mount and cleanup on unmount

  // Effect to handle prioritized initial map position
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;
    
    // Only execute this if no initial zoom has happened yet
    if (hasInitiallyZoomedToUser.current || initialRouteZoomDoneRef.current) return;
    
    Logger.info('[MapWithRouting] Determining initial map position with priority order...');

    // Priority 1: Zoom to route if available
    if (hasRoute && isRouteCoordsReady) {
      Logger.info('[MapWithRouting] Priority 1: Zooming to available route');
      const currentRouteCoords = getCurrentRoutePath();
      if (currentRouteCoords && currentRouteCoords.length > 0) {
        zoomToRoute(mapRef.current, currentRouteCoords);
        initialRouteZoomDoneRef.current = true;
        hasInitiallyZoomedToUser.current = true;
        Logger.info('[MapWithRouting] Successfully zoomed to initial route.');
        return;
      } else {
        Logger.warn('[MapWithRouting] hasRoute is true but no route coordinates available');
      }
    } else if (detectedRouteInLocalStorageOnInit && mapRef.current) {
      // For routes from localStorage, first check if the route path is already available
      const currentRouteCoords = getCurrentRoutePath();
      if (currentRouteCoords && currentRouteCoords.length > 0) {
        Logger.info('[MapWithRouting] Route coordinates available from localStorage, zooming to route');
        zoomToRoute(mapRef.current, currentRouteCoords);
        initialRouteZoomDoneRef.current = true;
        hasInitiallyZoomedToUser.current = true;
        Logger.info('[MapWithRouting] Successfully zoomed to route from localStorage.');
        return;
      }
      
      // If a route is detected in localStorage but hasRoute is not yet true and no coordinates available,
      // wait for the route to be properly loaded before proceeding to other options
      Logger.info('[MapWithRouting] Route detected in localStorage, waiting for route data to be ready');
      return;
    }

    // Priority 2: Zoom to current user location if available
    if (userLocation && !isUserLocationLoading && !locationError) {
      Logger.info('[MapWithRouting] Priority 2: Zooming to current user location');
      mapRef.current.flyTo({ 
        center: userLocation, 
        zoom: 15,
        bearing: 0,
        pitch: MAP_PITCH,
        padding: { top: 0, bottom: 0, left: 0, right: 0 }
      });
      hasInitiallyZoomedToUser.current = true;
      Logger.info('[MapWithRouting] Successfully zoomed to current user location.');
      return;
    }

    // Priority 3: Zoom to last known location from localStorage
    if (lastKnownLocationFromStorage) {
      Logger.info('[MapWithRouting] Priority 3: Zooming to last known location from localStorage');
      mapRef.current.flyTo({ 
        center: lastKnownLocationFromStorage, 
        zoom: 14,
        bearing: 0,
        pitch: MAP_PITCH,
        padding: { top: 0, bottom: 0, left: 0, right: 0 }
      });
      hasInitiallyZoomedToUser.current = true;
      Logger.info('[MapWithRouting] Successfully zoomed to last known location from localStorage.');
      return;
    }

    // Priority 4: Use default location (already set in initialViewState)
    Logger.info('[MapWithRouting] Priority 4: Using default location (already set in initialViewState)');
    
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
        // Logger.warn('Error setting paint property for halo:', e);
        if (typeof e === 'undefined') Logger.info('Suppressed error');
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
      //   // Logger.warn('Error resetting halo radius:', error);
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

  // --- Handlers for Route Generator Modal ---
  const handleOpenRouteGeneratorModal = useCallback(() => {
    setIsRouteGeneratorModalOpen(true);
  }, []);

  const handleCloseRouteGeneratorModal = useCallback(() => {
    // Only allow closing if not generating
    if (!isGeneratingRoute) {
      setIsRouteGeneratorModalOpen(false);
    }
  }, [isGeneratingRoute]);

  const handleGenerateCustomRoute = useCallback(async (params: RouteGenerationParams) => {
    Logger.info('[MapWithRouting] Generate Custom Route called with params:', params);
    // Set generating state to true
    setIsGeneratingRoute(true);
    
    // Don't close modal yet - we'll show loading animation
    // setIsRouteGeneratorModalOpen(false);

    if (params.routeType === 'a-to-b' && params.startPoint && params.endPoint && mapRef.current && MAPBOX_TOKEN) {
      Logger.info('[MapWithRouting] Resetting existing route before generation for A-to-B...');
      resetRouting(mapRef.current, setRouteDistance, setRouteDuration, setHasRoute);
      clearShareState(); 
      setWaypointError(null);
      setIsRouteCoordsReady(false);

      Logger.info(`[MapWithRouting] Attempting to generate A-to-B route from ${params.startPoint.name} to ${params.endPoint.name} with surface ${params.surfaceType}`);
      
      try {
        const startCoord: [number, number] = [params.startPoint.lng, params.startPoint.lat];
        const endCoord: [number, number] = [params.endPoint.lng, params.endPoint.lat];

        await generateAndDisplayRouteAtoB(
          mapRef.current,
          MAPBOX_TOKEN,
          startCoord,
          endCoord,
          params.surfaceType,
          setRouteDistance,
          setRouteDuration,
          setHasRoute,
          setIsRouteCoordsReady,
          handleWaypointError
        );
        Logger.info('[MapWithRouting] generateAndDisplayRouteAtoB call completed.');

      } catch (error) {
        Logger.error('[MapWithRouting] Error during A-to-B custom route generation attempt:', error);
        handleRouteInfoErrorFromHook(typeof error === 'string' ? error : 'Failed to generate A-to-B route. Please try again.');
        setIsRouteCoordsReady(false);
      } finally {
        // Set generating state to false and close modal
        setIsGeneratingRoute(false);
        setIsRouteGeneratorModalOpen(false);
      }

    } else if (params.routeType === 'loop' && params.startPoint && params.loopLengthKm && mapRef.current && MAPBOX_TOKEN) {
      Logger.info('[MapWithRouting] Resetting existing route before attempting loop generation...');
      resetRouting(mapRef.current, setRouteDistance, setRouteDuration, setHasRoute);
      clearShareState();
      setWaypointError(null);
      setIsRouteCoordsReady(false);
      
      Logger.info(`[MapWithRouting] Loop route generation requested:`);
      Logger.info(`  Start: ${params.startPoint.name} (${params.startPoint.lat.toFixed(5)}, ${params.startPoint.lng.toFixed(5)})`);
      Logger.info(`  Length: ${params.loopLengthKm} km`);
      Logger.info(`  Direction: ${params.loopDirection || 'ANY'}`);
      Logger.info(`  Surface: ${params.surfaceType}`);
      
      try {
        await generateAndDisplayRouteLoop(
          mapRef.current,
          MAPBOX_TOKEN,
          params.startPoint,
          params.loopLengthKm,
          params.loopDirection || 'ANY', // Ensure 'ANY' if undefined
          params.surfaceType,
          setRouteDistance,
          setRouteDuration,
          setHasRoute,
          setIsRouteCoordsReady,
          handleWaypointError
        );
        Logger.info('[MapWithRouting] generateAndDisplayRouteLoop call completed.');
      } catch (error) {
        Logger.error('[MapWithRouting] Error during loop custom route generation attempt:', error);
        handleRouteInfoErrorFromHook(typeof error === 'string' ? error : 'Failed to generate loop route. Please try again.');
        setIsRouteCoordsReady(false);
      } finally {
        // Set generating state to false and close modal
        setIsGeneratingRoute(false);
        setIsRouteGeneratorModalOpen(false);
      }

    } else if (params.routeType === 'loop') {
      // This case handles if loop params are somehow missing despite the modal's validation
      Logger.warn('[MapWithRouting] Loop generation requested but essential parameters are missing.', params);
      handleRouteInfoErrorFromHook('Loop generation failed: missing start point or length.');
      setIsGeneratingRoute(false);
      setIsRouteGeneratorModalOpen(false);
    }
  }, [setRouteDistance, setRouteDuration, setHasRoute, setIsRouteCoordsReady, clearShareState, handleRouteInfoErrorFromHook, handleWaypointError]);

  // Handler functions for controls
  const handleUndo = useCallback(() => {
    if (historyHasUndo()) {
      Logger.info('[MapWithRouting] Calling stepBack');
      stepBack();
    } else {
      Logger.warn('[MapWithRouting] Undo called but no history to undo.');
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (historyHasRedo()) {
      Logger.info('[MapWithRouting] Calling stepForward');
      stepForward();
    } else {
      Logger.warn('[MapWithRouting] Redo called but no history to redo.');
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
    
    Logger.info('[MapWithRouting] handleReset completed, UI states cleared.');
  }, [setRouteDistance, setRouteDuration, setHasRoute, clearShareState]);

  const handleReverseRoute = useCallback(async () => {
    if (!mapRef.current || !MAPBOX_TOKEN || !hasRoute) return;
    Logger.info('[MapWithRouting] Attempting to reverse route.');
    await reverseRoute(
      mapRef.current, 
      MAPBOX_TOKEN!, 
      setRouteDistance, 
      setRouteDuration, 
      setHasRoute,
      isMapLockedRef.current 
    );
    Logger.info('[MapWithRouting] Reverse route call executed.');
  }, [MAPBOX_TOKEN, hasRoute, setRouteDistance, setRouteDuration, setHasRoute, isMapLockedRef]);

  const handleLocate = useCallback(() => {
    if (mapRef.current) {
      if (userLocation && !locationError) {
        mapRef.current.flyTo({ center: userLocation, zoom: 17 });
      } else if (lastKnownLocationFromStorage) {
        mapRef.current.flyTo({ center: lastKnownLocationFromStorage, zoom: 15 });
        Logger.info('[MapWithRouting] Centered on last known location.');
      } else {
        Logger.info('[MapWithRouting] Locate called, but no current or last known location available.');
      }
    }
  }, [userLocation, locationError, lastKnownLocationFromStorage]);

  // PWA Shortcut Event Listeners
  useEffect(() => {
    const handlePWAShortcut = (event: CustomEvent) => {
      const { action } = event.detail;
      Logger.info('[MapWithRouting] PWA shortcut triggered:', action);
      
      switch (action) {
        case 'new-route':
          // Open route generator modal
          setIsRouteGeneratorModalOpen(true);
          break;
        case 'locate':
          // Trigger location finding
          handleLocate();
          break;
        case 'import': {
          // Trigger GPX import by simulating a click on the import button
          // We'll need to trigger the file input from the sidebar
          const fileInput = document.querySelector('input[type="file"][accept=".gpx"]') as HTMLInputElement;
          if (fileInput) {
            fileInput.click();
          } else {
            Logger.warn('[MapWithRouting] Could not find GPX file input for PWA import shortcut');
          }
          break;
        }
        default:
          Logger.warn('[MapWithRouting] Unknown PWA shortcut action:', action);
      }
    };

    // Add event listener for PWA shortcuts
    window.addEventListener('pwa-shortcut', handlePWAShortcut as EventListener);

    return () => {
      // Cleanup event listener
      window.removeEventListener('pwa-shortcut', handlePWAShortcut as EventListener);
    };
  }, [handleLocate]); // Include handleLocate in dependencies

  const handleImportError = useCallback((message: string) => {
    // Reuse handleWaypointError or create a more specific one if needed
    handleWaypointError(`Import Error: ${message}`);
  }, [handleWaypointError]);

  // Handle direct waypoint button click
  const handleAddDirectWaypoint = useCallback(() => {
    if (!mapRef.current || !popup) return;
    
    Logger.info('[MapWithRouting] Adding direct waypoint at:', [popup.longitude, popup.latitude]);
    
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
    
    Logger.info('[MapWithRouting] Removing waypoint at index:', popup.waypointIndex);
    
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

    Logger.info('[MapWithRouting] Adding waypoint on route at:', [popup.longitude, popup.latitude]);

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
    
    Logger.info('[MapWithRouting] Selected location:', location);
    
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

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      const isModifierPressed = event.metaKey || event.ctrlKey;
      
      if (!isModifierPressed) return;
      
      // Prevent default browser behavior for these shortcuts
      if (event.key === 'z' || event.key === 'Z') {
        event.preventDefault();
        
        if (event.shiftKey) {
          // Cmd/Ctrl + Shift + Z = Redo
          if (canRedo) {
            handleRedo();
            Logger.info('[MapWithRouting] Redo triggered via keyboard shortcut');
          }
        } else {
          // Cmd/Ctrl + Z = Undo
          if (canUndo) {
            handleUndo();
            Logger.info('[MapWithRouting] Undo triggered via keyboard shortcut');
          }
        }
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canUndo, canRedo, handleUndo, handleRedo]);

  // Effect to update the ref whenever isMapLocked changes
  useEffect(() => {
    isMapLockedRef.current = isMapLocked;
    // Save to localStorage whenever the state changes
    saveMapLockStateToLocalStorage(isMapLocked);
  }, [isMapLocked]);

  // Effect to save currentLightPreset to localStorage when it changes
  useEffect(() => {
    saveLightPresetToLocalStorage(currentLightPreset);
  }, [currentLightPreset]);

  // Effect to save currentMapStyle to localStorage when it changes
  useEffect(() => {
    saveMapStyleToLocalStorage(currentMapStyle);
  }, [currentMapStyle]);

  // Effect to handle map style changes and re-apply custom styling
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    const map = mapRef.current;

    const handleStyleLoad = () => {
      Logger.info('[MapWithRouting] Map style loaded, re-initializing layers and data');
      
      // Re-apply light preset after style change
      map.setConfigProperty('basemap', 'lightPreset', currentLightPreset);
      
      // Re-initialize all sources and layers (this is crucial for restoring the route)
      initializeSourcesAndLayers(map);
      
      // Re-apply route colors based on current light preset
      const isDarkMode = currentLightPreset === 'dusk' || currentLightPreset === 'night';
      
      // Wait a bit for layers to be available after style change
      setTimeout(() => {
        // Re-apply route data if we have a route
        if (hasRoute) {
          const currentRouteCoords = getCurrentRoutePath();
          const currentWaypoints = getWaypoints();
          
          if (currentRouteCoords && currentRouteCoords.length > 0) {
            Logger.info('[MapWithRouting] Restoring route data after style change');
            updateRouteLayer(map, currentRouteCoords);
          }
          
          if (currentWaypoints && currentWaypoints.length > 0) {
            Logger.info('[MapWithRouting] Restoring waypoints after style change');
            updateWaypointsLayer(map, currentWaypoints, isMapLocked);
          }
        }
        
        // Re-apply user location if available
        if (userLocation) {
          updateUserLocationPoint(map, userLocation);
        }
        
        // Re-apply custom styling
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
        if (map.getLayer(WAYPOINTS_LAYER_ID)) {
          map.setPaintProperty(WAYPOINTS_LAYER_ID, 'circle-color', [
            'match',
            ['get', 'pointType'],
            'start', isDarkMode ? NIGHT_WAYPOINT_START_COLOR : DAY_WAYPOINT_START_COLOR,
            'end', isDarkMode ? NIGHT_WAYPOINT_END_COLOR : DAY_WAYPOINT_END_COLOR,
            'direct', isDarkMode ? NIGHT_WAYPOINT_DIRECT_COLOR : DAY_WAYPOINT_DIRECT_COLOR,
            isDarkMode ? NIGHT_WAYPOINT_DEFAULT_COLOR : DAY_WAYPOINT_DEFAULT_COLOR
          ]);
          map.setPaintProperty(WAYPOINTS_LAYER_ID, 'circle-stroke-color', isDarkMode ? NIGHT_WAYPOINT_STROKE_COLOR : DAY_WAYPOINT_STROKE_COLOR);
        }
        if (map.getLayer(ROUTE_ARROWS_LAYER_ID)) {
          map.setPaintProperty(ROUTE_ARROWS_LAYER_ID, 'text-color', isDarkMode ? NIGHT_ROUTE_ARROW_TEXT_COLOR : DAY_ROUTE_ARROW_TEXT_COLOR);
          map.setPaintProperty(ROUTE_ARROWS_LAYER_ID, 'text-halo-color', isDarkMode ? NIGHT_ROUTE_ARROW_HALO_COLOR : DAY_ROUTE_ARROW_HALO_COLOR);
        }
        
        Logger.info('[MapWithRouting] Style change restoration complete');
      }, 100);
    };

    map.on('style.load', handleStyleLoad);

    return () => {
      map.off('style.load', handleStyleLoad);
    };
  }, [currentMapStyle, currentLightPreset, isMapReady, hasRoute, userLocation, isMapLocked]);

  // Effect to save map view state on moveend
  useEffect(() => {
    if (!mapRef.current) return;

    const handleMoveEnd = () => {
      if (mapRef.current) {
        const currentView = {
          longitude: mapRef.current.getCenter().lng,
          latitude: mapRef.current.getCenter().lat,
          zoom: mapRef.current.getZoom(),
          bearing: mapRef.current.getBearing(),
          pitch: mapRef.current.getPitch(),
        };
        saveLastMapViewToLocalStorage(currentView);
      }
    };

    mapRef.current.on('moveend', handleMoveEnd);

    return () => {
      if (mapRef.current) {
        mapRef.current.off('moveend', handleMoveEnd);
      }
    };
  }, [isMapReady]); // Re-bind if map becomes ready again, though typically only once.

  const handleToggleLock = useCallback(() => {
    setIsMapLocked(prev => {
      const newLockedState = !prev;
      // The saving to localStorage is now handled by the useEffect listening to isMapLocked
      if (newLockedState && mapRef.current && hasRoute) {
        try {
          Logger.info('[MapWithRouting] Map locked, zooming to full route view');
          const currentRouteCoords = getCurrentRoutePath();
          if (currentRouteCoords && currentRouteCoords.length > 0) {
            zoomToRoute(mapRef.current, currentRouteCoords);
          } else {
            Logger.warn('[MapWithRouting] No route coordinates available for auto-zoom on lock');
          }
        } catch (err) {
          Logger.error('[MapWithRouting] Error zooming to route on lock:', err);
        }
      }
      return newLockedState;
    });
  }, [hasRoute]); // Removed setIsMapLocked from here if it was, save is handled by useEffect

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

      // Update waypoint colors
      if (map.getLayer(WAYPOINTS_LAYER_ID)) {
        map.setPaintProperty(WAYPOINTS_LAYER_ID, 'circle-color', [
          'match',
          ['get', 'pointType'],
          'start', isDarkMode ? NIGHT_WAYPOINT_START_COLOR : DAY_WAYPOINT_START_COLOR,
          'end', isDarkMode ? NIGHT_WAYPOINT_END_COLOR : DAY_WAYPOINT_END_COLOR,
          'direct', isDarkMode ? NIGHT_WAYPOINT_DIRECT_COLOR : DAY_WAYPOINT_DIRECT_COLOR,
          isDarkMode ? NIGHT_WAYPOINT_DEFAULT_COLOR : DAY_WAYPOINT_DEFAULT_COLOR // intermediate/other
        ]);
        map.setPaintProperty(WAYPOINTS_LAYER_ID, 'circle-stroke-color', isDarkMode ? NIGHT_WAYPOINT_STROKE_COLOR : DAY_WAYPOINT_STROKE_COLOR);
      }

      // Update route arrow colors
      if (map.getLayer(ROUTE_ARROWS_LAYER_ID)) {
        map.setPaintProperty(ROUTE_ARROWS_LAYER_ID, 'text-color', isDarkMode ? NIGHT_ROUTE_ARROW_TEXT_COLOR : DAY_ROUTE_ARROW_TEXT_COLOR);
        map.setPaintProperty(ROUTE_ARROWS_LAYER_ID, 'text-halo-color', isDarkMode ? NIGHT_ROUTE_ARROW_HALO_COLOR : DAY_ROUTE_ARROW_HALO_COLOR);
      }
    }
  }, [currentLightPreset, mapRef]);
  
  // Effect to set initial light preset on map load, if map is ready before this effect runs.
  // Or, if you prefer, set it once handleMapLoad has confirmed map readiness.
  useEffect(() => {
    if (mapRef.current && isMapReady) { // Ensure map is ready
        // const map = mapRef.current; // map is already mapRef.current
        // map.setConfigProperty('basemap', 'lightPreset', currentLightPreset); // Moved to handleMapLoad
        // Also apply initial route colors based on the initial light preset // Moved to handleMapLoad
        // const isDarkMode = currentLightPreset === 'dusk' || currentLightPreset === 'night';
        // if (map.getLayer(ROUTE_LAYER_ID)) { ... } // Moved
        // if (map.getLayer(ROUTE_CASING_LAYER_ID)) { ... } // Moved
        // if (map.getLayer(WAYPOINTS_LAYER_ID)) { ... } // Moved
        // if (map.getLayer(ROUTE_ARROWS_LAYER_ID)) { ... } // Moved
    }
  }, [isMapReady, currentLightPreset]); // Rerun if currentLightPreset changes (e.g. initial load) or map becomes ready

  // Handler for cycling bearing
  const handleCycleBearing = useCallback(() => {
    if (mapRef.current) {
      const map = mapRef.current;
      // Get current bearing directly from state, as it should be one of the presets
      const currentIndex = BEARING_PRESETS.indexOf(currentBearing);
      // If currentBearing is somehow not in presets (e.g. map was panned manually), find closest or default to N
      const safeCurrentIndex = currentIndex === -1 ? BEARING_PRESETS.indexOf(0) : currentIndex;
      const nextIndex = (safeCurrentIndex + 1) % BEARING_PRESETS.length;
      const nextBearing = BEARING_PRESETS[nextIndex];
      map.flyTo({ bearing: nextBearing, duration: 500 }); // Smoothly fly to new bearing
      setCurrentBearing(nextBearing);
      Logger.info(`[MapWithRouting] Bearing set to: ${nextBearing}`);
    }
  }, [mapRef, currentBearing]); // Added currentBearing to dependencies

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, []);

  // Handler for toggling map style
  const handleToggleMapStyle = useCallback(() => {
    if (mapRef.current) {
      const newStyle: MapStyle = currentMapStyle === 'standard' ? 'satellite' : 'standard';
      const mapStyleUrl = newStyle === 'satellite' 
        ? 'mapbox://styles/mapbox/satellite-v9' 
        : 'mapbox://styles/mapbox/standard';
      
      mapRef.current.setStyle(mapStyleUrl);
      setCurrentMapStyle(newStyle);
      
      // For satellite view, ensure we maintain the space background
      if (newStyle === 'satellite') {
        // Wait for style to load, then configure atmosphere and projection
        mapRef.current.once('style.load', () => {
          if (mapRef.current) {
            // Ensure globe projection is maintained
            mapRef.current.setProjection('globe');
            
            // Configure atmosphere for space background
            mapRef.current.setFog({
              'color': 'rgb(186, 210, 235)', // Light blue
              'high-color': 'rgb(36, 92, 223)', // Dark blue
              'horizon-blend': 0.02,
              'space-color': 'rgb(11, 11, 25)', // Dark space color
              'star-intensity': 0.6
            });
          }
        });
      }
      
      Logger.info(`[MapWithRouting] Map style changed to: ${newStyle}`);
    }
  }, [currentMapStyle]);

  // Effect to manage the line-to-route display
  useEffect(() => {
    if (!isMapReady || !mapRef.current) {
      return;
    }
    const map = mapRef.current;

    const cleanupLineToRoute = () => {
      if (map.getLayer(LINE_TO_ROUTE_LAYER_ID)) {
        map.removeLayer(LINE_TO_ROUTE_LAYER_ID);
      }
      if (map.getSource(LINE_TO_ROUTE_SOURCE_ID)) {
        map.removeSource(LINE_TO_ROUTE_SOURCE_ID);
      }
    };

    if (isMapLocked && userLocation && hasRoute && isRouteCoordsReady) {
      const routePath = getCurrentRoutePath();
      if (routePath && routePath.length >= 2) {
        const { point: nearestPoint, distance: distanceToRouteKm } = findNearestPointOnPolyline(userLocation, routePath);

        // Only show line if nearest point is found AND user is > 50m (0.050 km) away
        if (nearestPoint && distanceToRouteKm !== null && distanceToRouteKm > 0.050) {
          const lineGeoJSON: GeoJSON.Feature<GeoJSON.LineString> = {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [userLocation, nearestPoint],
            },
            properties: {},
          };

          const source = map.getSource(LINE_TO_ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource;
          if (source) {
            source.setData(lineGeoJSON);
          } else {
            map.addSource(LINE_TO_ROUTE_SOURCE_ID, {
              type: 'geojson',
              data: lineGeoJSON,
            });
          }

          if (!map.getLayer(LINE_TO_ROUTE_LAYER_ID)) {
            map.addLayer({
              id: LINE_TO_ROUTE_LAYER_ID,
              type: 'line',
              source: LINE_TO_ROUTE_SOURCE_ID,
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': 'rgba(128, 128, 128, 0.75)', // Semi-transparent grey
                'line-width': 2,
                'line-dasharray': [1, 2], // Shorter dashes, longer gaps
              },
            });
          }
        } else {
          cleanupLineToRoute(); // No nearest point found or too close, cleanup
        }
      } else {
        cleanupLineToRoute(); // Route path not valid, cleanup
      }
    } else {
      cleanupLineToRoute(); // Conditions not met, cleanup
    }

    // Return a cleanup function for when the component unmounts or dependencies change
    // This ensures that if the effect re-runs and conditions are no longer met, the old line is cleaned up.
    // However, the logic above already handles cleanup, so this might be redundant unless the component unmounts
    // while the line is visible. For safety, keeping a minimal cleanup.
    return () => {
      // Basic cleanup, mostly handled by the logic above on dependency change.
      // This ensures removal if component unmounts mid-display.
      // Check map validity as it might be null during unmount sequence.
      if (map && map.getStyle()) { // map.getStyle() is a way to check if map is still valid
        try {
            if (map.getLayer(LINE_TO_ROUTE_LAYER_ID)) {
                map.removeLayer(LINE_TO_ROUTE_LAYER_ID);
            }
            if (map.getSource(LINE_TO_ROUTE_SOURCE_ID)) {
                map.removeSource(LINE_TO_ROUTE_SOURCE_ID);
            }
        } catch (e) {
            // Logger.warn("Error during line-to-route cleanup on unmount/re-effect:", e);
            // Errors can happen here if map is already being destroyed.
             if (typeof e === 'undefined') Logger.info('Suppressed error during cleanup');
        }
      }
    };
  }, [isMapLocked, userLocation, hasRoute, isRouteCoordsReady, isMapReady, mapRef]);

  return (
    <div className={`w-full h-full relative ${isMapLocked ? 'cursor-not-allowed' : ''}`}>
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          ...effectiveInitialViewState,
          pitch: effectiveInitialViewState.pitch ?? MAP_PITCH,
          bearing: effectiveInitialViewState.bearing ?? currentBearing,
        }}
        style={{ width, height }}
        mapStyle={currentMapStyle === 'satellite' ? 'mapbox://styles/mapbox/satellite-v9' : 'mapbox://styles/mapbox/standard'}
        reuseMaps
        attributionControl={false}
        projection="globe"
        antialias={true}
        minPitch={MAP_PITCH}
        maxPitch={MAP_PITCH}
        onLoad={handleMapLoad}
        fog={{
          'color': 'rgb(186, 210, 235)', // Light blue
          'high-color': 'rgb(36, 92, 223)', // Dark blue
          'horizon-blend': 0.02,
          'space-color': 'rgb(11, 11, 25)', // Dark space color
          'star-intensity': 0.6
        }}
      >
        {popup && mapRef.current && (
          <MapPopup 
            popupInfo={popup}
            mapInstance={mapRef.current!}
            onAddDirectWaypoint={handleAddDirectWaypoint}
            onRemoveWaypoint={handleRemoveWaypoint}
            onAddWaypointOnRoute={handleAddWaypointOnRoute}
            currentLanguage={currentLanguage}
          />
        )}
      </Map>

      {/* Route Generation Modal */}
      <RouteGeneratorModal
        isOpen={isRouteGeneratorModalOpen}
        onClose={handleCloseRouteGeneratorModal}
        onGenerate={handleGenerateCustomRoute}
        mapboxToken={MAPBOX_TOKEN}
        isGenerating={isGeneratingRoute}
        userLocation={userLocation}
        isUserLocationLoading={isUserLocationLoading}
        userLocationError={locationError}
        currentLanguage={currentLanguage}
      />

      {/* Mobile Controls Layout - REMOVING mt-12 from RouteControls wrapper */}
      <div className="absolute top-4 left-0 right-0 z-10 p-4 lg:hidden pointer-events-none">
        <div className="flex justify-between items-start w-full">
          {/* Top-Left: RouteControls (stacked) */}
          <div className="flex flex-col items-start gap-2 pointer-events-auto">
            <RouteControls
              onUndo={handleUndo}
              onRedo={handleRedo}
              onReverseRoute={handleReverseRoute}
              onReset={handleReset}
              onLocate={handleLocate}
              canUndo={canUndo}
              canRedo={canRedo}
              canLocateCurrent={!!userLocation && !locationError}
              canLocateLastKnown={!!lastKnownLocationFromStorage}
              hasRoute={hasRoute}
              isLocked={isMapLocked}
              onToggleLock={handleToggleLock}
              onCycleTimeOfDay={handleCycleTimeOfDay}
              currentTimeOfDay={currentLightPreset}
              onOpenRouteGenerator={handleOpenRouteGeneratorModal}
              currentBearing={currentBearing}
              onCycleBearing={handleCycleBearing}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onCopyShareLink={handleCopyShareLinkToClipboard}
              onZoomToRoute={handleZoomToRoute}
              currentLanguage={currentLanguage}
              isOffline={!isOnline}
              currentMapStyle={currentMapStyle}
              onToggleMapStyle={handleToggleMapStyle}
            />
          </div>

          {/* Top-Right: Search Icon + Sidebar (Hamburger) + Conditional Search Bar - REMAINS ALIGNED WITH TOP-4 PADDING */}
          <div className="flex flex-col items-end gap-2 flex-grow pointer-events-auto">
            <div className="flex items-center justify-end gap-2 w-full"> {/* This container ensures LocationSearch can expand */}
              <LocationSearch
                mapboxToken={MAPBOX_TOKEN}
                onSelectLocation={handleSelectLocation}
                isMobileContext={true}
                isMobileSearchOpen={isSearchOpen}
                onToggleMobileSearch={() => setIsSearchOpen(!isSearchOpen)}
                currentLanguage={currentLanguage}
              />
              <Sidebar
                onUndo={handleUndo}
                onRedo={handleRedo}
                onReverseRoute={handleReverseRoute}
                onReset={handleReset}
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
                isLocked={isMapLocked}
                onToggleLock={handleToggleLock}
                map={mapRef.current}
                accessToken={MAPBOX_TOKEN}
                setRouteDistance={setRouteDistance}
                setRouteDuration={setRouteDuration}
                setHasRoute={setHasRoute}
                onImportError={handleImportError}
                onOpenRouteGenerator={handleOpenRouteGeneratorModal}
                currentLanguage={currentLanguage}
                onLanguageChange={setCurrentLanguage}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: RouteControls - Top Center */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10 hidden lg:flex">
        <RouteControls
            onUndo={handleUndo}
            onRedo={handleRedo}
            onReverseRoute={handleReverseRoute}
            onReset={handleReset}
            onLocate={handleLocate}
            canUndo={canUndo}
            canRedo={canRedo}
            canLocateCurrent={!!userLocation && !locationError}
            canLocateLastKnown={!!lastKnownLocationFromStorage}
            hasRoute={hasRoute}
            isLocked={isMapLocked}
            onToggleLock={handleToggleLock}
            onCycleTimeOfDay={handleCycleTimeOfDay}
            currentTimeOfDay={currentLightPreset}
            onOpenRouteGenerator={handleOpenRouteGeneratorModal}
            currentBearing={currentBearing}
            onCycleBearing={handleCycleBearing}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onCopyShareLink={handleCopyShareLinkToClipboard}
            onZoomToRoute={handleZoomToRoute}
            currentLanguage={currentLanguage}
            isOffline={!isOnline}
            currentMapStyle={currentMapStyle}
            onToggleMapStyle={handleToggleMapStyle}
        />
      </div>

      {/* Desktop: Search and Sidebar - Top Right */}
      <div className="absolute top-8 right-8 z-10 hidden lg:flex items-center gap-2">
        <LocationSearch
          mapboxToken={MAPBOX_TOKEN}
          onSelectLocation={handleSelectLocation}
          currentLanguage={currentLanguage}
        />
        <Sidebar
          onUndo={handleUndo}
          onRedo={handleRedo}
          onReverseRoute={handleReverseRoute}
          onReset={handleReset}
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
          isLocked={isMapLocked}
          onToggleLock={handleToggleLock}
          map={mapRef.current}
          accessToken={MAPBOX_TOKEN}
          setRouteDistance={setRouteDistance}
          setRouteDuration={setRouteDuration}
          setHasRoute={setHasRoute}
          onImportError={handleImportError}
          onOpenRouteGenerator={handleOpenRouteGeneratorModal}
          currentLanguage={currentLanguage}
          onLanguageChange={setCurrentLanguage}
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

      {/* Custom Distance Box - Consistently Bottom Right */}
      {hasRoute && routeDistance && (
        <div className="absolute bottom-8 right-8 z-10 bg-white/25 dark:bg-neutral-800/30 text-neutral-700 dark:text-neutral-200 p-3 rounded-lg shadow-lg backdrop-blur-md flex items-baseline gap-0.5 w-auto">
          <span className="text-4xl font-bold">{routeDistance.split(' ')[0]}</span>
          <span className="text-sm">{routeDistance.split(' ')[1]}</span>
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