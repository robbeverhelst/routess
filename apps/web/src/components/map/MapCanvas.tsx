import React, { useEffect, useMemo, useRef, useState } from "react";
import MapGL, { type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import { useMapInitialization } from "@/components/hooks/useMapInitialization";
import { useMapPositioning } from "@/components/hooks/useMapPositioning";
import { useMapConfiguration } from "@/components/providers/MapConfigurationProvider";
import { useUserLocation } from "@/components/providers/UserLocationProvider";
import { MapPopup, type PopupInfo as MapPopupInfo } from "@/components/ui/MapPopup";
import { SunPositionIndicator } from "@/components/ui/SunPositionIndicator";
import { useErrorHandler } from "@/lib/errors";
import type { SupportedLanguage } from "@/lib/i18n";
import { Logger } from "@/lib/logger";

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

const STANDARD_MAP_STYLE = "mapbox://styles/mapbox/standard";
const SATELLITE_MAP_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";

function MapLoadingShell({ isSatellite }: { isSatellite: boolean }) {
	return (
		<div
			data-testid="map-loading-shell"
			aria-hidden="true"
			className={`absolute inset-0 overflow-hidden transition-opacity duration-300 ${
				isSatellite ? "bg-[#203024]" : "bg-slate-950"
			}`}
		>
			<div
				className={`absolute inset-0 ${
					isSatellite
						? "bg-[radial-gradient(circle_at_top,#6b8a5a,transparent_45%),radial-gradient(circle_at_bottom,#314b2f,transparent_35%),linear-gradient(135deg,#243b2e,#101c14)]"
						: "bg-[radial-gradient(circle_at_top,#1e3a8a,transparent_45%),radial-gradient(circle_at_bottom,#1e293b,transparent_40%),linear-gradient(180deg,#020617,#0f172a)]"
				}`}
			/>
			<div className="absolute left-4 top-4 h-10 w-10 rounded-xl bg-white/15 backdrop-blur-sm" />
			<div className="absolute right-4 top-4 h-10 w-10 rounded-xl bg-white/15 backdrop-blur-sm" />
			<div className="absolute left-1/2 top-8 h-12 w-64 -translate-x-1/2 rounded-2xl bg-white/12 backdrop-blur-sm" />
			<div className="absolute bottom-8 right-8 h-16 w-28 rounded-2xl bg-white/12 backdrop-blur-sm" />
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
	mapTheme = "light",
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
	const containerRef = useRef<HTMLDivElement | null>(null);
	const animationFrameIdRef = useRef<number | null>(null);
	const [isMapLoaded, setIsMapLoaded] = useState(false);
	const [loadTimedOut, setLoadTimedOut] = useState(false);

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

	const { location: userLocation, error: locationError, isLoading: isUserLocationLoading } = useUserLocation();

	const { handleMapError } = useErrorHandler();
	const isSatelliteStyle = currentMapStyle === "satellite";
	const mapStyleUrl = isSatelliteStyle ? SATELLITE_MAP_STYLE : STANDARD_MAP_STYLE;
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

		const timeout = window.setTimeout(() => {
			setLoadTimedOut(true);
			handleMapError(
				new Error("Mapbox did not finish loading. Check the access token and network connection."),
				"map-load",
			);
		}, 12000);

		return () => window.clearTimeout(timeout);
	}, [hasInvalidMapboxToken, isMapLoaded, handleMapError]);

	useEffect(() => {
		if (!isMapLoaded || !mapRef.current || currentMapStyle !== "standard") return;

		try {
			mapRef.current.setConfigProperty("basemap", "lightPreset", effectiveLightPreset);
		} catch (err) {
			Logger.error("[MapCanvas] Failed to sync basemap light preset:", err);
		}
	}, [currentMapStyle, effectiveLightPreset, isMapLoaded, mapRef]);

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
		locationError: locationError as GeolocationPositionError | null,
		lastKnownLocationFromStorage,
		detectedRouteInLocalStorageOnInit,
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
				<MapLoadingShell isSatellite={isSatelliteStyle} />
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
					minPitch={MAP_PITCH}
					maxPitch={MAP_PITCH}
					onLoad={(evt) => {
						// Set the external mapRef to the map instance
						if (internalMapRef.current) {
							mapRef.current = internalMapRef.current.getMap();
						}
						setIsMapLoaded(true);
						try {
							evt.target.setConfigProperty("basemap", "lightPreset", effectiveLightPreset);
						} catch (err) {
							Logger.error("[MapCanvas] Failed to set initial basemap light preset:", err);
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
				</MapGL>

				{!isMapLoaded && <MapLoadingShell isSatellite={isSatelliteStyle} />}
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
