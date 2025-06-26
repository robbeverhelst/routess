import { useEffect, useRef, useState } from "react";
import { teardownRouting } from "@/lib/routing";
import type { PopupInfo as MapPopupInfo } from "@/features/routing/managers/MapInteractionManager";
import { useRouteData } from "@/hooks/useRouteData";
import { useUndoRedoState } from "@/hooks/useUndoRedoState";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { Logger } from "@/lib/logger";
import type { SupportedLanguage } from "@/lib/i18n";
import {
  loadLanguageFromLocalStorage,
  saveLanguageToLocalStorage,
} from "@/features/routing/services/LocalStorageService";
import { useRouteActions } from "@/components/hooks/useRouteActions";
import { useWaypointError } from "@/components/hooks/useWaypointError";
import { useLocalStorageInit } from "@/components/hooks/useLocalStorageInit";
import { useMapViewPersistence } from "@/components/hooks/useMapViewPersistence";

// Import our new organized components and providers
import { MapModalsProvider } from "@/components/providers/MapModalsProvider";
import { UserLocationProvider, useUserLocation } from "@/components/providers/UserLocationProvider";
import { MapConfigurationProvider } from "@/components/providers/MapConfigurationProvider";
import {
  MapInteractionProvider,
  useMapInteraction,
} from "@/components/providers/MapInteractionProvider";
import { MapCanvas } from "@/components/map/MapCanvas";
import { MapControls } from "@/components/map/MapControls";
import { MapNotifications } from "@/components/map/MapNotifications";

// Get Mapbox access token from environment variables
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "__VITE_MAPBOX_ACCESS_TOKEN__";

if (import.meta.env.DEV && (!MAPBOX_TOKEN || MAPBOX_TOKEN.length < 10)) {
  Logger.error(
    `[MapWithRouting] Mapbox token issue: 
    Raw import.meta.env.VITE_MAPBOX_ACCESS_TOKEN: '${import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "__VITE_MAPBOX_ACCESS_TOKEN__"}', 
    Assigned MAPBOX_TOKEN value: '${MAPBOX_TOKEN}', 
    Type of MAPBOX_TOKEN: '${typeof MAPBOX_TOKEN}'. 
    Please verify VITE_MAPBOX_ACCESS_TOKEN in your .env file or CI secrets.`,
  );
} else if (import.meta.env.DEV) {
  Logger.info(
    `[MapWithRouting] Mapbox token loaded. 
    Type: ${typeof MAPBOX_TOKEN}, 
    Value length: ${MAPBOX_TOKEN?.length ?? 0} (token partially redacted)`,
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
  // New router-based props
  initialCenter?: [number, number];
  initialZoom?: number;
  routeId?: string;
}

interface MapConfigurationContentProps {
  mapRef: React.RefObject<mapboxgl.Map | null>;
  hasRoute: boolean;
  isOnline: boolean;
  initialBearing: number;
  width: string | number;
  height: string | number;
  initialCenter?: [number, number];
  initialZoom?: number;
  routeId?: string;
  currentLanguage: SupportedLanguage;
  setRouteDistance: React.Dispatch<React.SetStateAction<string>>;
  setRouteDuration: React.Dispatch<React.SetStateAction<string>>;
  setHasRoute: React.Dispatch<React.SetStateAction<boolean>>;
  popup: MapPopupInfo | null;
  setPopup: React.Dispatch<React.SetStateAction<MapPopupInfo | null>>;
  onAddDirectWaypoint: () => void;
  onRemoveWaypoint: () => void;
  onAddWaypointOnRoute: () => Promise<void>;
  handleWaypointError: (message: string | null) => void;
  handleRouteInfoError: (message: string) => void;
  lastKnownLocationFromStorage: [number, number] | null;
  detectedRouteInLocalStorageOnInit: boolean;
  lastSavedMapView: unknown;
  routeDistance: string;
  routeDuration: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReverseRoute: () => Promise<void>;
  onReset: () => void;
  onZoomToRoute: () => void;
  onShare: () => void;
  displayedShareUrl: string | null;
  onCopySharedUrl: (urlToCopy: string) => void;
  onClearShareDisplay: () => void;
  onCopyShareLink: () => void;
  onSelectLocation: (location: { lng: number; lat: number; name: string }) => void;
  onImportError: (message: string) => void;
  shareNotification: string;
  showRouteInfoError: boolean;
  routeInfoErrorMessage: string;
  waypointError: string | null;
  onLanguageChange: (language: SupportedLanguage) => void;
}

// Internal component that uses all providers
const MapWithRoutingContent: React.FC<MapboxMapProps> = ({
  width = "100%",
  height = "100%",
  initialCenter,
  initialZoom,
  routeId,
}) => {
  const mapRef = useRef<mapboxgl.Map | null>(null);

  // State management
  const [popup, setPopup] = useState<MapPopupInfo | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(
    loadLanguageFromLocalStorage(),
  );

  // Initialize localStorage data
  const { detectedRouteInLocalStorageOnInit, lastKnownLocationFromStorage, lastSavedMapView } =
    useLocalStorageInit();

  // Custom hooks
  const { waypointError, handleWaypointError } = useWaypointError();

  // Route data hook
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
    setShareNotification,
  } = useRouteData();

  // Undo/redo state
  const { canUndo, canRedo } = useUndoRedoState();

  // Service worker state
  const { isOnline } = useServiceWorker();

  // Map interaction provider
  const { handleKeyboardShortcuts, handlePWAShortcuts } = useMapInteraction();

  // Effects for language management
  useEffect(() => {
    saveLanguageToLocalStorage(currentLanguage);
  }, [currentLanguage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Logger.info("[MapWithRouting] Tearing down routing module subscriptions and refs.");
      teardownRouting();
    };
  }, []);

  // Use route actions hook
  const {
    handleUndo,
    handleRedo,
    handleReverseRoute,
    handleReset,
    handleSelectLocation,
    handleAddDirectWaypoint,
    handleRemoveWaypoint,
    handleAddWaypointOnRoute,
    handleZoomToRoute,
    handleCopyShareLinkToClipboard,
    handleImportError,
  } = useRouteActions({
    mapRef,
    mapboxToken: MAPBOX_TOKEN,
    hasRoute,
    popup,
    setPopup,
    setRouteDistance,
    setRouteDuration,
    setHasRoute,
    handleWaypointError,
    handleRouteInfoError: handleRouteInfoErrorFromHook,
    clearShareState,
    setShareNotification,
  });

  // Use map view persistence
  useMapViewPersistence(mapRef);

  // Setup keyboard shortcuts
  useEffect(() => {
    const cleanup = handleKeyboardShortcuts(canUndo, canRedo, handleUndo, handleRedo);
    return cleanup;
  }, [canUndo, canRedo, handleUndo, handleRedo, handleKeyboardShortcuts]);

  // Setup PWA shortcuts
  useEffect(() => {
    const cleanup = handlePWAShortcuts(
      () => {}, // openRouteGeneratorModal - would come from provider
      () => {}, // handleLocate - would come from provider
      () => {
        const fileInput = document.querySelector(
          'input[type="file"][accept=".gpx"]',
        ) as HTMLInputElement;
        if (fileInput) {
          fileInput.click();
        }
      },
    );
    return cleanup;
  }, [handlePWAShortcuts]);

  return (
    <UserLocationProvider mapRef={mapRef} hasRoute={hasRoute} isMapReady={mapRef.current !== null}>
      <MapConfigurationContent
        mapRef={mapRef}
        hasRoute={hasRoute}
        isOnline={isOnline}
        initialBearing={0}
        width={width}
        height={height}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        routeId={routeId}
        currentLanguage={currentLanguage}
        setRouteDistance={setRouteDistance}
        setRouteDuration={setRouteDuration}
        setHasRoute={setHasRoute}
        popup={popup}
        setPopup={setPopup}
        onAddDirectWaypoint={handleAddDirectWaypoint}
        onRemoveWaypoint={handleRemoveWaypoint}
        onAddWaypointOnRoute={handleAddWaypointOnRoute}
        handleWaypointError={handleWaypointError}
        handleRouteInfoError={handleRouteInfoErrorFromHook}
        lastKnownLocationFromStorage={lastKnownLocationFromStorage}
        detectedRouteInLocalStorageOnInit={detectedRouteInLocalStorageOnInit}
        lastSavedMapView={lastSavedMapView}
        routeDistance={routeDistance}
        routeDuration={routeDuration}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onReverseRoute={handleReverseRoute}
        onReset={handleReset}
        onZoomToRoute={handleZoomToRoute}
        onShare={handleShareRoute}
        displayedShareUrl={displayedShareUrl}
        onCopySharedUrl={handleCopySharedUrlFromHook}
        onClearShareDisplay={clearShareState}
        onCopyShareLink={handleCopyShareLinkToClipboard}
        onSelectLocation={handleSelectLocation}
        onImportError={handleImportError}
        shareNotification={shareNotification}
        showRouteInfoError={showRouteInfoError}
        routeInfoErrorMessage={routeInfoErrorMessage}
        waypointError={waypointError}
        onLanguageChange={setCurrentLanguage}
      />
    </UserLocationProvider>
  );
};

// Component that consumes UserLocationProvider and wraps with MapConfigurationProvider
const MapConfigurationContent: React.FC<MapConfigurationContentProps> = (props) => {
  const {
    location: userLocation,
    isLoading: isUserLocationLoading,
    error: userLocationError,
  } = useUserLocation();

  return (
    <MapModalsProvider
      mapboxToken={MAPBOX_TOKEN}
      currentLanguage={props.currentLanguage}
      userLocation={userLocation}
      isUserLocationLoading={isUserLocationLoading}
      userLocationError={userLocationError as Error | null}
      mapRef={props.mapRef}
      setRouteDistance={props.setRouteDistance}
      setRouteDuration={props.setRouteDuration}
      setHasRoute={props.setHasRoute}
    >
      <MapConfigurationProvider
        mapRef={props.mapRef}
        userLocation={userLocation}
        hasRoute={props.hasRoute}
        isOnline={props.isOnline}
        initialBearing={props.initialBearing}
      >
        <div className={`w-full h-full relative`}>
          <MapCanvas
            mapRef={props.mapRef}
            mapboxToken={MAPBOX_TOKEN}
            width={props.width}
            height={props.height}
            initialCenter={props.initialCenter}
            initialZoom={props.initialZoom}
            routeId={props.routeId}
            currentLanguage={props.currentLanguage}
            setRouteDistance={props.setRouteDistance}
            setRouteDuration={props.setRouteDuration}
            setHasRoute={props.setHasRoute}
            hasRoute={props.hasRoute}
            popup={props.popup}
            setPopup={props.setPopup}
            onAddDirectWaypoint={props.onAddDirectWaypoint}
            onRemoveWaypoint={props.onRemoveWaypoint}
            onAddWaypointOnRoute={props.onAddWaypointOnRoute}
            handleWaypointError={props.handleWaypointError}
            handleRouteInfoError={props.handleRouteInfoError}
            lastKnownLocationFromStorage={props.lastKnownLocationFromStorage}
            detectedRouteInLocalStorageOnInit={props.detectedRouteInLocalStorageOnInit}
            lastSavedMapView={props.lastSavedMapView}
          />

          <MapControls
            mapRef={props.mapRef}
            mapboxToken={MAPBOX_TOKEN}
            currentLanguage={props.currentLanguage}
            onLanguageChange={props.onLanguageChange}
            hasRoute={props.hasRoute}
            routeDistance={props.routeDistance}
            routeDuration={props.routeDuration}
            setRouteDistance={props.setRouteDistance}
            setRouteDuration={props.setRouteDuration}
            setHasRoute={props.setHasRoute}
            onUndo={props.onUndo}
            onRedo={props.onRedo}
            onReverseRoute={props.onReverseRoute}
            onReset={props.onReset}
            onZoomToRoute={props.onZoomToRoute}
            canUndo={props.canUndo}
            canRedo={props.canRedo}
            onShare={props.onShare}
            displayedShareUrl={props.displayedShareUrl}
            onCopySharedUrl={props.onCopySharedUrl}
            onClearShareDisplay={props.onClearShareDisplay}
            onCopyShareLink={props.onCopyShareLink}
            onSelectLocation={props.onSelectLocation}
            onImportError={props.onImportError}
            isOnline={props.isOnline}
          />

          <MapNotifications
            hasRoute={props.hasRoute}
            routeDistance={props.routeDistance}
            shareNotification={props.shareNotification}
            showRouteInfoError={props.showRouteInfoError}
            routeInfoErrorMessage={props.routeInfoErrorMessage}
            waypointError={props.waypointError}
          />
        </div>
      </MapConfigurationProvider>
    </MapModalsProvider>
  );
};

// Main component with all providers
export default function MapWithRouting({
  width = "100%",
  height = "100%",
  initialCenter,
  initialZoom,
  routeId,
}: MapboxMapProps) {
  return (
    <MapInteractionProvider>
      <MapWithRoutingContent
        width={width}
        height={height}
        initialCenter={initialCenter}
        initialZoom={initialZoom}
        routeId={routeId}
      />
    </MapInteractionProvider>
  );
}
