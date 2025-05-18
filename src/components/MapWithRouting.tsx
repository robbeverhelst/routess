import { useEffect, useRef, useState, useCallback } from 'react';
import Map from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { RouteControls } from '@/components/ui/route-controls';
import { RouteDetails } from '@/components/ui/route-details';
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
import { updateWaypointsLayer } from '@/features/routing/managers/MapLayerManager';
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

export default function MapWithRouting({
  initialViewState = DEFAULT_VIEW_STATE,
  width = '100%',
  height = '100%'
}: MapboxMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [waypointError, setWaypointError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const waypointErrorTimeout = useRef<number | null>(null);
  const animationFrameIdRef = useRef<number | null>(null); // For halo animation
  const initialRouteZoomDoneRef = useRef<boolean>(false); // Added ref
  const routingDisposerRef = useRef<(() => void) | null>(null); // Ref to store the disposer
  const [isMapLocked, setIsMapLocked] = useState(false);
  const isMapLockedRef = useRef(isMapLocked); // Create a ref for isMapLocked
  
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
          setHasRoute
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
  }, [setRouteDistance, setRouteDuration, setHasRoute, setPopup, handleWaypointError, handleRouteInfoErrorFromHook, isMapLocked]);

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

  // Effect to zoom to route when map is locked and a route exists
  useEffect(() => {
    if (isMapLocked && hasRoute && mapRef.current) {
      console.log('[MapWithRouting] Map locked and route exists, zooming to route.');
      handleZoomToRoute();
    }
  }, [isMapLocked, hasRoute, mapRef, handleZoomToRoute]); // Dependencies: isMapLocked, hasRoute, mapRef, and handleZoomToRoute

  // Effect to clean up routing listeners on unmount
  useEffect(() => {
    return () => {
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

  // Effect to update map with user location from hook
  useEffect(() => {
    if (!mapRef.current) return; // Exit if mapRef is not yet set

    if (isMapReady && userLocation) { 
      updateUserLocationPoint(mapRef.current!, userLocation); // Use non-null assertion
    }
  }, [userLocation, isMapReady]);

  // Zoom to user location if available, not loading, no errors, and not initially zoomed yet
  // AND no route was detected in localStorage on init (route zoom takes precedence)
  useEffect(() => {
    if (mapRef.current && isMapReady && userLocation && !isUserLocationLoading && !locationError && !hasInitiallyZoomedToUser.current && !detectedRouteInLocalStorageOnInit) {
      console.log('[MapWithRouting] Initial zoom to user location done.');
      mapRef.current.flyTo({ 
        center: userLocation, 
        zoom: 15,
        bearing: 0,
        pitch: 45,
        padding: { top: 0, bottom: 0, left: 0, right: 0 }
      });
      hasInitiallyZoomedToUser.current = true;
      console.log('[MapWithRouting] Initial zoom to user location done.');
    }
  }, [userLocation, isUserLocationLoading, locationError, isMapReady, detectedRouteInLocalStorageOnInit]); // Added detectedRouteInLocalStorageOnInit

  // Effect for initial zoom to route if a route is present on load
  useEffect(() => {
    if (isMapReady && hasRoute && mapRef.current && !initialRouteZoomDoneRef.current) {
      console.log('[InitialRouteZoomEffect] Active: Map ready, route present, initial zoom not yet done.');
      const currentRouteCoords = getCurrentRoutePath();
      if (currentRouteCoords && currentRouteCoords.length > 0) {
        zoomToRoute(mapRef.current!, currentRouteCoords);
        initialRouteZoomDoneRef.current = true;
        hasInitiallyZoomedToUser.current = true; // Crucial: Mark that an initial zoom action (to route) has occurred
        console.log('[InitialRouteZoomEffect] Successfully zoomed to initial route and set flags.');
      } else {
        console.log('[InitialRouteZoomEffect] Route reported as present, but getCurrentRoutePath() is empty or null. Skipping zoom.');
      }
    }
  }, [isMapReady, hasRoute]); // Dependencies: isMapReady, hasRoute

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
    setDetailsExpanded(false);
    
    console.log('[MapWithRouting] handleReset completed, UI states cleared.');
  }, [setRouteDistance, setRouteDuration, setHasRoute, clearShareState]);

  const handleReverseRoute = useCallback(async () => {
    if (!mapRef.current || !MAPBOX_TOKEN || !hasRoute) return;
    console.log('[MapWithRouting] Attempting to reverse route.');
    await reverseRoute(
      mapRef.current, 
      MAPBOX_TOKEN, 
      setRouteDistance, 
      setRouteDuration, 
      setHasRoute
    );
    console.log('[MapWithRouting] Reverse route call executed.');
  }, [MAPBOX_TOKEN, hasRoute, setRouteDistance, setRouteDuration, setHasRoute]);

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
      MAPBOX_TOKEN,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
      handleWaypointError
    );
    
    // Clear the popup
    setPopup(null);
  }, [popup, handleWaypointError, MAPBOX_TOKEN, setRouteDistance, setRouteDuration, setHasRoute]);

  // Handle remove waypoint button click
  const handleRemoveWaypoint = useCallback(() => {
    if (!mapRef.current || !popup || popup.type !== 'remove' || popup.waypointIndex === undefined) return;
    
    console.log('[MapWithRouting] Removing waypoint at index:', popup.waypointIndex);
    
    removeWaypoint(
      mapRef.current,
      popup.waypointIndex,
      MAPBOX_TOKEN,
      setRouteDistance,
      setRouteDuration,
      setHasRoute
    );
    
    // Clear the popup
    setPopup(null);
  }, [popup, MAPBOX_TOKEN, setRouteDistance, setRouteDuration, setHasRoute]);

  // New: Handle "Add waypoint here" button click from route context menu
  const handleAddWaypointOnRoute = useCallback(async () => {
    if (!mapRef.current || !popup || popup.type !== 'add_on_route' || !MAPBOX_TOKEN) return;

    console.log('[MapWithRouting] Adding waypoint on route at:', [popup.longitude, popup.latitude]);

    await insertWaypointAtLocation(
      mapRef.current,
      [popup.longitude, popup.latitude],
      MAPBOX_TOKEN,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
      handleWaypointError
    );

    setPopup(null);
  }, [popup, MAPBOX_TOKEN, setRouteDistance, setRouteDuration, setHasRoute, handleWaypointError]);

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
    setIsMapLocked(prev => !prev);
  }, []);

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

      {/* Mobile Controls Layout */}
      <div className="absolute top-4 left-0 right-0 z-10 p-4 md:hidden">
        <div className="flex justify-between items-start w-full">
          {/* Top-Left: RouteControls (stacked) */}
          <div className="flex flex-col items-start gap-2">
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
            />
          </div>

          {/* Top-Right: Search Icon + Sidebar (Hamburger) + Conditional Search Bar */}
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

      {/* Route information card */}
      {hasRoute && (
        <div className="absolute bottom-8 right-8 z-10">
          <RouteDetails
            routeDistance={routeDistance}
            routeDuration={routeDuration}
            expanded={detailsExpanded}
            onToggleExpand={() => setDetailsExpanded(prev => !prev)}
          />
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