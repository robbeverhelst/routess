import { useEffect, useRef, useState, useCallback } from 'react';
import Map from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { RouteControls } from '@/components/ui/route-controls';
import { RouteDetails } from '@/components/ui/route-details';
import { 
  setupRouting, 
  resetRouting, 
  stepBack, 
  stepForward, 
  hasUndo, 
  hasRedo,
  addWaypoint,
  removeWaypoint,
  getWaypoints
} from '@/lib/routing';
import { Button } from '@/components/ui/button';

// Get Mapbox access token from environment variables
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

// Fallback for development (remove in production)
if (!MAPBOX_TOKEN) {
  console.error('Mapbox token not found in environment variables! Please add VITE_MAPBOX_ACCESS_TOKEN to your .env file');
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
  type: 'direct' | 'remove';
  waypointIndex?: number;
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
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [waypointError, setWaypointError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const userLocationMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const hasInitiallyZoomedToUser = useRef<boolean>(false);
  const waypointErrorTimeout = useRef<number | null>(null);
  
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
          setLocationError(null);
        },
        (error) => {
          console.error('Error getting user location:', error);
          
          // Provide user-friendly error messages
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
                  setLocationError(null);
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
            setLocationError(errorMessage);
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
          setLocationError(null);
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
        zoom: 15,
        essential: true // This ensures the animation runs even for essential UI
      });
      hasInitiallyZoomedToUser.current = true;
    }
  }, [userLocation, isMapReady]);

  // Update user location marker on map
  useEffect(() => {
    if (isMapReady && userLocation && mapRef.current) {
      const map = mapRef.current;
      
      // Only create marker if it doesn't exist
      if (!userLocationMarkerRef.current) {
        try {
          // Create a container div
          const el = document.createElement('div');
          el.className = 'location-marker';
          
          // Create the inner dot
          const dot = document.createElement('div');
          dot.className = 'location-dot';
          
          // Create the pulse animation
          const pulse = document.createElement('div');
          pulse.className = 'location-pulse';
          
          // Add styles
          el.style.position = 'relative';
          el.style.width = '24px';
          el.style.height = '24px';
          
          dot.style.position = 'absolute';
          dot.style.top = '50%';
          dot.style.left = '50%';
          dot.style.transform = 'translate(-50%, -50%)';
          dot.style.width = '14px';
          dot.style.height = '14px';
          dot.style.borderRadius = '50%';
          dot.style.backgroundColor = '#3b82f6';
          dot.style.boxShadow = '0 0 0 2px white';
          dot.style.zIndex = '2';
          
          pulse.style.position = 'absolute';
          pulse.style.top = '50%';
          pulse.style.left = '50%';
          pulse.style.transform = 'translate(-50%, -50%)';
          pulse.style.width = '24px';
          pulse.style.height = '24px';
          pulse.style.borderRadius = '50%';
          pulse.style.backgroundColor = 'rgba(59, 130, 246, 0.4)';
          pulse.style.zIndex = '1';
          pulse.style.animation = 'pulse 2s ease-out infinite';
          
          // Add keyframes for the pulse animation
          if (!document.getElementById('location-marker-style')) {
            const style = document.createElement('style');
            style.id = 'location-marker-style';
            style.innerHTML = `
              @keyframes pulse {
                0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
              }
            `;
            document.head.appendChild(style);
          }
          
          // Add elements to the DOM
          el.appendChild(dot);
          el.appendChild(pulse);

          // Try different approaches to create a marker
          if (window.mapboxgl) {
            // Global mapboxgl is available
            userLocationMarkerRef.current = new window.mapboxgl.Marker(el)
              .setLngLat(userLocation)
              .addTo(map);
          } else if ('Marker' in map) {
            // @ts-expect-error - Safely ignore since we checked for existence
            userLocationMarkerRef.current = new map.Marker(el)
              .setLngLat(userLocation)
              .addTo(map);
          } else {
            console.error('No Marker constructor available');
          }
        } catch (err) {
          console.error('Error creating location marker:', err);
        }
      } else if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.setLngLat(userLocation);
      }
    }
  }, [userLocation, isMapReady]);

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
  }, []);

  const handleLocate = useCallback(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.flyTo({ center: userLocation, zoom: 15 });
    } else if (locationError && mapRef.current) {
      // Show toast or alert about location error
      console.log(locationError);
      // Could add a UI toast here
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
          </div>
        )}
      </Map>

      {/* Controls positioned at top-right */}
      <div className="absolute top-8 right-8 z-10">
        <RouteControls
          onUndo={handleUndo}
          onRedo={handleRedo}
          onReset={handleReset}
          onLocate={handleLocate}
          canUndo={canUndo}
          canRedo={canRedo}
          hasUserLocation={!!userLocation}
        />
      </div>

      {/* Location error notification */}
      {locationError && (
        <div className="absolute top-20 right-8 z-10 max-w-xs bg-red-50 p-3 rounded-md border border-red-200 text-sm text-red-800">
          {locationError}
        </div>
      )}

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