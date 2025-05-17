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
  updateUserLocationPoint
} from '@/lib/routing';

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

// Define event types
interface MapClickEvent {
  lngLat: { lng: number; lat: number };
  point: { x: number; y: number };
  preventDefault: () => void;
}

interface PopupInfo {
  longitude: number;
  latitude: number;
  type: 'direct' | 'remove' | 'info';
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
      } catch (error) {
        // Layer or source might not exist if map is being changed/removed
        // console.warn('Error setting paint property for halo:', error);
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
    resetRouting(
      mapRef.current,
      setRouteDistance,
      setRouteDuration,
      setHasRoute
    );
    setPopup(null);
  }, []);

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

    // For queryRenderedFeatures, use a properly formatted point
    const features = mapRef.current.queryRenderedFeatures([event.point.x, event.point.y], 
      { layers: ['points'] }
    );
    
    if (features && features.length > 0) {
      // Clicked on a waypoint
      const feature = features[0];
      const idxRaw = feature.properties?.waypointIndex;
      const idx = typeof idxRaw === 'string' ? parseInt(idxRaw, 10) : idxRaw;
      
      if (isNaN(idx) || idx < 0 || idx >= getWaypoints().length) {
        console.error('[MapWithRouting] Invalid waypoint index:', idxRaw);
        return;
      }

      // Show remove waypoint popup
      setPopup({
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
        type: 'remove',
        waypointIndex: idx
      });
    } else {
      // Show direct waypoint popup
      setPopup({
        longitude: event.lngLat.lng,
        latitude: event.lngLat.lat,
        type: 'direct'
      });
    }
  }, []);

  // Show waypoint error message
  const handleWaypointError = useCallback((message: string) => {
    setWaypointError(message);
    
    // Clear any existing timeout
    if (waypointErrorTimeout.current) {
      clearTimeout(waypointErrorTimeout.current);
      waypointErrorTimeout.current = null;
    }
  }, []);

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
  }, [popup, handleWaypointError]);

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
  }, [popup]);

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

      {/* Controls positioned at top center */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10">
        <RouteControls
          onUndo={handleUndo}
          onRedo={handleRedo}
          onReset={handleReset}
          onLocate={handleLocate}
          canUndo={canUndo}
          canRedo={canRedo}
          hasUserLocation={!!userLocation && !locationError}
        />
      </div>
      
      {/* Search and menu positioned at top right */}
      <div className="absolute top-8 right-8 z-10 flex items-center gap-2">
        <LocationSearch
          mapboxToken={MAPBOX_TOKEN}
          onSelectLocation={handleSelectLocation}
        />
        <Sidebar
          onUndo={handleUndo}
          onRedo={handleRedo}
          onReset={handleReset}
          canUndo={canUndo}
          canRedo={canRedo}
          hasRoute={hasRoute}
          routeDistance={routeDistance}
          routeDuration={routeDuration}
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
    </div>
  );
} 