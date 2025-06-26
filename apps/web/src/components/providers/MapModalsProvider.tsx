import React, { createContext, useContext, useState, useCallback } from "react";
import type { RouteGenerationParams } from "@/components/modals/RouteGeneratorModal";
import { RouteGeneratorModal } from "@/components/modals/RouteGeneratorModal";
import { SaveRouteModal } from "@/components/modals/SaveRouteModal";
import { RouteLibraryModal } from "@/components/modals/RouteLibraryModal";
import { LoginModal } from "@/components/auth/LoginModal";
import { googleAuth } from "@/lib/google-auth";
import { apiService, type ApiRoute } from "@/lib/api";
import type { SupportedLanguage } from "@/lib/i18n";
import type { Map as MapboxMap } from "mapbox-gl";
import { Logger } from "@/lib/logger";
import { useRoutingStore } from "@/stores/routingStore";
import type { Coordinate } from "@/types/map";
import {
  updateWaypointsLayer,
  updateRouteLayer,
  clearRouteLayer,
} from "@/features/routing/managers/MapLayerManager";

interface MapModalsContextType {
  // Route Generator Modal
  isRouteGeneratorModalOpen: boolean;
  isGeneratingRoute: boolean;
  openRouteGeneratorModal: () => void;
  closeRouteGeneratorModal: () => void;

  // Save Route Modal
  isSaveRouteModalOpen: boolean;
  openSaveRouteModal: () => void;
  closeSaveRouteModal: () => void;

  // Route Library Modal
  isRouteLibraryModalOpen: boolean;
  openRouteLibraryModal: () => void;
  closeRouteLibraryModal: () => void;

  // Login Modal
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;

  // Actions
  handleGenerateCustomRoute: (params: RouteGenerationParams) => Promise<void>;
  handleLoadRoute: (route: ApiRoute) => void;
  handleLoginSuccess: () => void;
}

const MapModalsContext = createContext<MapModalsContextType | null>(null);

export const useMapModals = () => {
  const context = useContext(MapModalsContext);
  if (!context) {
    throw new Error("useMapModals must be used within a MapModalsProvider");
  }
  return context;
};
// Export context for separate import
export { MapModalsContext };

interface MapModalsProviderProps {
  children: React.ReactNode;
  mapboxToken: string;
  currentLanguage: SupportedLanguage;
  userLocation: [number, number] | null;
  isUserLocationLoading: boolean;
  userLocationError: Error | null;
  mapRef: React.RefObject<MapboxMap | null>;
  setRouteDistance: React.Dispatch<React.SetStateAction<string>>;
  setRouteDuration: React.Dispatch<React.SetStateAction<string>>;
  setHasRoute: React.Dispatch<React.SetStateAction<boolean>>;
}

export const MapModalsProvider: React.FC<MapModalsProviderProps> = ({
  children,
  mapboxToken,
  currentLanguage,
  userLocation,
  isUserLocationLoading,
  userLocationError,
  mapRef,
  setRouteDistance,
  setRouteDuration,
  setHasRoute,
}) => {
  // Get map lock state from Zustand store
  const isMapLocked = useRoutingStore((state) => state.isMapLocked);
  // Modal states
  const [isRouteGeneratorModalOpen, setIsRouteGeneratorModalOpen] = useState(false);
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const [isSaveRouteModalOpen, setIsSaveRouteModalOpen] = useState(false);
  const [isRouteLibraryModalOpen, setIsRouteLibraryModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Route Generator Modal handlers
  const openRouteGeneratorModal = useCallback(() => {
    setIsRouteGeneratorModalOpen(true);
  }, []);

  const closeRouteGeneratorModal = useCallback(() => {
    if (!isGeneratingRoute) {
      setIsRouteGeneratorModalOpen(false);
    }
  }, [isGeneratingRoute]);

  // Save Route Modal handlers
  const openSaveRouteModal = useCallback(() => {
    if (googleAuth.isSignedIn()) {
      setIsSaveRouteModalOpen(true);
    } else {
      setIsLoginModalOpen(true);
    }
  }, []);

  const closeSaveRouteModal = useCallback(() => {
    setIsSaveRouteModalOpen(false);
  }, []);

  // Route Library Modal handlers
  const openRouteLibraryModal = useCallback(() => {
    if (googleAuth.isSignedIn()) {
      setIsRouteLibraryModalOpen(true);
    } else {
      setIsLoginModalOpen(true);
    }
  }, []);

  const closeRouteLibraryModal = useCallback(() => {
    setIsRouteLibraryModalOpen(false);
  }, []);

  // Login Modal handlers
  const openLoginModal = useCallback(() => {
    setIsLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setIsLoginModalOpen(false);
  }, []);

  const handleLoginSuccess = useCallback(() => {
    setIsLoginModalOpen(false);
    // Refresh the API service token after login
    apiService.refreshToken();
    // After successful login, open the save route modal
    setIsSaveRouteModalOpen(true);
  }, []);

  // Custom route generation handler (placeholder)
  const handleGenerateCustomRoute = useCallback(async (params: RouteGenerationParams) => {
    setIsGeneratingRoute(true);
    // TODO: Implement route generation
    Logger.info("Generate route:", params);
    setIsGeneratingRoute(false);
    setIsRouteGeneratorModalOpen(false);
  }, []);

  // Route loading handler
  const handleLoadRoute = useCallback(
    async (route: ApiRoute) => {
      Logger.info(
        `[MapModalsProvider] Loading route: ${route.name} with ${route.waypoints.length} waypoints`,
      );

      if (!mapRef.current) {
        Logger.error("[MapModalsProvider] Map not ready for route loading");
        return;
      }

      try {
        setIsRouteLibraryModalOpen(false);

        // Convert API waypoints to routing system format
        const waypoints: Coordinate[] = route.waypoints.map((wp) => [wp.lng, wp.lat]);
        const directFlags: boolean[] = route.waypoints.map((wp) => wp.type === "direct");

        Logger.info("[MapModalsProvider] Converting waypoints:", waypoints.length);

        // Clear any existing route first
        useRoutingStore.getState().clearWaypoints();
        clearRouteLayer(mapRef.current);

        // Save snapshot before loading new route
        useRoutingStore.getState().saveSnapshot();

        // Load waypoints into the routing store
        useRoutingStore.getState().setWaypoints(waypoints, directFlags);

        // Update waypoints visualization on map
        updateWaypointsLayer(mapRef.current, waypoints, isMapLocked);

        // If we have at least 2 waypoints, calculate and display the route
        if (waypoints.length >= 2 && mapboxToken) {
          try {
            // Use the same API call logic as in routing.ts
            const waypointsString = waypoints.map((point) => `${point[0]},${point[1]}`).join(";");
            const radiusesString = waypoints.map(() => "150").join(";");

            const queryUrl =
              `https://api.mapbox.com/directions/v5/mapbox/walking/${waypointsString}?` +
              `steps=true&geometries=geojson&overview=full&continue_straight=true&` +
              `access_token=${mapboxToken}&radiuses=${radiusesString}`;

            const response = await fetch(queryUrl, { method: "GET" });
            if (response.ok) {
              const json = await response.json();
              if (json?.routes?.[0]?.geometry) {
                const data = json.routes[0];
                const routeCoords = data.geometry.coordinates;
                const totalDistance = data.distance / 1000; // Convert to km
                const duration = Math.round(data.duration / 60); // Convert to minutes

                // Update route visualization
                updateRouteLayer(mapRef.current, routeCoords);

                // Update UI state
                setRouteDistance(`${totalDistance.toFixed(2)} km`);
                setRouteDuration(`${duration} min`);
                setHasRoute(true);

                // Update store state
                useRoutingStore.getState().setRouteDistance(`${totalDistance.toFixed(2)} km`);
                useRoutingStore.getState().setRouteDuration(`${duration} min`);
                useRoutingStore.getState().setHasRoute(true);

                // Snap waypoints if API provided them
                if (json.waypoints && json.waypoints.length > 0) {
                  const snappedWaypoints = json.waypoints.map(
                    (wp: any) => [wp.location[0], wp.location[1]] as Coordinate,
                  );
                  useRoutingStore.getState().updateWaypoints(snappedWaypoints);
                  updateWaypointsLayer(mapRef.current, snappedWaypoints, isMapLocked);
                }

                Logger.info("[MapModalsProvider] Route loaded successfully");
              }
            }
          } catch (routeError) {
            Logger.warn(
              "[MapModalsProvider] Route calculation failed, showing waypoints only:",
              routeError,
            );
            // Even if route calculation fails, we still have the waypoints
            setHasRoute(false);
            setRouteDistance("");
            setRouteDuration("");
          }
        } else {
          // Just waypoints, no route calculation needed
          setHasRoute(waypoints.length >= 2);
          setRouteDistance("");
          setRouteDuration("");
        }

        Logger.info("[MapModalsProvider] Route loaded onto map");
      } catch (error) {
        Logger.error("[MapModalsProvider] Failed to load route:", error);
      }
    },
    [mapRef, mapboxToken, setRouteDistance, setRouteDuration, setHasRoute],
  );

  const contextValue: MapModalsContextType = {
    // Route Generator Modal
    isRouteGeneratorModalOpen,
    isGeneratingRoute,
    openRouteGeneratorModal,
    closeRouteGeneratorModal,

    // Save Route Modal
    isSaveRouteModalOpen,
    openSaveRouteModal,
    closeSaveRouteModal,

    // Route Library Modal
    isRouteLibraryModalOpen,
    openRouteLibraryModal,
    closeRouteLibraryModal,

    // Login Modal
    isLoginModalOpen,
    openLoginModal,
    closeLoginModal,

    // Actions
    handleGenerateCustomRoute,
    handleLoadRoute,
    handleLoginSuccess,
  };

  return (
    <MapModalsContext.Provider value={contextValue}>
      {children}

      {/* Route Generator Modal */}
      <RouteGeneratorModal
        isOpen={isRouteGeneratorModalOpen}
        onClose={closeRouteGeneratorModal}
        onGenerate={handleGenerateCustomRoute}
        mapboxToken={mapboxToken}
        isGenerating={isGeneratingRoute}
        userLocation={userLocation}
        isUserLocationLoading={isUserLocationLoading}
        userLocationError={userLocationError?.message || null}
        currentLanguage={currentLanguage}
      />

      {/* Save Route Modal */}
      <SaveRouteModal
        isOpen={isSaveRouteModalOpen}
        onClose={closeSaveRouteModal}
        currentLanguage={currentLanguage}
      />

      {/* Route Library Modal */}
      <RouteLibraryModal
        isOpen={isRouteLibraryModalOpen}
        onClose={closeRouteLibraryModal}
        onLoadRoute={handleLoadRoute}
        currentLanguage={currentLanguage}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onLoginSuccess={handleLoginSuccess}
        onOpenChange={(open) => !open && setIsLoginModalOpen(false)}
        currentLanguage={currentLanguage}
      />
    </MapModalsContext.Provider>
  );
};
