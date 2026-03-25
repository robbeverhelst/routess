import type { Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import React, { useCallback, useState } from "react";
import { useMapConfiguration } from "@/components/providers/MapConfigurationProvider";
import { useMapModals } from "@/components/providers/MapModalsProvider";
import { useUserLocation } from "@/components/providers/UserLocationProvider";
import { LocationSearch } from "@/components/ui/location-search";
import { RouteControls } from "@/components/ui/route-controls";
import { Sidebar } from "@/components/ui/sidebar";
import type { SupportedLanguage } from "@/lib/i18n";

interface MapControlsProps {
	// Map instance
	mapRef: React.RefObject<MapboxMap | null>;
	mapboxToken: string;

	// Language
	currentLanguage: SupportedLanguage;
	onLanguageChange: (lang: SupportedLanguage) => void;

	// Route state
	hasRoute: boolean;
	routeDistance?: string;
	routeDuration?: string;
	setRouteDistance: Dispatch<SetStateAction<string>>;
	setRouteDuration: Dispatch<SetStateAction<string>>;
	setHasRoute: Dispatch<SetStateAction<boolean>>;

	// Route actions
	onUndo: () => void;
	onRedo: () => void;
	onReverseRoute: () => void;
	onReset: () => void;
	onZoomToRoute: () => void;
	canUndo: boolean;
	canRedo: boolean;

	// Share functionality
	onShare: () => void;
	displayedShareUrl: string | null;
	onCopySharedUrl: (url: string) => void;
	onClearShareDisplay: () => void;
	onCopyShareLink: () => void;

	// Location selection
	onSelectLocation: (location: { lng: number; lat: number; name: string }) => void;

	// Import/Export
	onImportError: (message: string) => void;

	// Online status
	isOnline: boolean;
}

const MapControlsComponent: React.FC<MapControlsProps> = ({
	mapRef,
	mapboxToken,
	currentLanguage,
	onLanguageChange,
	hasRoute,
	routeDistance,
	routeDuration,
	setRouteDistance,
	setRouteDuration,
	setHasRoute,
	onUndo,
	onRedo,
	onReverseRoute,
	onReset,
	onZoomToRoute,
	canUndo,
	canRedo,
	onShare,
	displayedShareUrl,
	onCopySharedUrl,
	onClearShareDisplay,
	onCopyShareLink,
	onSelectLocation,
	onImportError,
	isOnline,
}) => {
	const [isSearchOpen, setIsSearchOpen] = useState(false);

	// Get configuration and modals from providers
	const {
		currentMapStyle,
		isMapLocked,
		currentLightPreset,
		currentBearing,
		showSunDirection,
		onToggleLock,
		onCycleTimeOfDay,
		onCycleBearing,
		onZoomIn,
		onZoomOut,
		onToggleMapStyle,
		onToggleSunDirection,
	} = useMapConfiguration();

	const {
		location: userLocation,
		accuracy: locationAccuracy,
		isTracking: isLocationTracking,
		hasCurrentLocation,
		hasLastKnownLocation,
		handleLocateButtonClick,
	} = useUserLocation();

	const { openRouteGeneratorModal, openSaveRouteModal, openRouteLibraryModal } = useMapModals();

	// Memoize location search handlers to prevent unnecessary re-renders
	const handleToggleSearch = useCallback(() => {
		setIsSearchOpen((prev) => !prev);
	}, []);

	return (
		<>
			{/* Mobile Controls Layout */}
			<div className="absolute top-4 left-0 right-0 z-10 p-4 lg:hidden pointer-events-none">
				<div className="flex justify-between items-start w-full">
					{/* Top-Left: RouteControls (stacked) */}
					<div className="flex flex-col items-start gap-2 pointer-events-auto max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-hide">
						<RouteControls
							onUndo={onUndo}
							onRedo={onRedo}
							onReverseRoute={onReverseRoute}
							onReset={onReset}
							onLocate={handleLocateButtonClick}
							canUndo={canUndo}
							canRedo={canRedo}
							canLocateCurrent={hasCurrentLocation}
							canLocateLastKnown={hasLastKnownLocation}
							hasRoute={hasRoute}
							isLocked={isMapLocked}
							onToggleLock={onToggleLock}
							onCycleTimeOfDay={onCycleTimeOfDay}
							currentTimeOfDay={currentLightPreset}
							onOpenRouteGenerator={openRouteGeneratorModal}
							currentBearing={currentBearing}
							onCycleBearing={onCycleBearing}
							onZoomIn={onZoomIn}
							onZoomOut={onZoomOut}
							onCopyShareLink={onCopyShareLink}
							onZoomToRoute={onZoomToRoute}
							onSaveRoute={openSaveRouteModal}
							currentLanguage={currentLanguage}
							isOffline={!isOnline}
							currentMapStyle={currentMapStyle}
							onToggleMapStyle={onToggleMapStyle}
							isLocationTracking={isLocationTracking}
							locationAccuracy={locationAccuracy}
							userLocation={userLocation}
						/>
					</div>

					{/* Top-Right: Search Icon + Sidebar (Hamburger) + Conditional Search Bar */}
					<div className="flex flex-col items-end gap-2 flex-grow pointer-events-auto">
						<div className="flex items-center justify-end gap-2 w-full">
							<LocationSearch
								mapboxToken={mapboxToken}
								onSelectLocation={onSelectLocation}
								isMobileContext={true}
								isMobileSearchOpen={isSearchOpen}
								onToggleMobileSearch={handleToggleSearch}
								currentLanguage={currentLanguage}
							/>
							<Sidebar
								onUndo={onUndo}
								onRedo={onRedo}
								onReverseRoute={onReverseRoute}
								onReset={onReset}
								onZoomToRoute={onZoomToRoute}
								onShare={onShare}
								displayedShareUrl={displayedShareUrl}
								onCopySharedUrl={onCopySharedUrl}
								onClearShareDisplay={onClearShareDisplay}
								canUndo={canUndo}
								canRedo={canRedo}
								hasRoute={hasRoute}
								routeDistance={routeDistance}
								routeDuration={routeDuration}
								isLocked={isMapLocked}
								onToggleLock={onToggleLock}
								map={mapRef.current}
								accessToken={mapboxToken}
								setRouteDistance={setRouteDistance}
								setRouteDuration={setRouteDuration}
								setHasRoute={setHasRoute}
								onImportError={onImportError}
								onOpenRouteGenerator={openRouteGeneratorModal}
								currentLanguage={currentLanguage}
								onLanguageChange={onLanguageChange}
								showSunDirection={showSunDirection}
								onToggleSunDirection={onToggleSunDirection}
								onOpenRouteLibrary={openRouteLibraryModal}
								onSaveRoute={openSaveRouteModal}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Desktop: RouteControls - Top Center */}
			<div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-10 hidden lg:flex">
				<RouteControls
					onUndo={onUndo}
					onRedo={onRedo}
					onReverseRoute={onReverseRoute}
					onReset={onReset}
					onLocate={handleLocateButtonClick}
					canUndo={canUndo}
					canRedo={canRedo}
					canLocateCurrent={hasCurrentLocation}
					canLocateLastKnown={hasLastKnownLocation}
					hasRoute={hasRoute}
					isLocked={isMapLocked}
					onToggleLock={onToggleLock}
					onCycleTimeOfDay={onCycleTimeOfDay}
					currentTimeOfDay={currentLightPreset}
					onOpenRouteGenerator={openRouteGeneratorModal}
					currentBearing={currentBearing}
					onCycleBearing={onCycleBearing}
					onZoomIn={onZoomIn}
					onZoomOut={onZoomOut}
					onCopyShareLink={onCopyShareLink}
					onZoomToRoute={onZoomToRoute}
					onSaveRoute={openSaveRouteModal}
					currentLanguage={currentLanguage}
					isOffline={!isOnline}
					currentMapStyle={currentMapStyle}
					onToggleMapStyle={onToggleMapStyle}
					isLocationTracking={isLocationTracking}
					locationAccuracy={locationAccuracy}
					userLocation={userLocation}
				/>
			</div>

			{/* Desktop: Search and Sidebar - Top Right */}
			<div className="absolute top-8 right-8 z-10 hidden lg:flex items-center gap-2">
				<LocationSearch
					mapboxToken={mapboxToken}
					onSelectLocation={onSelectLocation}
					currentLanguage={currentLanguage}
				/>
				<Sidebar
					onUndo={onUndo}
					onRedo={onRedo}
					onReverseRoute={onReverseRoute}
					onReset={onReset}
					onZoomToRoute={onZoomToRoute}
					onShare={onShare}
					displayedShareUrl={displayedShareUrl}
					onCopySharedUrl={onCopySharedUrl}
					onClearShareDisplay={onClearShareDisplay}
					canUndo={canUndo}
					canRedo={canRedo}
					hasRoute={hasRoute}
					routeDistance={routeDistance}
					routeDuration={routeDuration}
					isLocked={isMapLocked}
					onToggleLock={onToggleLock}
					map={mapRef.current}
					accessToken={mapboxToken}
					setRouteDistance={setRouteDistance}
					setRouteDuration={setRouteDuration}
					setHasRoute={setHasRoute}
					onImportError={onImportError}
					onOpenRouteGenerator={openRouteGeneratorModal}
					currentLanguage={currentLanguage}
					onLanguageChange={onLanguageChange}
					showSunDirection={showSunDirection}
					onToggleSunDirection={onToggleSunDirection}
					onOpenRouteLibrary={openRouteLibraryModal}
					onSaveRoute={openSaveRouteModal}
				/>
			</div>
		</>
	);
};

// Memoize MapControls to prevent unnecessary re-renders when props haven't changed
export const MapControls = React.memo(MapControlsComponent);
