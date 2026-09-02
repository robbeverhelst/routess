import React, { useEffect, useMemo, useRef, useState } from "react";
import MapGL, { type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import { useMapInitialization } from "@/components/hooks/useMapInitialization";
import { useMapPositioning } from "@/components/hooks/useMapPositioning";
import { useMapRecovery } from "@/components/hooks/useMapRecovery";
import { useMapViewBindings } from "@/components/hooks/useMapViewBindings";
import { useMapViewPersistence } from "@/components/hooks/useMapViewPersistence";
import { MapPopup, type PopupInfo as MapPopupInfo } from "@/components/map/MapPopup";
import { SunPositionIndicator } from "@/components/map/SunPositionIndicator";
import { WaypointDragTrash } from "@/components/map/WaypointDragTrash";
import { useUserLocation } from "@/components/providers/UserLocationProvider";
import { NodeNetworkAttribution, NodesOverlay } from "@/features/overlays/NodesOverlay";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { useErrorHandler } from "@/lib/errors";
import { type SupportedLanguage, useT } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { getTimezoneFallbackLocation } from "@/lib/timezoneLocation";
import { useMapViewStore } from "@/stores/mapViewStore";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { useRoutingStore } from "@/stores/routingStore";

// Map configuration constants
const MAP_PITCH = 30; // Default pitch angle for the map

// mapbox-gl sizes its in-memory tile cache from the viewport alone, which is
// too small once a style carries several sources (basemap, terrain DEM, 3D
// buildings, contours, node network). Too small a cache means panning back to
// where you just were refetches everything.
const MAX_TILE_CACHE_SIZE = 800;

// Default Europe-centered view if user location unavailable
const DEFAULT_VIEW_STATE = {
	longitude: 10.5,
	latitude: 51.2,
	zoom: 4,
	bearing: 0,
	pitch: 0,
};

const STANDARD_MAP_STYLE = "mapbox://styles/mapbox/standard";
const STANDARD_SATELLITE_MAP_STYLE = "mapbox://styles/robbeverhelst/cmosm5k7x000c01segxetckb9";
const OUTDOORS_MAP_STYLE = "mapbox://styles/robbeverhelst/cmosm4baj001j01s65hjz79cw";

// Each style is one Mapbox style URL. Light/dark mode is applied at runtime
// via setConfigProperty("basemap", "lightPreset"), not by swapping the URL.
type MapStyleVariant = { url: string; supportsLightPreset: boolean };

const REDESIGN_MAP_STYLE_VARIANTS: Record<string, MapStyleVariant> = {
	streets: { url: STANDARD_MAP_STYLE, supportsLightPreset: true },
	outdoors: { url: OUTDOORS_MAP_STYLE, supportsLightPreset: true },
	satellite: { url: STANDARD_SATELLITE_MAP_STYLE, supportsLightPreset: true },
};

const FALLBACK_STYLE_VARIANT: MapStyleVariant = {
	url: STANDARD_MAP_STYLE,
	supportsLightPreset: true,
};

function MapLoadingShell({
	isSatellite,
	theme,
	showSpinner = true,
}: {
	isSatellite: boolean;
	theme: "light" | "dark";
	showSpinner?: boolean;
}) {
	const t = useT();
	// Match the map's resting tone so a cold-start (e.g. a discarded PWA
	// reloading) just fades the map in over the same colour, instead of
	// flashing a dark-blue loading screen.
	const isDark = isSatellite || theme === "dark";
	const background = isSatellite ? "#1b261f" : theme === "dark" ? "#0c1320" : "#e7ecec";
	const fg = isDark ? "rgba(231, 236, 236, 0.75)" : "rgba(12, 19, 32, 0.65)";
	const track = isDark ? "rgba(231, 236, 236, 0.18)" : "rgba(12, 19, 32, 0.14)";
	return (
		<div
			data-testid="map-loading-shell"
			role="status"
			className="absolute inset-0 flex flex-col items-center justify-center gap-3 transition-opacity duration-300"
			style={{ background }}
		>
			{showSpinner && (
				<>
					<div
						aria-hidden="true"
						style={{
							width: 28,
							height: 28,
							borderRadius: 999,
							border: `2.5px solid ${track}`,
							borderTopColor: `var(--rds-accent, ${fg})`,
							animation: "rds-spin 0.8s linear infinite",
						}}
					/>
					<span style={{ fontSize: 12.5, fontWeight: 500, letterSpacing: 0.2, color: fg }}>{t("map.loading")}</span>
				</>
			)}
		</div>
	);
}

function isInvalidMapboxToken(token: string) {
	const trimmed = token.trim();
	return !trimmed || trimmed.includes("__VITE_") || trimmed === "your-mapbox-access-token-here" || trimmed.length < 10;
}

function MapUnavailablePanel({
	title,
	message,
	actionLabel,
	onAction,
}: {
	title: string;
	message: string;
	actionLabel?: string;
	onAction?: () => void;
}) {
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 24,
				background: "linear-gradient(180deg, rgba(15,23,42,.16), rgba(15,23,42,.32))",
				zIndex: 8,
			}}
		>
			<div
				style={{
					width: 380,
					maxWidth: "100%",
					borderRadius: 14,
					border: "1px solid rgba(255,255,255,.22)",
					background: "rgba(15,23,42,.84)",
					color: "white",
					padding: 18,
					boxShadow: "0 18px 60px rgba(15,23,42,.32)",
					backdropFilter: "blur(14px)",
				}}
			>
				<div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{title}</div>
				<div style={{ fontSize: 13, lineHeight: 1.55, color: "rgba(255,255,255,.74)" }}>{message}</div>
				<div
					style={{
						marginTop: 12,
						padding: "9px 10px",
						borderRadius: 8,
						background: "rgba(255,255,255,.09)",
						fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
						fontSize: 11,
						color: "rgba(255,255,255,.76)",
						overflowWrap: "anywhere",
					}}
				>
					VITE_MAPBOX_ACCESS_TOKEN=pk...
				</div>
				{actionLabel && onAction && (
					<button
						type="button"
						onClick={onAction}
						style={{
							marginTop: 14,
							height: 34,
							padding: "0 13px",
							borderRadius: 8,
							border: "1px solid rgba(255,255,255,.22)",
							background: "rgba(255,255,255,.12)",
							color: "white",
							fontSize: 13,
							fontWeight: 600,
							cursor: "pointer",
						}}
					>
						{actionLabel}
					</button>
				)}
			</div>
		</div>
	);
}

interface MapCanvasProps {
	mapRef: React.RefObject<MapboxMap | null>;
	mapboxToken: string;
	width?: string | number;
	height?: string | number;
	initialCenter?: [number, number];
	initialZoom?: number;
	routeId?: string;
	mapTheme?: "light" | "dark";
	currentLanguage: SupportedLanguage;

	// RouteDraft editor lifecycle (set by useMapInitialization on map load)
	setEditor: (editor: import("@/features/routing/RouteDraftEditor").RouteDraftEditor | null) => void;
	hasRoute: boolean;

	// Popup management
	popup: MapPopupInfo | null;
	setPopup: Dispatch<SetStateAction<MapPopupInfo | null>>;
	onAddDirectWaypoint: () => void;
	onRemoveWaypoint: () => void;
	onAddWaypointOnRoute: () => void;

	// Error handling
	handleWaypointError: (message: string | null) => void;

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
	mapTheme = "light",
	currentLanguage,
	setEditor,
	hasRoute,
	popup,
	setPopup,
	onAddDirectWaypoint,
	onRemoveWaypoint,
	onAddWaypointOnRoute,
	handleWaypointError,
	lastKnownLocationFromStorage,
	detectedRouteInLocalStorageOnInit,
	lastSavedMapView,
}) => {
	const isMapLockedRef = useRef(false);
	// Live mirror of the popup state so non-React map handlers (touch tap
	// logic in MapInteractionManager) can read "is a popup open" synchronously.
	const popupRef = useRef<MapPopupInfo | null>(popup);
	useEffect(() => {
		popupRef.current = popup;
	}, [popup]);
	const internalMapRef = useRef<MapRef | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const animationFrameIdRef = useRef<number | null>(null);
	const [isMapLoaded, setIsMapLoaded] = useState(false);
	const [loadTimedOut, setLoadTimedOut] = useState(false);

	const currentMapStyleKey = useRedesignSettingsStore((s) => s.mapStyle);
	const isMapLocked = useRoutingStore((s) => s.isMapLocked);
	const currentLightPreset = useMapViewStore((s) => s.lightPreset);
	const currentBearing = useMapViewStore((s) => s.bearing);
	const setCurrentBearing = useMapViewStore((s) => s.setBearing);
	const showSunDirection = useMapViewStore((s) => s.showSunDirection);
	const currentSunPosition = useMapViewStore((s) => s.sunPosition);

	const { location: userLocation, error: locationError, isLoading: isUserLocationLoading } = useUserLocation();
	const { isOnline } = useServiceWorker();
	const { onMapStyleLoaded } = useMapViewBindings({ map: mapRef.current, userLocation, isOnline });

	// Persist the camera so reloads (and version bumps, which purge the ad-hoc
	// location keys) restore the user's region instead of the timezone fallback.
	useMapViewPersistence(mapRef, isMapLoaded);

	const { handleMapError } = useErrorHandler();
	const isSatelliteStyle = currentMapStyleKey === "satellite";
	const styleVariant = REDESIGN_MAP_STYLE_VARIANTS[currentMapStyleKey] ?? FALLBACK_STYLE_VARIANT;
	const mapStyleUrl = styleVariant.url;
	const supportsBasemapLightPreset = styleVariant.supportsLightPreset;
	const hasInvalidMapboxToken = isInvalidMapboxToken(mapboxToken);
	const effectiveLightPreset = mapTheme === "dark" ? "night" : currentLightPreset;

	// Validate Mapbox token on mount
	useEffect(() => {
		if (hasInvalidMapboxToken) {
			handleMapError(
				new Error(
					"Mapbox access token is missing or invalid. Please configure VITE_MAPBOX_ACCESS_TOKEN in your environment.",
				),
				"mapbox-config",
			);
		}
	}, [hasInvalidMapboxToken, handleMapError]);

	useEffect(() => {
		if (hasInvalidMapboxToken || isMapLoaded) return;

		// Only count the load timeout while the tab is visible. A backgrounded
		// cold-start (common for an installed PWA the user switched away from)
		// otherwise trips this and shows the reload panel even though loading is
		// simply paused; restart the clock fresh each time they return.
		let timeout: number | null = null;
		const disarm = () => {
			if (timeout !== null) {
				window.clearTimeout(timeout);
				timeout = null;
			}
		};
		const arm = () => {
			if (document.hidden || timeout !== null) return;
			timeout = window.setTimeout(() => {
				setLoadTimedOut(true);
				handleMapError(
					new Error("Mapbox did not finish loading. Check the access token and network connection."),
					"map-load",
				);
			}, 12000);
		};
		const onVisibility = () => {
			if (document.hidden) disarm();
			else {
				disarm();
				arm();
			}
		};

		arm();
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			disarm();
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [hasInvalidMapboxToken, isMapLoaded, handleMapError]);

	useEffect(() => {
		if (!isMapLoaded || !mapRef.current || !supportsBasemapLightPreset) return;

		try {
			mapRef.current.setConfigProperty("basemap", "lightPreset", effectiveLightPreset);
		} catch (err) {
			Logger.error("[MapCanvas] Failed to sync basemap light preset:", err);
		}
	}, [effectiveLightPreset, isMapLoaded, mapRef, supportsBasemapLightPreset]);

	useEffect(() => {
		if (!isMapLoaded || !mapRef.current) return;

		const map = mapRef.current;
		const handleStyleLoad = () => {
			onMapStyleLoaded();
			if (supportsBasemapLightPreset) {
				try {
					map.setConfigProperty("basemap", "lightPreset", effectiveLightPreset);
				} catch (err) {
					Logger.debug("[MapCanvas] Light preset update skipped for current style", err);
				}
			}
		};

		map.on("style.load", handleStyleLoad);
		return () => {
			map.off("style.load", handleStyleLoad);
		};
	}, [effectiveLightPreset, isMapLoaded, mapRef, onMapStyleLoaded, supportsBasemapLightPreset]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || typeof ResizeObserver === "undefined") return;

		let frameId: number | null = null;
		const resizeMap = () => {
			if (frameId !== null) cancelAnimationFrame(frameId);
			frameId = requestAnimationFrame(() => {
				internalMapRef.current?.getMap().resize();
				mapRef.current?.resize();
			});
		};
		const observer = new ResizeObserver(resizeMap);

		observer.observe(container);
		resizeMap();

		return () => {
			observer.disconnect();
			if (frameId !== null) cancelAnimationFrame(frameId);
		};
	}, [mapRef]);

	// Keep ref in sync with state
	useEffect(() => {
		isMapLockedRef.current = isMapLocked;
	}, [isMapLocked]);

	// Map initialization hook
	const { handleMapLoad } = useMapInitialization({
		mapboxToken,
		setPopup,
		popupRef,
		setEditor,
		handleWaypointError,
		isMapLockedRef,
		currentLightPreset,
		routeId,
	});

	// Refresh the canvas when the tab returns to the foreground.
	useMapRecovery(mapRef, isMapLoaded);

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
			return { ...DEFAULT_VIEW_STATE, ...(lastSavedMapView as Record<string, unknown>) };
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

		// First visit without any stored or granted location: approximate from
		// the browser timezone so the map at least opens in the user's region.
		const timezoneLocation = getTimezoneFallbackLocation();
		if (timezoneLocation) {
			return {
				longitude: timezoneLocation[0],
				latitude: timezoneLocation[1],
				zoom: 9,
				bearing: 0,
				pitch: 0,
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
	// A shared route is being opened when there's a route id or a ?route= param.
	const pendingSharedRoute = useMemo(
		() =>
			Boolean(routeId) ||
			new URLSearchParams(window.location.search).has("route") ||
			new URLSearchParams(window.location.search).has("externalRoute"),
		[routeId],
	);

	useMapPositioning({
		mapRef,
		isMapReady: mapRef.current !== null,
		hasRoute,
		isRouteCoordsReady: true, // This would come from route state
		userLocation,
		isUserLocationLoading,
		locationError: locationError as GeolocationPositionError | null,
		lastKnownLocationFromStorage,
		detectedRouteInLocalStorageOnInit,
		pendingSharedRoute,
		hasSavedMapView: Boolean(lastSavedMapView),
		mapPitch: MAP_PITCH,
	});

	// Effect to set initial bearing from map instance if not set by prop
	useEffect(() => {
		const viewState = effectiveInitialViewState as Record<string, unknown>;
		if (mapRef.current && typeof viewState?.bearing === "undefined") {
			setCurrentBearing(mapRef.current.getBearing());
		}
	}, [mapRef, setCurrentBearing, effectiveInitialViewState]);

	// Animate user location halo with performance optimizations
	useEffect(() => {
		if (!mapRef.current) return;

		const map = mapRef.current;
		const MIN_HALO_RADIUS = 10;
		const MAX_HALO_RADIUS = 14;
		const PULSE_DURATION_MS = 2000;
		const TARGET_FPS = 30; // Throttle to 30fps instead of 60fps for better performance
		const FRAME_INTERVAL = 1000 / TARGET_FPS;

		let startTime: number | null = null;
		let lastFrameTime = 0;

		const animateHalo = (timestamp: number) => {
			// Throttle to target FPS for better performance
			if (timestamp - lastFrameTime < FRAME_INTERVAL) {
				animationFrameIdRef.current = requestAnimationFrame(animateHalo);
				return;
			}

			lastFrameTime = timestamp;

			if (!startTime) startTime = timestamp;
			const elapsedTime = timestamp - startTime;
			const pulseProgress = (elapsedTime % PULSE_DURATION_MS) / PULSE_DURATION_MS;
			const easedProgress = (Math.sin(pulseProgress * Math.PI * 2 - Math.PI / 2) + 1) / 2;
			const currentRadius = MIN_HALO_RADIUS + easedProgress * (MAX_HALO_RADIUS - MIN_HALO_RADIUS);

			try {
				// Check if layer exists before animation to avoid unnecessary updates
				if (map.getLayer("user-location-halo") && map.getSource("user-location-point")) {
					map.setPaintProperty("user-location-halo", "circle-radius", currentRadius);
				}
			} catch (e) {
				// Suppress minor map errors during animation
				if (typeof e === "undefined") Logger.info("Suppressed animation error");
			}

			animationFrameIdRef.current = requestAnimationFrame(animateHalo);
		};

		animationFrameIdRef.current = requestAnimationFrame(animateHalo);

		return () => {
			if (animationFrameIdRef.current) {
				cancelAnimationFrame(animationFrameIdRef.current);
			}
		};
	}, [mapRef]);

	if (hasInvalidMapboxToken) {
		return (
			<div ref={containerRef} className="relative" style={{ width, height }}>
				<MapLoadingShell isSatellite={isSatelliteStyle} theme={mapTheme} showSpinner={false} />
				<MapUnavailablePanel
					title="Mapbox token required"
					message="The map cannot load because VITE_MAPBOX_ACCESS_TOKEN is missing or still set to the example value. Put a real public Mapbox token in the repo root .env file and restart bun dev."
				/>
			</div>
		);
	}

	return (
		<>
			<div ref={containerRef} className="relative" style={{ width, height }}>
				<MapGL
					ref={internalMapRef}
					mapboxAccessToken={mapboxToken}
					initialViewState={{
						...effectiveInitialViewState,
						pitch: ((effectiveInitialViewState as Record<string, unknown>)?.pitch as number) ?? MAP_PITCH,
						bearing: ((effectiveInitialViewState as Record<string, unknown>)?.bearing as number) ?? currentBearing,
					}}
					style={{ width: "100%", height: "100%", opacity: isMapLoaded ? 1 : 0, transition: "opacity 200ms ease" }}
					mapStyle={mapStyleUrl}
					reuseMaps
					attributionControl={false}
					projection="globe"
					antialias={true}
					maxTileCacheSize={MAX_TILE_CACHE_SIZE}
					minPitch={MAP_PITCH}
					maxPitch={MAP_PITCH}
					onLoad={(evt) => {
						// `evt.target` is the underlying mapbox-gl Map. Prefer it
						// over `internalMapRef.current.getMap()` because react-map-gl
						// fires a synthetic `load` synchronously inside `Mapbox.reuse`
						// (when `reuseMaps` recycles the map on remount), before
						// `useImperativeHandle` has assigned `internalMapRef.current`.
						// Using the ref here would leave `mapRef.current` null on
						// every remount, silently breaking flyTo-based buttons
						// (locate, zoom-to-route) until a full page reload.
						mapRef.current = evt.target;
						setIsMapLoaded(true);
						// A slow load can trip the 12s timeout before finishing; clear
						// it so the "still loading" panel doesn't cover a working map.
						setLoadTimedOut(false);
						if (supportsBasemapLightPreset) {
							try {
								evt.target.setConfigProperty("basemap", "lightPreset", effectiveLightPreset);
							} catch (err) {
								Logger.debug("[MapCanvas] Initial basemap light preset skipped for current style", err);
							}
						}
						handleMapLoad(evt);
						onMapStyleLoaded();
					}}
					onError={(error) => {
						// The event object is circular, so logging it whole reports
						// "[object Object]" and nothing else. Send the message.
						Logger.error("[MapCanvas] Map error:", error.error?.message ?? "unknown map error");

						// Check if it's a Mapbox token error
						if (
							error.error?.message?.includes("401") ||
							error.error?.message?.includes("Invalid access token") ||
							error.error?.message?.includes("Unauthorized")
						) {
							handleMapError(new Error("Invalid Mapbox access token. Please check your API key."), "mapbox-auth");
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
					{popup && (
						<MapPopup
							popupInfo={popup}
							onAddDirectWaypoint={onAddDirectWaypoint}
							onRemoveWaypoint={onRemoveWaypoint}
							onAddWaypointOnRoute={onAddWaypointOnRoute}
							currentLanguage={currentLanguage}
						/>
					)}
					<NodesOverlay />
				</MapGL>

				<NodeNetworkAttribution />

				<WaypointDragTrash />

				{!isMapLoaded && (
					<MapLoadingShell isSatellite={isSatelliteStyle} theme={mapTheme} showSpinner={!loadTimedOut} />
				)}
				{loadTimedOut && (
					<MapUnavailablePanel
						title="Map is still loading"
						message="Mapbox has not responded yet. This is usually an invalid token, blocked network request, or a temporary Mapbox error."
						actionLabel="Retry"
						onAction={() => {
							setLoadTimedOut(false);
							window.location.reload();
						}}
					/>
				)}
			</div>

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
