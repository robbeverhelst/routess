import React, { useRef, useEffect, useMemo } from "react";
import Map, { type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMapInitialization } from "@/components/hooks/useMapInitialization";
import { useMapPositioning } from "@/components/hooks/useMapPositioning";
import { useMapConfiguration } from "@/components/providers/MapConfigurationProvider";
import { useUserLocation } from "@/components/providers/UserLocationProvider";
import { MapPopup, type PopupInfo as MapPopupInfo } from "@/components/ui/MapPopup";
import { SunPositionIndicator } from "@/components/ui/SunPositionIndicator";
import { Logger } from "@/lib/logger";
import type { SupportedLanguage } from "@/lib/i18n";
import type { Dispatch, SetStateAction } from "react";
import { useErrorHandler } from "@/lib/errors";

// Map configuration constants
const MAP_PITCH = 30; // Default pitch angle for the map

// Default Europe-centered view if user location unavailable
const DEFAULT_VIEW_STATE = {
  longitude: 10.5,
  latitude: 51.2,
  zoom: 4,
  bearing: 0,
  pitch: 0,
};

interface MapCanvasProps {
  mapRef: React.RefObject<MapboxMap | null>;
  mapboxToken: string;
  width?: string | number;
  height?: string | number;
  initialCenter?: [number, number];
  initialZoom?: number;
  routeId?: string;
  currentLanguage: SupportedLanguage;

  // Route state management
  setRouteDistance: Dispatch<SetStateAction<string>>;
  setRouteDuration: Dispatch<SetStateAction<string>>;
  setHasRoute: Dispatch<SetStateAction<boolean>>;
  hasRoute: boolean;

  // Popup management
  popup: MapPopupInfo | null;
  setPopup: Dispatch<SetStateAction<MapPopupInfo | null>>;
  onAddDirectWaypoint: () => void;
  onRemoveWaypoint: () => void;
  onAddWaypointOnRoute: () => void;

  // Error handling
  handleWaypointError: (message: string | null) => void;
  handleRouteInfoError: (message: string) => void;

  // Initial positioning data
  lastKnownLocationFromStorage: [number, number] | null;
  detectedRouteInLocalStorageOnInit: boolean;
  lastSavedMapView: unknown;
}

const MapCanvasComponent: React.FC<MapCanvasProps> = ({
  mapRef,
  mapboxToken,
  width = "100%",
  height = "100%",
  initialCenter,
  initialZoom,
  routeId,
  currentLanguage,
  setRouteDistance,
  setRouteDuration,
  setHasRoute,
  hasRoute,
  popup,
  setPopup,
  onAddDirectWaypoint,
  onRemoveWaypoint,
  onAddWaypointOnRoute,
  handleWaypointError,
  handleRouteInfoError,
  lastKnownLocationFromStorage,
  detectedRouteInLocalStorageOnInit,
  lastSavedMapView,
}) => {
  const isMapLockedRef = useRef(false);
  const internalMapRef = useRef<MapRef | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Get configuration from providers
  const {
    currentMapStyle,
    isMapLocked,
    currentLightPreset,
    currentBearing,
    setCurrentBearing,
    showSunDirection,
    currentSunPosition,
  } = useMapConfiguration();

  const {
    location: userLocation,
    error: locationError,
    isLoading: isUserLocationLoading,
  } = useUserLocation();

  const { handleMapError } = useErrorHandler();

  // Validate Mapbox token on mount
  useEffect(() => {
    if (!mapboxToken || mapboxToken.includes("__VITE_") || mapboxToken.length < 10) {
      handleMapError(
        new Error(
          "Mapbox access token is missing or invalid. Please configure VITE_MAPBOX_ACCESS_TOKEN in your environment.",
        ),
        "mapbox-config",
      );
    }
  }, [mapboxToken, handleMapError]);

  // Keep ref in sync with state
  useEffect(() => {
    isMapLockedRef.current = isMapLocked;
  }, [isMapLocked]);

  // Map initialization hook
  const { handleMapLoad } = useMapInitialization({
    mapboxToken,
    setRouteDistance,
    setRouteDuration,
    setHasRoute,
    setPopup,
    handleWaypointError,
    isMapLockedRef,
    currentLightPreset,
    routeId,
    handleRouteInfoError,
  });

  // Memoize the complex initial view state calculation to avoid repeated computations
  const effectiveInitialViewState = useMemo(() => {
    const getLastKnownLocation = () => lastKnownLocationFromStorage; // Simplified for this component
    const lastKnownFromService = getLastKnownLocation();

    if (initialCenter && initialZoom) {
      return {
        longitude: initialCenter[0],
        latitude: initialCenter[1],
        zoom: initialZoom,
        bearing: currentBearing,
        pitch: MAP_PITCH,
      };
    }

    if (lastSavedMapView) {
      return { ...DEFAULT_VIEW_STATE, ...(lastSavedMapView as any) };
    }

    if (detectedRouteInLocalStorageOnInit) {
      return DEFAULT_VIEW_STATE;
    }

    if (userLocation) {
      return {
        longitude: userLocation[0],
        latitude: userLocation[1],
        zoom: 15,
        bearing: currentBearing,
        pitch: MAP_PITCH,
      };
    }

    if (lastKnownFromService) {
      return {
        longitude: lastKnownFromService[0],
        latitude: lastKnownFromService[1],
        zoom: 14,
        bearing: currentBearing,
        pitch: MAP_PITCH,
      };
    }

    return DEFAULT_VIEW_STATE;
  }, [
    initialCenter,
    initialZoom,
    currentBearing,
    lastSavedMapView,
    detectedRouteInLocalStorageOnInit,
    userLocation,
    lastKnownLocationFromStorage,
  ]);

  // Map positioning hook
  useMapPositioning({
    mapRef,
    isMapReady: mapRef.current !== null,
    hasRoute,
    isRouteCoordsReady: true, // This would come from route state
    userLocation,
    isUserLocationLoading,
    locationError: locationError as any,
    lastKnownLocationFromStorage,
    detectedRouteInLocalStorageOnInit,
    mapPitch: MAP_PITCH,
  });

  // Effect to set initial bearing from map instance if not set by prop
  useEffect(() => {
    if (mapRef.current && typeof (effectiveInitialViewState as any)?.bearing === "undefined") {
      setCurrentBearing(mapRef.current.getBearing());
    }
  }, [setCurrentBearing, (effectiveInitialViewState as any)?.bearing]);

  // Animate user location halo
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const MIN_HALO_RADIUS = 10;
    const MAX_HALO_RADIUS = 14;
    const PULSE_DURATION_MS = 2000;

    let startTime: number | null = null;

    const animateHalo = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsedTime = timestamp - startTime;
      const pulseProgress = (elapsedTime % PULSE_DURATION_MS) / PULSE_DURATION_MS;
      const easedProgress = (Math.sin(pulseProgress * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      const currentRadius = MIN_HALO_RADIUS + easedProgress * (MAX_HALO_RADIUS - MIN_HALO_RADIUS);

      try {
        if (map.getLayer("user-location-halo") && map.getSource("user-location-point")) {
          map.setPaintProperty("user-location-halo", "circle-radius", currentRadius);
        }
      } catch (e) {
        if (typeof e === "undefined") Logger.info("Suppressed error");
      }
      animationFrameIdRef.current = requestAnimationFrame(animateHalo);
    };

    animationFrameIdRef.current = requestAnimationFrame(animateHalo);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, []);

  return (
    <>
      <Map
        ref={internalMapRef}
        mapboxAccessToken={mapboxToken}
        initialViewState={{
          ...effectiveInitialViewState,
          pitch: (effectiveInitialViewState as any)?.pitch ?? MAP_PITCH,
          bearing: (effectiveInitialViewState as any)?.bearing ?? currentBearing,
        }}
        style={{ width, height }}
        mapStyle={
          currentMapStyle === "satellite"
            ? "mapbox://styles/mapbox/satellite-streets-v12"
            : "mapbox://styles/mapbox/standard"
        }
        reuseMaps
        attributionControl={false}
        projection="globe"
        antialias={true}
        minPitch={MAP_PITCH}
        maxPitch={MAP_PITCH}
        onLoad={(evt) => {
          // Set the external mapRef to the map instance
          if (internalMapRef.current) {
            mapRef.current = internalMapRef.current.getMap();
          }
          handleMapLoad(evt);
        }}
        onError={(error) => {
          Logger.error("[MapCanvas] Map error:", error);

          // Check if it's a Mapbox token error
          if (
            error.error?.message?.includes("401") ||
            error.error?.message?.includes("Invalid access token") ||
            error.error?.message?.includes("Unauthorized")
          ) {
            handleMapError(
              new Error("Invalid Mapbox access token. Please check your API key."),
              "mapbox-auth",
            );
          } else {
            handleMapError(new Error(error.error?.message || "Failed to load map"), "map-load");
          }
        }}
        fog={{
          color: "rgb(186, 210, 235)",
          "high-color": "rgb(36, 92, 223)",
          "horizon-blend": 0.02,
          "space-color": "rgb(11, 11, 25)",
          "star-intensity": 0.6,
        }}
      >
        {popup && mapRef.current && (
          <MapPopup
            popupInfo={popup}
            mapInstance={mapRef.current}
            onAddDirectWaypoint={onAddDirectWaypoint}
            onRemoveWaypoint={onRemoveWaypoint}
            onAddWaypointOnRoute={onAddWaypointOnRoute}
            currentLanguage={currentLanguage}
          />
        )}
      </Map>

      {/* Sun Position Indicator - Shows sun on map edges */}
      {showSunDirection && currentSunPosition && userLocation && (
        <SunPositionIndicator
          azimuth={currentSunPosition.azimuth}
          elevation={currentSunPosition.elevation}
          isVisible={currentSunPosition.isUp}
          timeOfDay={currentLightPreset}
          mapBearing={currentBearing}
        />
      )}
    </>
  );
};

// Memoize MapCanvas to prevent unnecessary re-renders when props haven't changed
export const MapCanvas = React.memo(MapCanvasComponent);
