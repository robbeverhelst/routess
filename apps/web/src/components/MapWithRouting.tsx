import { useEffect } from "react";
import { useLocalStorageInit } from "@/components/hooks/useLocalStorageInit";
import { useMapWithRoutingState } from "@/components/hooks/useMapWithRoutingState";
import { MapCanvas } from "@/components/map/MapCanvas";
import { MapShortcutBindings } from "@/components/map/MapShortcutBindings";
import { MapInteractionProvider } from "@/components/providers/MapInteractionProvider";
import { UserLocationProvider, useUserLocation } from "@/components/providers/UserLocationProvider";
import type { PopupInfo as MapPopupInfo } from "@/features/routing/managers/MapInteractionManager";
import type { RouteDraftEditor } from "@/features/routing/RouteDraftEditor";
import { RouteDraftEditorProvider } from "@/features/routing/RouteDraftEditorProvider";
import { type AppEventMap, onAppEvent } from "@/lib/app-events";
import { ErrorBoundary } from "@/lib/errors";
import type { SupportedLanguage } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { useToastStore } from "@/stores/toastStore";

const MAPBOX_TOKEN = getRuntimeConfig("VITE_MAPBOX_ACCESS_TOKEN") ?? "";
const HAS_INVALID_MAPBOX_TOKEN =
	!MAPBOX_TOKEN ||
	MAPBOX_TOKEN.includes("__VITE_") ||
	MAPBOX_TOKEN === "your-mapbox-access-token-here" ||
	MAPBOX_TOKEN.length < 10;

if (import.meta.env.DEV && HAS_INVALID_MAPBOX_TOKEN) {
	Logger.error(
		`[MapWithRouting] Mapbox token issue:
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
	setEditor: (editor: RouteDraftEditor | null) => void;
	popup: MapPopupInfo | null;
	setPopup: React.Dispatch<React.SetStateAction<MapPopupInfo | null>>;
	onAddDirectWaypoint: () => void;
	onRemoveWaypoint: () => void;
	onAddWaypointOnRoute: () => Promise<void>;
	handleWaypointError: (message: string | null) => void;
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
	const pushToast = useToastStore((s) => s.push);
	const {
		mapRef,
		popup,
		setPopup,
		editor,
		setEditor,
		currentLanguage,
		waypointError: _waypointError,
		handleWaypointError,
		hasRoute,
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
		const onFlyTo = (detail: { coordinates?: [number, number]; zoom?: number }) => {
			if (!detail?.coordinates || !mapRef.current) return;
			mapRef.current.flyTo({
				center: detail.coordinates,
				zoom: detail.zoom ?? 14,
				essential: true,
			});
		};
		const onLoadRoute = (detail: AppEventMap["routess:load-route"]) => {
			if (!detail?.waypoints || detail.waypoints.length === 0) {
				Logger.warn("[MapWithRouting] routess:load-route received with no waypoints");
				return;
			}
			if (!editor) {
				Logger.warn("[MapWithRouting] routess:load-route received before map ready");
				return;
			}
			void editor
				.loadWaypoints(detail.waypoints, {
					exactRoutePath: detail.geometry && detail.geometry.length >= 2 ? detail.geometry : undefined,
					saveSnapshot: true,
				})
				.then((result) => {
					if (!result.success) {
						Logger.warn("[MapWithRouting] load-route failed:", result.message);
					}
				});
		};
		const onShareRoute = () => {
			handleCopyShareLinkToClipboard();
		};
		const onExportGpx = () => {
			if (!editor) {
				pushToast({ kind: "warn", title: "Map is not ready yet, try again in a moment." });
				return;
			}
			const result = editor.exportGpx();
			if (!result.success) {
				pushToast({ kind: "danger", title: result.message ?? "Failed to export GPX." });
			}
		};
		const onReroute = () => {
			void handleReverseRoute();
		};
		const onRecalculate = () => {
			void handleRecalculateRoute();
		};
		const onImportGpx = (detail: { gpxString?: string; fileName?: string }) => {
			if (!detail?.gpxString) {
				pushToast({ kind: "danger", title: "No file content received for import." });
				return;
			}
			if (!editor) {
				pushToast({ kind: "warn", title: "Map is not ready yet, try again in a moment." });
				return;
			}
			void editor.loadFromGpx(detail.gpxString).then((result) => {
				if (!result.success) {
					handleImportError(result.message ?? "Failed to import GPX file.");
				}
			});
		};

		const unsubscribers = [
			onAppEvent("routess:undo", onUndo),
			onAppEvent("routess:redo", onRedo),
			onAppEvent("routess:reset-route", onResetRoute),
			onAppEvent("routess:focus-route", onFocusRoute),
			onAppEvent("routess:fly-to", onFlyTo),
			onAppEvent("routess:load-route", onLoadRoute),
			onAppEvent("routess:share-route", onShareRoute),
			onAppEvent("routess:export-gpx", onExportGpx),
			onAppEvent("routess:import-gpx", onImportGpx),
			onAppEvent("routess:reroute", onReroute),
			onAppEvent("routess:recalculate-route", onRecalculate),
		];
		return () => {
			for (const unsubscribe of unsubscribers) {
				unsubscribe();
			}
		};
	}, [
		editor,
		handleRedo,
		handleReset,
		handleUndo,
		handleZoomToRoute,
		handleCopyShareLinkToClipboard,
		handleImportError,
		handleReverseRoute,
		handleRecalculateRoute,
		mapRef,
		pushToast,
	]);

	return (
		<RouteDraftEditorProvider editor={editor}>
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
					setEditor={setEditor}
					popup={popup}
					setPopup={setPopup}
					onAddDirectWaypoint={handleAddDirectWaypoint}
					onRemoveWaypoint={handleRemoveWaypoint}
					onAddWaypointOnRoute={handleAddWaypointOnRoute}
					handleWaypointError={handleWaypointError}
					lastKnownLocationFromStorage={lastKnownLocationFromStorage}
					detectedRouteInLocalStorageOnInit={detectedRouteInLocalStorageOnInit}
					lastSavedMapView={lastSavedMapView}
					onImportError={handleImportError}
				/>
			</UserLocationProvider>
		</RouteDraftEditorProvider>
	);
};

const MapConfigurationContent: React.FC<MapConfigurationContentProps> = (props) => {
	const { handleLocateButtonClick } = useUserLocation();

	useEffect(() => {
		const onLocate = () => {
			void handleLocateButtonClick();
		};
		return onAppEvent("routess:locate", onLocate);
	}, [handleLocateButtonClick]);

	return (
		<>
			<MapShortcutBindings onImportError={props.onImportError} />
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
					setEditor={props.setEditor}
					hasRoute={props.hasRoute}
					popup={props.popup}
					setPopup={props.setPopup}
					onAddDirectWaypoint={props.onAddDirectWaypoint}
					onRemoveWaypoint={props.onRemoveWaypoint}
					onAddWaypointOnRoute={props.onAddWaypointOnRoute}
					handleWaypointError={props.handleWaypointError}
					lastKnownLocationFromStorage={props.lastKnownLocationFromStorage}
					detectedRouteInLocalStorageOnInit={props.detectedRouteInLocalStorageOnInit}
					lastSavedMapView={props.lastSavedMapView}
				/>
			</div>
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
