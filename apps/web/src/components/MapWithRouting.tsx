import { haversineDistance } from "@routess/core";
import { useEffect } from "react";
import { useLocalStorageInit } from "@/components/hooks/useLocalStorageInit";
import { useMapWithRoutingState } from "@/components/hooks/useMapWithRoutingState";
import { DiscoverMapBindings } from "@/components/map/DiscoverMapBindings";
import { GenerationPreview } from "@/components/map/GenerationPreview";
import { LibraryRoutePreview } from "@/components/map/LibraryRoutePreview";
import { MapCanvas } from "@/components/map/MapCanvas";
import { MapShortcutBindings } from "@/components/map/MapShortcutBindings";
import { PwaLaunchBindings } from "@/components/map/PwaLaunchBindings";
import { MapInteractionProvider } from "@/components/providers/MapInteractionProvider";
import { UserLocationProvider, useUserLocation } from "@/components/providers/UserLocationProvider";
import { startGeneration } from "@/features/generation/generationService";
import { cancelMapPick, requestMapPick } from "@/features/map/mapPick";
import { confirmDiscardIfDirty } from "@/features/routing/confirmDiscardIfDirty";
import type { PopupInfo as MapPopupInfo } from "@/features/routing/managers/MapInteractionManager";
import type { RouteDraftEditor } from "@/features/routing/RouteDraftEditor";
import { RouteDraftEditorProvider } from "@/features/routing/RouteDraftEditorProvider";
import { getCurrentRoutePath } from "@/features/routing/services/RouteCalculationService";
import { zoomToRoute } from "@/features/routing/utils/RoutingUtils";
import { type AppEventMap, onAppEvent } from "@/lib/app-events";
import { ErrorBoundary } from "@/lib/errors";
import { type SupportedLanguage, t } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { GenerationOverlay } from "@/overlays/GenerationOverlay";
import { useLoopPreferencesStore } from "@/stores/loopPreferencesStore";
import { useModalsStore } from "@/stores/modalsStore";
import { useRoutingStore } from "@/stores/routingStore";
import { useToastStore } from "@/stores/toastStore";

const MAPBOX_TOKEN = getRuntimeConfig("VITE_MAPBOX_ACCESS_TOKEN") ?? "";
const HAS_INVALID_MAPBOX_TOKEN =
	!MAPBOX_TOKEN ||
	MAPBOX_TOKEN.includes("__VITE_") ||
	MAPBOX_TOKEN === "your-mapbox-access-token-here" ||
	MAPBOX_TOKEN.length < 10;

// Beyond this the camera jumps instead of flying. See onFlyTo.
const FLY_TO_MAX_DISTANCE_KM = 200;
// A far jump lands this far out and eases in, so arrival still reads as camera
// movement. Measured at ~188 tile requests against ~105 for a bare jump and
// ~969 for the full flight; going deeper or slower costs sharply more.
const ARRIVAL_SWOOP_ZOOM_OFFSET = 2;
const ARRIVAL_SWOOP_DURATION_MS = 900;

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

	// Self-heal a rehydrated draft whose RoutePath is missing (a quota-trimmed
	// persisted snapshot keeps waypoints and metrics but sheds the path):
	// recompute from the intact waypoints instead of showing markers with no
	// route line. Idempotent: once the path exists the condition never holds.
	useEffect(() => {
		if (!editor) return;
		const state = useRoutingStore.getState();
		if (state.hasRoute && state.waypoints.length >= 2 && state.routePath.length < 2) {
			Logger.info("[MapWithRouting] Rehydrated draft has waypoints but no RoutePath; recomputing.");
			void editor.recalculate();
		}
	}, [editor]);

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
			const map = mapRef.current;
			const center = map.getCenter();
			const distanceKm = haversineDistance([center.lng, center.lat], detail.coordinates);
			const target = { center: detail.coordinates, zoom: detail.zoom ?? 14 };

			// flyTo arcs out to an apex that fits both endpoints and loads tiles for the
			// whole corridor at every zoom on the way. Past a point that is thousands of
			// tiles thrown away on arrival, so land at the target first and animate only
			// the last couple of zoom levels. Not `essential`, so reduced-motion users
			// get the plain jump.
			if (distanceKm > FLY_TO_MAX_DISTANCE_KM) {
				map.jumpTo({ ...target, zoom: Math.max(0, target.zoom - ARRIVAL_SWOOP_ZOOM_OFFSET) });
				map.easeTo({ ...target, duration: ARRIVAL_SWOOP_DURATION_MS });
				return;
			}
			map.flyTo({ ...target, essential: true });
		};
		const onLoadRoute = (detail: AppEventMap["routess:load-route"]) => {
			if (!editor) {
				Logger.warn("[MapWithRouting] routess:load-route received before map ready");
				return;
			}
			const state = useRoutingStore.getState();
			if (!confirmDiscardIfDirty(state.mode, state.activity, state.waypoints)) return;

			if (detail.source === "saved") {
				void editor.loadFromApiRoute(detail.route).then((result) => {
					if (!result.success) {
						Logger.warn("[MapWithRouting] load-route failed:", result.message);
					}
				});
				return;
			}
			if (!detail.waypoints || detail.waypoints.length === 0) {
				Logger.warn("[MapWithRouting] routess:load-route received with no waypoints");
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
				pushToast({ kind: "warn", title: t("map.notReady") });
				return;
			}
			const result = editor.exportGpx();
			if (!result.success) {
				pushToast({ kind: "danger", title: result.message ?? t("share.exportFailed") });
			}
		};
		const onReroute = () => {
			void handleReverseRoute();
		};
		const onRecalculate = () => {
			void handleRecalculateRoute();
		};
		const onGenerateLoop = (detail: AppEventMap["routess:generate-loop"]) => {
			const center = mapRef.current?.getCenter();
			const mapCenter = center ? ([center.lng, center.lat] as [number, number]) : undefined;
			const start = detail?.start ?? mapCenter;
			if (!start) {
				pushToast({ kind: "warn", title: t("map.notReady") });
				return;
			}
			const isAtoB = useLoopPreferencesStore.getState().routeType === "a-to-b";
			const end = isAtoB ? (detail?.end ?? mapCenter) : undefined;
			// Both pickers on "map center" resolve to the same point; an a-to-b
			// from a point to itself is a loop the user didn't ask for.
			if (end && haversineDistance(start, end) < 0.05) {
				pushToast({ kind: "warn", title: t("loop.endSameAsStart") });
				useModalsStore.getState().openModal("loop");
				return;
			}
			void startGeneration(start, end ? { end } : undefined);
		};
		const pickLoopPoint = (hintKey: string, assign: (coord: [number, number]) => void) => {
			const map = mapRef.current;
			if (!map) {
				pushToast({ kind: "warn", title: t("map.notReady") });
				return;
			}
			const canvas = map.getCanvas();
			canvas.style.cursor = "crosshair";
			pushToast({ kind: "info", title: t(hintKey) });

			const finish = () => {
				canvas.style.cursor = "";
				window.removeEventListener("keydown", onEscape);
				useModalsStore.getState().openModal("loop");
			};
			const onEscape = (e: KeyboardEvent) => {
				if (e.key !== "Escape") return;
				cancelMapPick();
				finish();
			};
			window.addEventListener("keydown", onEscape);
			requestMapPick((coord) => {
				assign([coord[0], coord[1]]);
				finish();
			});
		};
		const onPickLoopStart = () => {
			pickLoopPoint("loop.pickStartHint", (coord) => {
				useLoopPreferencesStore.getState().setStart({ kind: "point", coord, source: "picked" });
			});
		};
		const onPickLoopEnd = () => {
			pickLoopPoint("loop.pickEndHint", (coord) => {
				useLoopPreferencesStore.getState().setEnd({ kind: "point", coord, source: "picked" });
			});
		};
		const onImportGpx = (detail: { gpxString?: string; fileName?: string }) => {
			if (!detail?.gpxString) {
				pushToast({ kind: "danger", title: t("import.noContent") });
				return;
			}
			if (!editor) {
				pushToast({ kind: "warn", title: t("map.notReady") });
				return;
			}
			void editor.loadFromGpx(detail.gpxString).then((result) => {
				if (!result.success) {
					handleImportError(result.message ?? t("import.failed"));
					return;
				}
				// An import can land anywhere, including on an empty map that
				// is still parked at the default view, so frame it.
				const coords = getCurrentRoutePath();
				if (mapRef.current && coords.length > 0) zoomToRoute(mapRef.current, coords);
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
			onAppEvent("routess:generate-loop", onGenerateLoop),
			onAppEvent("routess:pick-loop-start", onPickLoopStart),
			onAppEvent("routess:pick-loop-end", onPickLoopEnd),
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
				{editor ? <PwaLaunchBindings /> : null}
				<LibraryRoutePreview mapRef={mapRef} />
				<DiscoverMapBindings mapRef={mapRef} />
				<GenerationPreview mapRef={mapRef} />
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
				<GenerationOverlay />
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
