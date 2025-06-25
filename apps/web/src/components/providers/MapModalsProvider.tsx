import React, { createContext, useContext, useState, useCallback } from "react";
import type { RouteGenerationParams } from "@/components/modals/RouteGeneratorModal";
import { RouteGeneratorModal } from "@/components/modals/RouteGeneratorModal";
import { SaveRouteModal } from "@/components/modals/SaveRouteModal";
import { RouteLibraryModal } from "@/components/modals/RouteLibraryModal";
import { LoginModal } from "@/components/auth/LoginModal";
// import { getWaypoints, getDirectFlags } from "@/features/routing/managers/WaypointManager"; // Kept for future use
import { googleAuth } from "@/lib/google-auth";
import { apiService, type ApiRoute } from "@/lib/api";
import { getWaypoints } from "@/features/routing/managers/WaypointManager";
import type { SupportedLanguage } from "@/lib/i18n";
import { setRouteData } from "@/lib/routing";
import type { Coordinate } from "@/types/map";
import type { Map as MapboxMap } from "mapbox-gl";
import { Logger } from "@/lib/logger";

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
  setIsRouteCoordsReady: React.Dispatch<React.SetStateAction<boolean>>;
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
  setIsRouteCoordsReady,
}) => {
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
        // Convert API waypoints to internal format
        const waypoints: Coordinate[] = route.waypoints.map((wp) => [wp.lng, wp.lat]);
        const directFlags: boolean[] = route.waypoints.map((wp) => wp.type === "direct");

        // Load the route data into the map
        await setRouteData(
          mapRef.current,
          mapboxToken,
          waypoints,
          directFlags,
          setRouteDistance,
          setRouteDuration,
          setHasRoute,
          setIsRouteCoordsReady,
        );

        setIsRouteLibraryModalOpen(false);
        Logger.info(`[MapModalsProvider] Route "${route.name}" loaded successfully`);
      } catch (error) {
        Logger.error("[MapModalsProvider] Failed to load route:", error);
      }
    },
    [mapRef, mapboxToken, setRouteDistance, setRouteDuration, setHasRoute, setIsRouteCoordsReady],
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
        waypoints={getWaypoints()}
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
