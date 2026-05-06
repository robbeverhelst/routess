import { useEffect } from "react";
import { useLocalStorageInit } from "@/components/hooks/useLocalStorageInit";
import { useMapWithRoutingState } from "@/components/hooks/useMapWithRoutingState";
import { MapCanvas } from "@/components/map/MapCanvas";
import { MapShortcutBindings } from "@/components/map/MapShortcutBindings";
import { MapConfigurationProvider } from "@/components/providers/MapConfigurationProvider";
import { MapInteractionProvider } from "@/components/providers/MapInteractionProvider";
import { UserLocationProvider, useUserLocation } from "@/components/providers/UserLocationProvider";
import type { PopupInfo as MapPopupInfo } from "@/features/routing/managers/MapInteractionManager";
import {
	exportCurrentRouteToGPXFile,
	importRouteFromGPXString,
	loadRouteIntoMap,
} from "@/features/routing/services/RouteIOService";
import { ErrorBoundary } from "@/lib/errors";
import type { SupportedLanguage } from "@/lib/i18n";
import { Logger } from "@/lib/logger";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "__VITE_MAPBOX_ACCESS_TOKEN__";
const HAS_INVALID_MAPBOX_TOKEN =
	!MAPBOX_TOKEN ||
	MAPBOX_TOKEN.includes("__VITE_") ||
	MAPBOX_TOKEN === "your-mapbox-access-token-here" ||
	MAPBOX_TOKEN.length < 10;

if (import.meta.env.DEV && HAS_INVALID_MAPBOX_TOKEN) {
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
	width?: string | number;
	height?: string | number;
	initialCenter?: [number, number];
	initialZoom?: number;
	routeId?: string;
	mapTheme?: "light" | "dark";
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
	mapTheme?: "light" | "dark";
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
	onImportError: (message: string) => void;
}

const MapWithRoutingContent: React.FC<MapboxMapProps> = ({
	width = "100%",
	height = "100%",
	initialCenter,
	initialZoom,
	routeId,
	mapTheme,
}) => {
	const { detectedRouteInLocalStorageOnInit, lastKnownLocationFromStorage, lastSavedMapView } = useLocalStorageInit();
	const {
		mapRef,
		popup,
		setPopup,
		currentLanguage,
		waypointError: _waypointError,
		handleWaypointError,
		hasRoute,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
		handleRouteInfoError,
		handleUndo,
		handleRedo,
		handleReverseRoute,
		handleRecalculateRoute,
		handleReset,
		handleAddDirectWaypoint,
		handleRemoveWaypoint,
		handleAddWaypointOnRoute,
		handleZoomToRoute,
		handleCopyShareLinkToClipboard,
		handleImportError,
		isOnline,
	} = useMapWithRoutingState({
		mapboxToken: MAPBOX_TOKEN,
	});

	useEffect(() => {
		const onUndo = () => {
			void handleUndo();
		};
		const onRedo = () => {
			void handleRedo();
		};
		const onResetRoute = () => {
			void handleReset();
		};
		const onFocusRoute = () => {
			handleZoomToRoute();
		};
		const onFlyTo = (event: Event) => {
			const detail = (event as CustomEvent<{ coordinates?: [number, number]; zoom?: number }>).detail;
			if (!detail?.coordinates || !mapRef.current) return;
			mapRef.current.flyTo({
				center: detail.coordinates,
				zoom: detail.zoom ?? 14,
				essential: true,
			});
		};
		const onLoadRoute = (event: Event) => {
			const detail = (
				event as CustomEvent<{
					waypoints?: Array<{ lat: number; lng: number; type: "routed" | "direct"; name?: string }>;
					geometry?: [number, number][];
				}>
			).detail;
			if (!detail?.waypoints || detail.waypoints.length === 0) {
				Logger.warn("[MapWithRouting] routess:load-route received with no waypoints");
				return;
			}
			if (!mapRef.current) {
				Logger.warn("[MapWithRouting] routess:load-route received before map ready");
				return;
			}
			const waypoints = detail.waypoints.map((wp) => ({
				coord: [wp.lng, wp.lat] as [number, number],
				type: (wp.type === "direct" ? "direct" : "routed") as "direct" | "routed",
				...(wp.name ? { name: wp.name } : {}),
			}));
			void loadRouteIntoMap({
				map: mapRef.current,
				accessToken: MAPBOX_TOKEN,
				waypoints,
				exactRoutePath: detail.geometry && detail.geometry.length >= 2 ? detail.geometry : undefined,
				setRouteDistance,
				setRouteDuration,
				setHasRoute,
				saveSnapshot: true,
			}).then((result) => {
				if (!result.success) {
					Logger.warn("[MapWithRouting] load-route failed:", result.message);
				}
			});
		};
		const onShareRoute = () => {
			handleCopyShareLinkToClipboard();
		};
		const onExportGpx = () => {
			const result = exportCurrentRouteToGPXFile();
			if (!result.success) {
				handleRouteInfoError(result.message ?? "Failed to export GPX.");
			}
		};
		const onReroute = () => {
			void handleReverseRoute();
		};
		const onRecalculate = () => {
			void handleRecalculateRoute();
		};
		const onImportGpx = (event: Event) => {
			const detail = (event as CustomEvent<{ gpxString?: string; fileName?: string }>).detail;
			if (!detail?.gpxString) {
				handleRouteInfoError("No file content received for import.");
				return;
			}
			if (!mapRef.current) {
				handleRouteInfoError("Map is not ready yet, try again in a moment.");
				return;
			}
			void importRouteFromGPXString({
				map: mapRef.current,
				accessToken: MAPBOX_TOKEN,
				gpxString: detail.gpxString,
				setRouteDistance,
				setRouteDuration,
				setHasRoute,
			}).then((result) => {
				if (!result.success) {
					handleImportError(result.message ?? "Failed to import GPX file.");
				}
			});
		};

		window.addEventListener("routess:undo", onUndo);
		window.addEventListener("routess:redo", onRedo);
		window.addEventListener("routess:reset-route", onResetRoute);
		window.addEventListener("routess:focus-route", onFocusRoute);
		window.addEventListener("routess:fly-to", onFlyTo);
		window.addEventListener("routess:load-route", onLoadRoute);
		window.addEventListener("routess:share-route", onShareRoute);
		window.addEventListener("routess:export-gpx", onExportGpx);
		window.addEventListener("routess:import-gpx", onImportGpx);
		window.addEventListener("routess:reroute", onReroute);
		window.addEventListener("routess:recalculate-route", onRecalculate);
		return () => {
			window.removeEventListener("routess:undo", onUndo);
			window.removeEventListener("routess:redo", onRedo);
			window.removeEventListener("routess:reset-route", onResetRoute);
			window.removeEventListener("routess:focus-route", onFocusRoute);
			window.removeEventListener("routess:fly-to", onFlyTo);
			window.removeEventListener("routess:load-route", onLoadRoute);
			window.removeEventListener("routess:share-route", onShareRoute);
			window.removeEventListener("routess:export-gpx", onExportGpx);
			window.removeEventListener("routess:import-gpx", onImportGpx);
			window.removeEventListener("routess:reroute", onReroute);
			window.removeEventListener("routess:recalculate-route", onRecalculate);
		};
	}, [
		handleRedo,
		handleReset,
		handleUndo,
		handleZoomToRoute,
		handleCopyShareLinkToClipboard,
		handleRouteInfoError,
		handleImportError,
		handleReverseRoute,
		handleRecalculateRoute,
		setRouteDistance,
		setRouteDuration,
		setHasRoute,
		mapRef,
	]);

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
				mapTheme={mapTheme}
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
				handleRouteInfoError={handleRouteInfoError}
				lastKnownLocationFromStorage={lastKnownLocationFromStorage}
				detectedRouteInLocalStorageOnInit={detectedRouteInLocalStorageOnInit}
				lastSavedMapView={lastSavedMapView}
				onImportError={handleImportError}
			/>
		</UserLocationProvider>
	);
};

const MapConfigurationContent: React.FC<MapConfigurationContentProps> = (props) => {
	const { location: userLocation, handleLocateButtonClick } = useUserLocation();

	useEffect(() => {
		const onLocate = () => {
			void handleLocateButtonClick();
		};
		window.addEventListener("routess:locate", onLocate);
		return () => window.removeEventListener("routess:locate", onLocate);
	}, [handleLocateButtonClick]);

	return (
		<>
			<MapShortcutBindings
				mapRef={props.mapRef}
				mapboxToken={MAPBOX_TOKEN}
				setRouteDistance={props.setRouteDistance}
				setRouteDuration={props.setRouteDuration}
				setHasRoute={props.setHasRoute}
				onImportError={props.onImportError}
			/>
			<MapConfigurationProvider
				mapRef={props.mapRef}
				userLocation={userLocation}
				hasRoute={props.hasRoute}
				isOnline={props.isOnline}
				initialBearing={props.initialBearing}
			>
				<div className="w-full h-full relative">
					<MapCanvas
						mapRef={props.mapRef}
						mapboxToken={MAPBOX_TOKEN}
						width={props.width}
						height={props.height}
						initialCenter={props.initialCenter}
						initialZoom={props.initialZoom}
						routeId={props.routeId}
						mapTheme={props.mapTheme}
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
				</div>
			</MapConfigurationProvider>
		</>
	);
};

export default function MapWithRouting({
	width = "100%",
	height = "100%",
	initialCenter,
	initialZoom,
	routeId,
	mapTheme,
}: MapboxMapProps) {
	return (
		<ErrorBoundary context="map-with-routing">
			<MapInteractionProvider>
				<MapWithRoutingContent
					width={width}
					height={height}
					initialCenter={initialCenter}
					initialZoom={initialZoom}
					routeId={routeId}
					mapTheme={mapTheme}
				/>
			</MapInteractionProvider>
		</ErrorBoundary>
	);
}
