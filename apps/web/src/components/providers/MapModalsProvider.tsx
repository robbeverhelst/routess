import React, { createContext, Suspense, useCallback, useContext, useState } from "react";
import type { RouteGenerationParams } from "@/components/modals/RouteGeneratorModal";

// Lazy load modals to reduce bundle size
const RouteGeneratorModal = React.lazy(() =>
	import("@/components/modals/RouteGeneratorModal").then((module) => ({
		default: module.RouteGeneratorModal,
	})),
);
const SaveRouteModal = React.lazy(() =>
	import("@/components/modals/SaveRouteModal").then((module) => ({
		default: module.SaveRouteModal,
	})),
);
const RouteLibraryModal = React.lazy(() =>
	import("@/components/modals/RouteLibraryModal").then((module) => ({
		default: module.RouteLibraryModal,
	})),
);
const LoginModal = React.lazy(() =>
	import("@/components/auth/LoginModal").then((module) => ({
		default: module.LoginModal,
	})),
);

import type { Map as MapboxMap } from "mapbox-gl";
import { loadApiRouteIntoMap } from "@/features/routing/services/RouteIOService";
import { useIsAuthenticated } from "@/hooks/useAuthState";
import type { ApiRoute } from "@/lib/api";
import type { SupportedLanguage } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { useRoutingStore } from "@/stores/routingStore";

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
	// Use reactive auth state
	const isAuthenticated = useIsAuthenticated();
	// Modal states
	const [isRouteGeneratorModalOpen, setIsRouteGeneratorModalOpen] = useState(false);
	const [isGeneratingRoute] = useState(false); // Always false since feature is disabled
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
		if (isAuthenticated) {
			setIsSaveRouteModalOpen(true);
		} else {
			setIsLoginModalOpen(true);
		}
	}, [isAuthenticated]);

	const closeSaveRouteModal = useCallback(() => {
		setIsSaveRouteModalOpen(false);
	}, []);

	// Route Library Modal handlers
	const openRouteLibraryModal = useCallback(() => {
		if (isAuthenticated) {
			setIsRouteLibraryModalOpen(true);
		} else {
			setIsLoginModalOpen(true);
		}
	}, [isAuthenticated]);

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
		// The new API client automatically manages token state
		// After successful login, open the save route modal
		setIsSaveRouteModalOpen(true);
	}, []);

	// Custom route generation handler (coming soon)
	const handleGenerateCustomRoute = useCallback(async (params: RouteGenerationParams) => {
		Logger.info("Route generation coming soon:", params);
		// Feature coming soon - will be implemented in backend
	}, []);

	// Route loading handler
	const handleLoadRoute = useCallback(
		async (route: ApiRoute) => {
			Logger.info(`[MapModalsProvider] Loading route: ${route.name} with ${route.waypoints.length} waypoints`);

			if (!mapRef.current) {
				Logger.error("[MapModalsProvider] Map not ready for route loading");
				return;
			}

			try {
				setIsRouteLibraryModalOpen(false);
				const result = await loadApiRouteIntoMap(route, {
					map: mapRef.current,
					accessToken: mapboxToken,
					setRouteDistance,
					setRouteDuration,
					setHasRoute,
					isMapLocked,
				});

				if (!result.success) {
					Logger.warn("[MapModalsProvider] Route loading failed:", result.message);
				}
			} catch (error) {
				Logger.error("[MapModalsProvider] Failed to load route:", error);
			}
		},
		[mapRef, mapboxToken, setRouteDistance, setRouteDuration, setHasRoute, isMapLocked],
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
			{isRouteGeneratorModalOpen && (
				<Suspense fallback={<div className="flex items-center justify-center p-4">Loading...</div>}>
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
				</Suspense>
			)}

			{/* Save Route Modal */}
			{isSaveRouteModalOpen && (
				<Suspense fallback={<div className="flex items-center justify-center p-4">Loading...</div>}>
					<SaveRouteModal
						isOpen={isSaveRouteModalOpen}
						onClose={closeSaveRouteModal}
						currentLanguage={currentLanguage}
					/>
				</Suspense>
			)}

			{/* Route Library Modal */}
			{isRouteLibraryModalOpen && (
				<Suspense fallback={<div className="flex items-center justify-center p-4">Loading...</div>}>
					<RouteLibraryModal
						isOpen={isRouteLibraryModalOpen}
						onClose={closeRouteLibraryModal}
						onLoadRoute={handleLoadRoute}
						currentLanguage={currentLanguage}
					/>
				</Suspense>
			)}

			{/* Login Modal */}
			{isLoginModalOpen && (
				<Suspense fallback={<div className="flex items-center justify-center p-4">Loading...</div>}>
					<LoginModal
						isOpen={isLoginModalOpen}
						onLoginSuccess={handleLoginSuccess}
						onOpenChange={(open) => !open && setIsLoginModalOpen(false)}
						currentLanguage={currentLanguage}
					/>
				</Suspense>
			)}
		</MapModalsContext.Provider>
	);
};
