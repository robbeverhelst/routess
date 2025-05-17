import { useEffect, useRef, useState, useCallback } from 'react';
import Map from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { RouteControls } from '@/components/ui/route-controls';
import { RouteDetails } from '@/components/ui/route-details';
import { Button } from '@/components/ui/button';
import { LocationSearch } from '@/components/ui/location-search';
import { Sidebar } from '@/components/ui/sidebar';
import { 
  setupRouting, 
  resetRouting, 
  stepBack, 
  stepForward, 
  hasUndo, 
  hasRedo,
  addWaypoint,
  removeWaypoint,
  getWaypoints,
  getDirectFlags,
  updateUserLocationPoint,
  setRouteData,
  insertWaypointAtLocation,
  // Placeholder for the new reverseRoute function from routing.ts
  reverseRoute as reverseRouteLogic,
} from '@/lib/routing';
import { serializeAndCompress, decompressAndParse } from '@/lib/shareUtils';
import type { MapTouchEvent, MapMouseEvent } from 'mapbox-gl';

// Get Mapbox access token from environment variables
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

// Fallback for development (remove in production)
// if (!MAPBOX_TOKEN) {
//   console.error('Mapbox token not found in environment variables! Please add VITE_MAPBOX_ACCESS_TOKEN to your .env file');
// }

// More detailed check for debugging
if (!MAPBOX_TOKEN || MAPBOX_TOKEN.length < 10) { // Check if it's falsy or too short to be a real token
  console.error(
    `[MapWithRouting] Mapbox token issue: 
    Raw import.meta.env.VITE_MAPBOX_ACCESS_TOKEN: '${import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}', 
    Assigned MAPBOX_TOKEN value: '${MAPBOX_TOKEN}', 
    Type of MAPBOX_TOKEN: '${typeof MAPBOX_TOKEN}'. 
    Please verify VITE_MAPBOX_ACCESS_TOKEN in your .env file or CI secrets.`
  );
} else {
  console.log(
    `[MapWithRouting] Mapbox token loaded. 
    Type: ${typeof MAPBOX_TOKEN}, 
    Value starts with: ${String(MAPBOX_TOKEN).substring(0, 10)}...`
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

// Define event types - Reinstating MapClickEvent for original handlers
interface MapClickEvent { 
  lngLat: { lng: number; lat: number };
  point: { x: number; y: number };
  preventDefault: () => void;
}

interface PopupInfo {
  longitude: number;
  latitude: number;
  type: 'direct' | 'remove' | 'info' | 'add_on_route';
  waypointIndex?: number;
  message?: string;
}

// Default Europe-centered view if user location unavailable
const DEFAULT_VIEW_STATE = {
  longitude: 10.5,
  latitude: 51.2,
  zoom: 4
};

export default function MapWithRouting({
  initialViewState = DEFAULT_VIEW_STATE,
  width = '100%',
  height = '100%'
}: MapboxMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [routeDistance, setRouteDistance] = useState<string>('');
  const [routeDuration, setRouteDuration] = useState<string>('');
  const [hasRoute, setHasRoute] = useState<boolean>(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(() => {
    const lastKnown = localStorage.getItem('lastKnownLocation');
    if (lastKnown) {
      try {
        const parsed = JSON.parse(lastKnown);
        if (Array.isArray(parsed) && parsed.length === 2 && typeof parsed[0] === 'number' && typeof parsed[1] === 'number') {
          return parsed as [number, number];
        }
      } catch (e) {
        console.error("Failed to parse lastKnownLocation from localStorage", e);
      }
    }
    return null;
  });
  const [locationError, setLocationError] = useState<string | null>(null);
  const [waypointError, setWaypointError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const hasInitiallyZoomedToUser = useRef<boolean>(false);
  const waypointErrorTimeout = useRef<number | null>(null);
  const animationFrameIdRef = useRef<number | null>(null); // For halo animation
  
  // State for popup management
  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false); // New state for mobile search
  const [showRouteInfoError, setShowRouteInfoError] = useState(false);
  const [routeInfoErrorMessage, setRouteInfoErrorMessage] = useState('');
  const [shareNotification, setShareNotification] = useState(''); // For share link copied message
  const [displayedShareUrl, setDisplayedShareUrl] = useState<string | null>(null); // New state for displayed URL

  // Long press detection
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const LONG_PRESS_DURATION = 750; // ms
  const MAX_MOVE_THRESHOLD = 10; // pixels

  // Use user location for initial view state if available
  const effectiveInitialViewState = userLocation 
    ? {
        longitude: userLocation[0],
        latitude: userLocation[1],
        zoom: 15
      } 
    : initialViewState;

  // Handle map load
  const handleMapLoad = useCallback((event: { target: mapboxgl.Map }) => {
    console.log('[MapWithRouting] Map loaded, setting up routing');
    mapRef.current = event.target;
    setupRouting(
      event.target,
      MAPBOX_TOKEN,
      setRouteDistance,
      setRouteDuration,
      setHasRoute
    );
    setIsMapReady(true);
    console.log('[MapWithRouting] Routing setup complete');

    // Check for shared route data in URL
    const urlParams = new URLSearchParams(window.location.search);
    const routeDataParam = urlParams.get('route');

    if (routeDataParam) {
      console.log('[MapWithRouting] Found route data in URL, attempting to load...');
      const loadedData = decompressAndParse(routeDataParam);
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
          handleRouteInfoError('Failed to load shared route. The link may be invalid or corrupted.');
        });
      } else {
        console.warn('[MapWithRouting] Failed to decompress or parse route data from URL.');
        handleRouteInfoError('Could not load shared route. The link appears to be invalid.');
      }
    }
  }, []);

  // Request user location
  useEffect(() => {
    if ('geolocation' in navigator) {
      // Get location once with more permissive settings
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation: [number, number] = [
            position.coords.longitude,
            position.coords.latitude
          ];
          setUserLocation(newLocation);
          localStorage.setItem('lastKnownLocation', JSON.stringify(newLocation));
          setLocationError(null); // Still update error state for internal tracking
          if (mapRef.current) {
            updateUserLocationPoint(mapRef.current, newLocation);
          }
        },
        (error) => {
          console.error('Error getting user location:', error);
          
          // Store error message internally, but don't display to user
          let errorMessage = 'Unable to access your location.';
          
          switch(error.code) {
            case 1: // PERMISSION_DENIED
              errorMessage = 'Location access denied. Please enable location services in your browser.';
              break;
            case 2: // POSITION_UNAVAILABLE
              errorMessage = 'Your location could not be determined. Try again later.';
              break;
            case 3: // TIMEOUT
              errorMessage = 'Location request timed out. Trying again with lower accuracy.';
              // Try again with lower accuracy
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  const newLocation: [number, number] = [
                    position.coords.longitude,
                    position.coords.latitude
                  ];
                  setUserLocation(newLocation);
                  localStorage.setItem('lastKnownLocation', JSON.stringify(newLocation));
                  setLocationError(null); // Still update error state for internal tracking
                  if (mapRef.current) {
                    updateUserLocationPoint(mapRef.current, newLocation);
                  }
                },
                (retryError) => {
                  console.error('Error after retry:', retryError);
                  setLocationError('Could not determine your location after multiple attempts.');
                },
                { 
                  enableHighAccuracy: false, 
                  timeout: 20000,
                  maximumAge: 60000 // Allow cached position up to 1 minute old
                }
              );
              break;
          }
          
          if (error.code !== 3) { // Don't set error for timeout since we're retrying
            setLocationError(errorMessage); // Still update error state for internal tracking
          }
        },
        { 
          enableHighAccuracy: true,
          timeout: 15000, // Extended from 10s to 15s
          maximumAge: 30000 // Allow cached position up to 30 seconds old
        }
      );

      // Setup watch with more relaxed settings
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const updatedLocation: [number, number] = [
            position.coords.longitude,
            position.coords.latitude
          ];
          setUserLocation(updatedLocation);
          localStorage.setItem('lastKnownLocation', JSON.stringify(updatedLocation));
          setLocationError(null);
          if (mapRef.current) {
            updateUserLocationPoint(mapRef.current, updatedLocation);
          }
        },
        (error) => {
          console.error('Error watching location:', error);
          // Only update error message for non-timeout errors
          if (error.code !== 3) {
            let watchErrorMessage = '';
            switch(error.code) {
              case 1: // PERMISSION_DENIED
                watchErrorMessage = 'Location access denied. Please enable location services.';
                break;
              case 2: // POSITION_UNAVAILABLE
                watchErrorMessage = 'Your location is temporarily unavailable.';
                break;
            }
            if (watchErrorMessage) {
              setLocationError(watchErrorMessage);
            }
          }
        },
        { 
          enableHighAccuracy: false, // Use less accurate but faster location
          timeout: 27000,           // Longer timeout
          maximumAge: 60000         // Allow positions up to 1 minute old
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setLocationError('Geolocation is not supported by your browser.');
    }
  }, []);

  // Automatically zoom to user location when it becomes available
  useEffect(() => {
    if (isMapReady && userLocation && mapRef.current && !hasInitiallyZoomedToUser.current) {
      mapRef.current.flyTo({ 
        center: userLocation, 
        zoom: 17,
        essential: true // This ensures the animation runs even for essential UI
      });
      updateUserLocationPoint(mapRef.current, userLocation);
      hasInitiallyZoomedToUser.current = true;
    }
  }, [isMapReady, userLocation]);

  // Update user location marker when map is ready and location is available (covers cases where location is available before map)
  useEffect(() => {
    if (isMapReady && userLocation && mapRef.current) {
      updateUserLocationPoint(mapRef.current, userLocation);
    }
  }, [isMapReady, userLocation]);

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

  // Poll for undo/redo state
  useEffect(() => {
    const interval = setInterval(() => {
      const canUndoValue = hasUndo();
      const canRedoValue = hasRedo();
      setCanUndo(canUndoValue);
      setCanRedo(canRedoValue);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Handler functions for controls
  const handleUndo = useCallback(() => {
    if (!mapRef.current) {
      console.error('[handleUndo] mapRef.current is null');
      return;
    }
    console.log('[handleUndo] Called, undoStack availability:', hasUndo());
    stepBack(
      mapRef.current,
      MAPBOX_TOKEN,
      setRouteDistance,
      setRouteDuration,
      setHasRoute
    );
    console.log('[handleUndo] After stepBack, undoStack availability:', hasUndo());
  }, []);

  const handleRedo = useCallback(() => {
    if (!mapRef.current) return;
    stepForward(
      mapRef.current,
      MAPBOX_TOKEN,
      setRouteDistance,
      setRouteDuration,
      setHasRoute
    );
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
    setPopup(null); // This was likely already here, confirm and keep
    setDisplayedShareUrl(null);
    setShareNotification('');
    setShowRouteInfoError(false);
    setRouteInfoErrorMessage('');
    setWaypointError(null); // Clear any waypoint specific errors
    setDetailsExpanded(false); // Collapse route details card
    
    console.log('[MapWithRouting] handleReset completed, UI states cleared.');
  }, []);

  const handleReverseRoute = useCallback(async () => {
    if (!mapRef.current || !MAPBOX_TOKEN || !hasRoute) return;
    console.log('[MapWithRouting] Attempting to reverse route.');
    // This will call the actual logic in routing.ts once implemented
    // For now, it's a placeholder. We'll need to import `reverseRouteLogic`
    await reverseRouteLogic(
      mapRef.current,
      MAPBOX_TOKEN,
      setRouteDistance,
      setRouteDuration,
      setHasRoute
    );
    // For now, let's log to console until routing.ts is updated
    // alert('Reverse route functionality to be implemented in routing.ts');
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

  // Handle map click
  const handleMapClick = useCallback((event: MapClickEvent) => {
    console.log('[MapWithRouting] Click event at:', event.lngLat);
    // Clear any popups
    setPopup(null);
  }, []);

  // Handle map right-click (context menu)
  const handleContextMenu = useCallback((event: MapClickEvent) => {
    event.preventDefault();
    console.log('[MapWithRouting] Right-click at:', event.lngLat);

    if (!mapRef.current) return;

    // Check for waypoints first
    const pointFeatures = mapRef.current.queryRenderedFeatures([event.point.x, event.point.y], 
      { layers: ['points'] }
    );
    
    if (pointFeatures && pointFeatures.length > 0) {
      // Clicked on a waypoint
      const feature = pointFeatures[0];
      const idxRaw = feature.properties?.waypointIndex;
      const idx = typeof idxRaw === 'string' ? parseInt(idxRaw, 10) : idxRaw;
      
      if (isNaN(idx) || idx < 0 || idx >= getWaypoints().length) {
        console.error('[MapWithRouting] Invalid waypoint index:', idxRaw);
        return;
      }

      setPopup({
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
        type: 'remove',
        waypointIndex: idx
      });
    } else {
      // Not on a waypoint, check if on the route
      const routeFeatures = mapRef.current.queryRenderedFeatures([event.point.x, event.point.y],
        { layers: ['route-hover-target'] } // Check the interactive route layer
      );

      if (routeFeatures && routeFeatures.length > 0 && getWaypoints().length >=1) { // Ensure there's a route to click on
        setPopup({
          longitude: event.lngLat.lng,
          latitude: event.lngLat.lat,
          type: 'add_on_route'
        });
      } else {
        // Clicked on empty space, show direct waypoint popup
        setPopup({
          longitude: event.lngLat.lng,
          latitude: event.lngLat.lat,
          type: 'direct'
        });
      }
    }
  }, []);

  // New: Handle long press for mobile
  const handleLongPress = useCallback((lngLat: { lng: number; lat: number }, point: { x: number; y: number }) => {
    console.log('[MapWithRouting] Long press at:', lngLat);
    if (!mapRef.current) return;

    // Check for waypoints first
    const pointFeatures = mapRef.current.queryRenderedFeatures([point.x, point.y], 
      { layers: ['points'] }
    );
    
    if (pointFeatures && pointFeatures.length > 0) {
      // Long pressed on a waypoint
      const feature = pointFeatures[0];
      const idxRaw = feature.properties?.waypointIndex;
      const idx = typeof idxRaw === 'string' ? parseInt(idxRaw, 10) : typeof idxRaw === 'number' ? idxRaw : -1;
      
      if (idx === -1 || isNaN(idx) || idx < 0 || idx >= getWaypoints().length) {
        console.error('[MapWithRouting] Invalid waypoint index on long press:', idxRaw);
        return;
      }

      setPopup({
        longitude: lngLat.lng,
        latitude: lngLat.lat,
        type: 'remove',
        waypointIndex: idx
      });
    } else {
      // Not on a waypoint, check if on the route
      const routeFeatures = mapRef.current.queryRenderedFeatures([point.x, point.y],
        { layers: ['route-hover-target'] } // Check the interactive route layer
      );
      if (routeFeatures && routeFeatures.length > 0 && getWaypoints().length >=1) { // Ensure there's a route to click on
        setPopup({
          longitude: lngLat.lng,
          latitude: lngLat.lat,
          type: 'add_on_route'
        });
      } else {
        // Long pressed on empty space, show direct waypoint popup
        setPopup({
          longitude: lngLat.lng,
          latitude: lngLat.lat,
          type: 'direct'
        });
      }
    }
  }, []);

  // New: Touch event handlers for long press
  const handleTouchStart = useCallback((event: MapTouchEvent) => {
    // Prevent if more than one touch point (e.g. pinch zoom)
    if (event.points.length > 1) {
        if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;
        }
        touchStartPosRef.current = null;
        return;
    }
    touchStartPosRef.current = { x: event.point.x, y: event.point.y };
    
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }
    longPressTimeoutRef.current = setTimeout(() => {
      if (touchStartPosRef.current) { // Check if touch is still active
        handleLongPress(event.lngLat, event.point);
      }
      longPressTimeoutRef.current = null;
      touchStartPosRef.current = null; // Reset to prevent re-triggering
    }, LONG_PRESS_DURATION);
  }, [handleLongPress]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);

  const handlePointerMove = useCallback((event: MapTouchEvent | MapMouseEvent) => {
    // Determine the correct point property based on event type
    let currentPoint: { x: number; y: number };
    let currentPointsLength: number;

    if ('points' in event) { // It's a MapTouchEvent
      const touchEvent = event as MapTouchEvent;
      currentPoint = touchEvent.point; // mapbox-gl MapTouchEvent uses singular `point` for the primary touch point
      currentPointsLength = touchEvent.points.length;
    } else { // It's a MapMouseEvent
      const mouseEvent = event as MapMouseEvent;
      currentPoint = mouseEvent.point;
      currentPointsLength = 1; // Mouse events are always single point
    }

    if (!touchStartPosRef.current || currentPointsLength > 1) {
        if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;
        }
        touchStartPosRef.current = null;
        return;
    }

    const dx = Math.abs(currentPoint.x - touchStartPosRef.current.x);
    const dy = Math.abs(currentPoint.y - touchStartPosRef.current.y);

    if (dx > MAX_MOVE_THRESHOLD || dy > MAX_MOVE_THRESHOLD) {
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
      touchStartPosRef.current = null; // Reset if touch moves beyond threshold
    }
  }, []);

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
  }, [popup, handleWaypointError, MAPBOX_TOKEN]);

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
  }, [popup, MAPBOX_TOKEN]);

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

  const handleShareRoute = () => {
    const waypoints = getWaypoints();
    const directFlags = getDirectFlags();

    if (waypoints.length === 0) {
      handleRouteInfoError("Cannot share an empty route.");
      return;
    }

    const encodedData = serializeAndCompress(waypoints, directFlags);
    if (encodedData) {
      const shareUrl = `${window.location.origin}${window.location.pathname}?route=${encodedData}`;
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          setShareNotification('Link copied to clipboard!');
          setTimeout(() => setShareNotification(''), 2000);
        })
        .catch(err => {
          console.error('[MapWithRouting] Failed to copy share link:', err);
          handleRouteInfoError('Failed to copy link. Please try again.');
          setDisplayedShareUrl(null);
        });
      setDisplayedShareUrl(shareUrl);
    } else {
      handleRouteInfoError('Could not generate shareable link.');
      setDisplayedShareUrl(null);
    }
  };

  // This new function will be called by the Sidebar's own copy button
  const handleCopySharedUrlInSidebar = (urlToCopy: string) => {
    navigator.clipboard.writeText(urlToCopy)
      .then(() => {
        setShareNotification('Share link copied!');
        setTimeout(() => setShareNotification(''), 2000); 
      })
      .catch(err => {
        console.error('[MapWithRouting] Failed to copy share link from sidebar button:', err);
        handleRouteInfoError('Failed to copy. Please try again.');
      });
  };

  const handleRouteInfoError = (message: string) => {
    setShowRouteInfoError(true);
    setRouteInfoErrorMessage(message);
    setTimeout(() => {
      setShowRouteInfoError(false);
      setRouteInfoErrorMessage('');
    }, 5000); // Clear error after 5 seconds
  };

  return (
    <div className="relative w-full h-full">
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          ...effectiveInitialViewState,
          pitch: 45,
          bearing: 0,
          zoom: effectiveInitialViewState.zoom + 3
        }}
        style={{ width, height }}
        mapStyle="mapbox://styles/mapbox/standard"
        reuseMaps
        attributionControl={false}
        projection="mercator"
        antialias={true}
        onLoad={handleMapLoad}
        onClick={handleMapClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handlePointerMove}
        onMouseMove={handlePointerMove}
      >
        {/* Custom Popup Component instead of Mapbox's Popup */}
        {popup && mapRef.current && (
          <div
            className="absolute z-10 animate-in fade-in"
            style={{
              left: mapRef.current.project([popup.longitude, popup.latitude]).x,
              top: mapRef.current.project([popup.longitude, popup.latitude]).y - 30,
              transform: 'translate(-50%, -100%)'
            }}
          >
            {popup.type === 'direct' && (
              <div className="p-2 bg-white rounded-md shadow-md border border-border">
                <Button
                  variant="ghost"
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                  onClick={handleAddDirectWaypoint}
                >
                  Add direct waypoint
                </Button>
              </div>
            )}
            
            {popup.type === 'remove' && (
              <div className="p-2 bg-white rounded-md shadow-md border border-border">
                <Button
                  variant="ghost"
                  className="text-red-600 hover:text-red-800 hover:bg-red-50 flex items-center gap-2"
                  onClick={handleRemoveWaypoint}
                >
                  <span className="text-lg">🗑️</span>
                  <span>Remove point</span>
                </Button>
              </div>
            )}
            
            {popup.type === 'add_on_route' && (
              <div className="p-2 bg-white rounded-md shadow-md border border-border">
                <Button
                  variant="ghost"
                  className="text-green-600 hover:text-green-800 hover:bg-green-50"
                  onClick={handleAddWaypointOnRoute}
                >
                  Add waypoint here
                </Button>
              </div>
            )}
            
            {popup.type === 'info' && (
              <div className="p-2 bg-white rounded-md shadow-md border border-border">
                <div className="text-sm text-gray-800">
                  {popup.message}
                </div>
              </div>
            )}
          </div>
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
                  onShare={handleShareRoute}
                  displayedShareUrl={displayedShareUrl}
                  setDisplayedShareUrl={setDisplayedShareUrl}
                  onCopySharedUrl={handleCopySharedUrlInSidebar}
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
          onShare={handleShareRoute}
          displayedShareUrl={displayedShareUrl}
          setDisplayedShareUrl={setDisplayedShareUrl}
          onCopySharedUrl={handleCopySharedUrlInSidebar}
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

      {/* Waypoint error notification */}
      {waypointError && (
        <div className="absolute bottom-20 right-8 z-10 max-w-xs bg-orange-50 p-3 rounded-md border border-orange-200 text-sm text-orange-800 shadow-md">
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