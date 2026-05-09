import type { Waypoint } from "@routess/core";
import { haversineDistance } from "@routess/core";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import type { SurfaceSegment } from "@/features/routing/services/SurfaceService";
import { Logger } from "@/lib/logger";
import type { Coordinate } from "@/types/map";
import { type MapPalette, readMapPalette } from "./mapPalette";

export const ROUTE_SOURCE_ID = "route";
export const ROUTE_LAYER_ID = "route";
export const ROUTE_HOVER_LAYER_ID = "route-hover-target";
export const ROUTE_SURFACE_SOURCE_ID = "route-surface";
export const WAYPOINTS_SOURCE_ID = "points";
export const WAYPOINTS_LAYER_ID = "points";
export const WAYPOINTS_CORE_LAYER_ID = "points-core";
export const USER_LOCATION_SOURCE_ID = "user-location-point";
export const USER_LOCATION_HALO_LAYER_ID = "user-location-halo";
export const USER_LOCATION_PULSE_LAYER_ID = "user-location-pulse";
export const USER_LOCATION_POINT_LAYER_ID = "user-location-point";
export const KM_MARKERS_SOURCE_ID = "km-markers";
export const KM_MARKERS_LAYER_ID = "km-markers";
export const TEMP_DRAG_LINES_SOURCE_ID = "temp-drag-lines";
export const TEMP_DRAG_LINES_LAYER_ID = "temp-drag-lines";
export const ROUTE_CASING_LAYER_ID = "route-casing";
export const WAYPOINTS_SHADOW_LAYER_ID = "waypoints-shadow";
export const ROUTE_ARROWS_LAYER_ID = "route-arrows";
export const ROUTE_SURFACE_COMPACTED_LAYER_ID = "route-surface-compacted";
export const ROUTE_SURFACE_UNPAVED_LAYER_ID = "route-surface-unpaved";
export const ROUTE_SURFACE_PATH_LAYER_ID = "route-surface-path";
export const ROUTE_SCRUB_SOURCE_ID = "route-scrub";
export const ROUTE_SCRUB_HALO_LAYER_ID = "route-scrub-halo";
export const ROUTE_SCRUB_LAYER_ID = "route-scrub";

// Dasharrays are not data-driven in mapbox-gl, so each bucket gets its own
// filtered layer. Patterns chosen to read intuitively: solid-ish long dash
// for compacted (still mostly road), broken dash for unpaved, fine dots for
// footpaths.
const SURFACE_DASH_PATTERNS = {
	compacted: [3, 1.5],
	unpaved: [1.5, 1.5],
	path: [0.4, 1.6],
} as const;

const KM_MARKER_VISIBILITY_CONFIG = {
	minZoomToShowAny: 9,
	majorMarkerMinZoom: 9,
	mediumMarkerMinZoom: 11,
	minorMarkerMinZoom: 13,
};

// [zoom, ringRadius, shadowRadius, coreRadius, strokeWidth]
const WAYPOINT_SCALING_CONFIG = {
	zoomStops: [
		[6, 1.5, 4, 0, 0.5],
		[8, 2.5, 6, 0, 0.75],
		[10, 4, 9, 1.4, 1],
		[12, 5.5, 12, 2, 1.25],
		[14, 7, 15, 2.6, 1.5],
		[16, 8.5, 18, 3.2, 1.75],
	],
};

// Mapbox requires "zoom" to sit directly under a top-level "interpolate" or
// "step", so we embed the hover branch in each output value instead of
// wrapping the whole interpolate in a "case".
const interpolateZoomStops = (column: 1 | 2 | 3 | 4, hoverMultiplier = 1): unknown[] => [
	"interpolate",
	["linear"],
	["zoom"],
	...WAYPOINT_SCALING_CONFIG.zoomStops.flatMap((stop) => [
		stop[0],
		hoverMultiplier === 1
			? stop[column]
			: ["case", ["boolean", ["feature-state", "hover"], false], stop[column] * hoverMultiplier, stop[column]],
	]),
];

export const initializeSourcesAndLayers = (map: MapboxMap, palette?: MapPalette): void => {
	const p = palette ?? readMapPalette();

	if (!map.getSource(ROUTE_SOURCE_ID)) {
		map.addSource(ROUTE_SOURCE_ID, {
			type: "geojson",
			data: {
				type: "Feature",
				id: "main_route_line",
				properties: {},
				geometry: { type: "LineString", coordinates: [] },
			},
		});
		map.addLayer({
			id: ROUTE_CASING_LAYER_ID,
			type: "line",
			source: ROUTE_SOURCE_ID,
			layout: { "line-join": "round", "line-cap": "round" },
			paint: {
				"line-color": p.routeCasing,
				"line-width": 5,
				"line-emissive-strength": 1,
			},
		});
		map.addLayer({
			id: ROUTE_HOVER_LAYER_ID,
			type: "line",
			source: ROUTE_SOURCE_ID,
			layout: { "line-join": "round", "line-cap": "round" },
			paint: {
				"line-color": "#000",
				"line-width": 14,
				"line-opacity": 0,
				"line-emissive-strength": 1,
			},
		});
		map.addLayer({
			id: ROUTE_LAYER_ID,
			type: "line",
			source: ROUTE_SOURCE_ID,
			layout: { "line-join": "round", "line-cap": "round" },
			paint: {
				"line-opacity": 0.95,
				"line-color": ["case", ["boolean", ["feature-state", "hover"], false], p.routeHover, p.routeMain],
				"line-width": ["case", ["boolean", ["feature-state", "hover"], false], 4, 2.5],
				"line-emissive-strength": 1,
			},
		});
	}

	if (!map.getSource(ROUTE_SURFACE_SOURCE_ID)) {
		map.addSource(ROUTE_SURFACE_SOURCE_ID, {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});
		const surfaceOverlayPaint = {
			"line-color": p.arrowFill,
			"line-width": 1.6,
			"line-opacity": 0.95,
			"line-emissive-strength": 1,
		} as const;
		map.addLayer({
			id: ROUTE_SURFACE_COMPACTED_LAYER_ID,
			type: "line",
			source: ROUTE_SURFACE_SOURCE_ID,
			filter: ["==", ["get", "surface"], "compacted"],
			layout: { "line-join": "round", "line-cap": "butt" },
			paint: { ...surfaceOverlayPaint, "line-dasharray": [...SURFACE_DASH_PATTERNS.compacted] },
		});
		map.addLayer({
			id: ROUTE_SURFACE_UNPAVED_LAYER_ID,
			type: "line",
			source: ROUTE_SURFACE_SOURCE_ID,
			filter: ["==", ["get", "surface"], "unpaved"],
			layout: { "line-join": "round", "line-cap": "butt" },
			paint: { ...surfaceOverlayPaint, "line-dasharray": [...SURFACE_DASH_PATTERNS.unpaved] },
		});
		map.addLayer({
			id: ROUTE_SURFACE_PATH_LAYER_ID,
			type: "line",
			source: ROUTE_SURFACE_SOURCE_ID,
			filter: ["==", ["get", "surface"], "path"],
			layout: { "line-join": "round", "line-cap": "round" },
			paint: { ...surfaceOverlayPaint, "line-dasharray": [...SURFACE_DASH_PATTERNS.path] },
		});
	}

	if (map.getSource(ROUTE_SOURCE_ID) && !map.getLayer(ROUTE_ARROWS_LAYER_ID)) {
		map.addLayer({
			id: ROUTE_ARROWS_LAYER_ID,
			type: "symbol",
			source: ROUTE_SOURCE_ID,
			layout: {
				"symbol-placement": "line",
				"symbol-spacing": ["interpolate", ["linear"], ["zoom"], 6, 60, 12, 140, 14, 220, 18, 320],
				"text-field": "›",
				"text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
				"text-size": ["interpolate", ["linear"], ["zoom"], 8, 14, 12, 18, 16, 24],
				"text-allow-overlap": true,
				"text-ignore-placement": true,
				"text-rotation-alignment": "map",
				"text-pitch-alignment": "map",
				"text-keep-upright": false,
				"text-letter-spacing": 0,
				visibility: "visible",
			},
			paint: {
				"text-color": p.arrowFill,
				"text-halo-color": p.arrowHalo,
				"text-halo-width": 1.6,
				"text-opacity": 0.95,
			},
		});
	}

	if (!map.getSource(WAYPOINTS_SOURCE_ID)) {
		map.addSource(WAYPOINTS_SOURCE_ID, {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});
		map.addLayer({
			id: WAYPOINTS_SHADOW_LAYER_ID,
			type: "circle",
			source: WAYPOINTS_SOURCE_ID,
			paint: {
				"circle-radius": interpolateZoomStops(2, 1.35),
				"circle-radius-transition": { duration: 180, delay: 0 },
				"circle-color": p.waypointShadow,
				"circle-blur": 0.6,
			},
		});
		map.addLayer({
			id: WAYPOINTS_LAYER_ID,
			type: "circle",
			source: WAYPOINTS_SOURCE_ID,
			paint: {
				"circle-radius": interpolateZoomStops(1, 1.35),
				"circle-radius-transition": { duration: 180, delay: 0 },
				"circle-color": [
					"match",
					["get", "pointType"],
					"start",
					p.waypointStart,
					"end",
					p.waypointEnd,
					"direct",
					p.waypointDirect,
					p.waypointInter,
				],
				"circle-stroke-width": interpolateZoomStops(4, 1.75),
				"circle-stroke-width-transition": { duration: 180, delay: 0 },
				"circle-stroke-color": p.waypointStroke,
			},
		});
		map.addLayer({
			id: WAYPOINTS_CORE_LAYER_ID,
			type: "circle",
			source: WAYPOINTS_SOURCE_ID,
			filter: ["match", ["get", "pointType"], ["start", "end", "direct"], true, false],
			paint: {
				"circle-radius": interpolateZoomStops(3, 1.35),
				"circle-radius-transition": { duration: 180, delay: 0 },
				"circle-color": p.waypointStroke,
			},
		});
	}

	if (!map.getSource(USER_LOCATION_SOURCE_ID)) {
		map.addSource(USER_LOCATION_SOURCE_ID, {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});
		map.addLayer({
			id: USER_LOCATION_HALO_LAYER_ID,
			type: "circle",
			source: USER_LOCATION_SOURCE_ID,
			paint: {
				"circle-radius": 16,
				"circle-color": p.userLocation,
				"circle-opacity": 0.22,
				"circle-blur": 0.5,
				"circle-stroke-width": 0,
			},
		});
		// Animated outward pulse — startUserLocationPulse drives circle-radius
		// and circle-opacity on this layer; the layer's transitions interpolate.
		map.addLayer({
			id: USER_LOCATION_PULSE_LAYER_ID,
			type: "circle",
			source: USER_LOCATION_SOURCE_ID,
			paint: {
				"circle-radius": 10,
				"circle-color": p.userLocation,
				"circle-opacity": 0.45,
				"circle-blur": 0.2,
				"circle-stroke-width": 0,
				"circle-radius-transition": { duration: 1600, delay: 0 },
				"circle-opacity-transition": { duration: 1600, delay: 0 },
			},
		});
		map.addLayer({
			id: USER_LOCATION_POINT_LAYER_ID,
			type: "circle",
			source: USER_LOCATION_SOURCE_ID,
			paint: {
				"circle-radius": 5.5,
				"circle-color": p.userLocation,
				"circle-stroke-width": 3,
				"circle-stroke-color": p.userLocationStroke,
				"circle-emissive-strength": 1,
			},
		});
	}

	if (!map.getSource(KM_MARKERS_SOURCE_ID)) {
		map.addSource(KM_MARKERS_SOURCE_ID, {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});
	}

	if (map.getLayer(KM_MARKERS_LAYER_ID)) {
		map.removeLayer(KM_MARKERS_LAYER_ID);
	}
	map.addLayer({
		id: KM_MARKERS_LAYER_ID,
		type: "symbol",
		source: KM_MARKERS_SOURCE_ID,
		layout: {
			"text-field": ["get", "km"],
			"text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
			"text-size": 10.5,
			"text-letter-spacing": 0.04,
			"text-anchor": "bottom",
			"text-offset": [0, -0.9],
			"text-allow-overlap": false,
			"text-ignore-placement": false,
			"text-padding": 4,
			"symbol-placement": "point",
		},
		paint: {
			"text-color": p.kmText,
			"text-halo-color": p.kmHalo,
			"text-halo-width": 2,
			"text-halo-blur": 0.5,
		},
		filter: [
			"all",
			[">=", ["zoom"], KM_MARKER_VISIBILITY_CONFIG.minZoomToShowAny],
			[
				"any",
				[
					"all",
					["==", ["get", "markerType"], "major"],
					[">=", ["zoom"], KM_MARKER_VISIBILITY_CONFIG.majorMarkerMinZoom],
				],
				[
					"all",
					["==", ["get", "markerType"], "medium"],
					[">=", ["zoom"], KM_MARKER_VISIBILITY_CONFIG.mediumMarkerMinZoom],
				],
				[
					"all",
					["==", ["get", "markerType"], "minor"],
					[">=", ["zoom"], KM_MARKER_VISIBILITY_CONFIG.minorMarkerMinZoom],
				],
			],
		],
	});

	if (!map.getSource(ROUTE_SCRUB_SOURCE_ID)) {
		map.addSource(ROUTE_SCRUB_SOURCE_ID, {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});
		map.addLayer({
			id: ROUTE_SCRUB_HALO_LAYER_ID,
			type: "circle",
			source: ROUTE_SCRUB_SOURCE_ID,
			paint: {
				"circle-radius": 8,
				"circle-color": p.waypointStroke,
				"circle-opacity": 0.95,
				"circle-emissive-strength": 1,
			},
		});
		map.addLayer({
			id: ROUTE_SCRUB_LAYER_ID,
			type: "circle",
			source: ROUTE_SCRUB_SOURCE_ID,
			paint: {
				"circle-radius": 5,
				"circle-color": p.routeMain,
				"circle-emissive-strength": 1,
			},
		});
	}

	if (!map.getSource(TEMP_DRAG_LINES_SOURCE_ID)) {
		map.addSource(TEMP_DRAG_LINES_SOURCE_ID, {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});
		map.addLayer({
			id: TEMP_DRAG_LINES_LAYER_ID,
			type: "line",
			source: TEMP_DRAG_LINES_SOURCE_ID,
			layout: { "line-join": "round", "line-cap": "round" },
			paint: {
				"line-color": p.dragLine,
				"line-width": 2.5,
				"line-opacity": 0.7,
				"line-dasharray": [2, 2],
			},
		});
	}
	Logger.info("[MapLayerManager] All sources and layers initialized (if not already present).");
};

export const applyMapPalette = (map: MapboxMap, palette: MapPalette): void => {
	if (!map?.getStyle()) return;
	try {
		if (map.getLayer(ROUTE_CASING_LAYER_ID)) {
			map.setPaintProperty(ROUTE_CASING_LAYER_ID, "line-color", palette.routeCasing);
		}
		if (map.getLayer(ROUTE_LAYER_ID)) {
			map.setPaintProperty(ROUTE_LAYER_ID, "line-color", [
				"case",
				["boolean", ["feature-state", "hover"], false],
				palette.routeHover,
				palette.routeMain,
			]);
		}
		if (map.getLayer(ROUTE_ARROWS_LAYER_ID)) {
			map.setPaintProperty(ROUTE_ARROWS_LAYER_ID, "text-color", palette.arrowFill);
			map.setPaintProperty(ROUTE_ARROWS_LAYER_ID, "text-halo-color", palette.arrowHalo);
		}
		for (const id of [ROUTE_SURFACE_COMPACTED_LAYER_ID, ROUTE_SURFACE_UNPAVED_LAYER_ID, ROUTE_SURFACE_PATH_LAYER_ID]) {
			if (map.getLayer(id)) {
				map.setPaintProperty(id, "line-color", palette.arrowFill);
			}
		}
		if (map.getLayer(WAYPOINTS_SHADOW_LAYER_ID)) {
			map.setPaintProperty(WAYPOINTS_SHADOW_LAYER_ID, "circle-color", palette.waypointShadow);
		}
		if (map.getLayer(WAYPOINTS_LAYER_ID)) {
			map.setPaintProperty(WAYPOINTS_LAYER_ID, "circle-color", [
				"match",
				["get", "pointType"],
				"start",
				palette.waypointStart,
				"end",
				palette.waypointEnd,
				"direct",
				palette.waypointDirect,
				palette.waypointInter,
			]);
			map.setPaintProperty(WAYPOINTS_LAYER_ID, "circle-stroke-color", palette.waypointStroke);
		}
		if (map.getLayer(WAYPOINTS_CORE_LAYER_ID)) {
			map.setPaintProperty(WAYPOINTS_CORE_LAYER_ID, "circle-color", palette.waypointStroke);
		}
		if (map.getLayer(USER_LOCATION_HALO_LAYER_ID)) {
			map.setPaintProperty(USER_LOCATION_HALO_LAYER_ID, "circle-color", palette.userLocation);
		}
		if (map.getLayer(USER_LOCATION_PULSE_LAYER_ID)) {
			map.setPaintProperty(USER_LOCATION_PULSE_LAYER_ID, "circle-color", palette.userLocation);
		}
		if (map.getLayer(USER_LOCATION_POINT_LAYER_ID)) {
			map.setPaintProperty(USER_LOCATION_POINT_LAYER_ID, "circle-color", palette.userLocation);
			map.setPaintProperty(USER_LOCATION_POINT_LAYER_ID, "circle-stroke-color", palette.userLocationStroke);
		}
		if (map.getLayer(KM_MARKERS_LAYER_ID)) {
			map.setPaintProperty(KM_MARKERS_LAYER_ID, "text-color", palette.kmText);
			map.setPaintProperty(KM_MARKERS_LAYER_ID, "text-halo-color", palette.kmHalo);
		}
		if (map.getLayer(TEMP_DRAG_LINES_LAYER_ID)) {
			map.setPaintProperty(TEMP_DRAG_LINES_LAYER_ID, "line-color", palette.dragLine);
		}
		if (map.getLayer(ROUTE_SCRUB_HALO_LAYER_ID)) {
			map.setPaintProperty(ROUTE_SCRUB_HALO_LAYER_ID, "circle-color", palette.waypointStroke);
		}
		if (map.getLayer(ROUTE_SCRUB_LAYER_ID)) {
			map.setPaintProperty(ROUTE_SCRUB_LAYER_ID, "circle-color", palette.routeMain);
		}
	} catch (err) {
		Logger.warn("[MapLayerManager] Failed to apply palette", err);
	}
};

// Mapbox setFeatureState needs a stable feature id. We derive it from the
// original waypoint index (offset by 1, since some Mapbox internals treat 0
// as missing). Inverse: index = id - 1.
export const waypointFeatureIdFromIndex = (index: number): number => index + 1;

export const setHoveredWaypoint = (map: MapboxMap, previousIndex: number | null, nextIndex: number | null): void => {
	if (!map?.getSource(WAYPOINTS_SOURCE_ID)) return;
	if (previousIndex !== null) {
		map.removeFeatureState({ source: WAYPOINTS_SOURCE_ID, id: waypointFeatureIdFromIndex(previousIndex) }, "hover");
	}
	if (nextIndex !== null) {
		map.setFeatureState({ source: WAYPOINTS_SOURCE_ID, id: waypointFeatureIdFromIndex(nextIndex) }, { hover: true });
	}
};

export const updateWaypointsLayer = (map: MapboxMap, waypoints: Waypoint[], isMapLocked: boolean): void => {
	if (!map?.getSource(WAYPOINTS_SOURCE_ID)) return;

	const renderable: { wp: Waypoint; originalIndex: number }[] = waypoints.map((wp, originalIndex) => ({
		wp,
		originalIndex,
	}));
	const pointsToRender =
		isMapLocked && renderable.length > 2 ? [renderable[0], renderable[renderable.length - 1]] : renderable;

	const features = pointsToRender.map(({ wp, originalIndex }, index, arr) => {
		let pointType: string;
		if (wp.type === "direct") pointType = "direct";
		else if (arr.length === 1 || index === 0) pointType = "start";
		else if (index === arr.length - 1) pointType = "end";
		else pointType = "intermediate";

		return {
			type: "Feature" as const,
			id: waypointFeatureIdFromIndex(originalIndex),
			properties: { pointType, waypointIndex: originalIndex },
			geometry: { type: "Point" as const, coordinates: wp.coord },
		};
	});

	const source = map.getSource(WAYPOINTS_SOURCE_ID) as GeoJSONSource;
	source.setData({ type: "FeatureCollection" as const, features });
};

export const updateUserLocationLayer = (map: MapboxMap, coordinates: Coordinate | null): void => {
	if (!map?.getSource(USER_LOCATION_SOURCE_ID)) return;
	const features = [];
	if (coordinates) {
		features.push({
			type: "Feature" as const,
			properties: {},
			geometry: { type: "Point" as const, coordinates: coordinates },
		});
	}
	const source = map.getSource(USER_LOCATION_SOURCE_ID) as GeoJSONSource;
	source.setData({ type: "FeatureCollection" as const, features });
};

// Drives the outward pulse on the user-location ring. Toggles the pulse
// layer's circle-radius/opacity between a "small/visible" and a
// "large/transparent" state every PULSE_INTERVAL_MS; the layer's own
// transitions interpolate between the two, producing a smooth ripple.
const PULSE_INTERVAL_MS = 1600;
const PULSE_SMALL = { radius: 10, opacity: 0.45 };
const PULSE_LARGE = { radius: 32, opacity: 0 };

export const startUserLocationPulse = (map: MapboxMap): (() => void) => {
	let expanded = false;
	const tick = () => {
		if (!map?.getLayer(USER_LOCATION_PULSE_LAYER_ID)) return;
		expanded = !expanded;
		const target = expanded ? PULSE_LARGE : PULSE_SMALL;
		map.setPaintProperty(USER_LOCATION_PULSE_LAYER_ID, "circle-radius", target.radius);
		map.setPaintProperty(USER_LOCATION_PULSE_LAYER_ID, "circle-opacity", target.opacity);
	};
	tick();
	const intervalId = window.setInterval(tick, PULSE_INTERVAL_MS);
	return () => window.clearInterval(intervalId);
};

export const updateRouteLayer = (map: MapboxMap, routeCoordinates: Coordinate[]): void => {
	if (!map?.getSource(ROUTE_SOURCE_ID)) return;
	const source = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource;
	source.setData({
		type: "Feature" as const,
		id: "main_route_line",
		properties: {},
		geometry: { type: "LineString" as const, coordinates: routeCoordinates },
	});
};

export const updateRouteSurfaceLayer = (map: MapboxMap, segments: SurfaceSegment[]): void => {
	if (!map?.getSource(ROUTE_SURFACE_SOURCE_ID)) return;
	// Only non-paved buckets render an overlay; paved sections keep the plain route line.
	const features = segments
		.filter((s) => s.surface !== "paved" && s.coordinates.length >= 2)
		.map((s) => ({
			type: "Feature" as const,
			properties: { surface: s.surface },
			geometry: { type: "LineString" as const, coordinates: s.coordinates },
		}));
	const source = map.getSource(ROUTE_SURFACE_SOURCE_ID) as GeoJSONSource;
	source.setData({ type: "FeatureCollection" as const, features });
};

export const clearRouteSurfaceLayer = (map: MapboxMap): void => {
	if (!map?.getSource(ROUTE_SURFACE_SOURCE_ID)) return;
	const source = map.getSource(ROUTE_SURFACE_SOURCE_ID) as GeoJSONSource;
	source.setData({ type: "FeatureCollection" as const, features: [] });
};

export const updateKilometerMarkersLayer = (
	map: MapboxMap,
	kmMarkerFeatures: GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>[],
): void => {
	if (!map?.getSource(KM_MARKERS_SOURCE_ID)) return;
	const source = map.getSource(KM_MARKERS_SOURCE_ID) as GeoJSONSource;
	source.setData({ type: "FeatureCollection" as const, features: kmMarkerFeatures });
};

export const updateDragLinesLayer = (map: MapboxMap, dragLineFeatures: GeoJSON.Feature<GeoJSON.LineString>[]): void => {
	if (!map?.getSource(TEMP_DRAG_LINES_SOURCE_ID)) return;
	const source = map.getSource(TEMP_DRAG_LINES_SOURCE_ID) as GeoJSONSource;
	source.setData({ type: "FeatureCollection" as const, features: dragLineFeatures });
};

export const clearRouteLayer = (map: MapboxMap): void => {
	if (!map?.getSource(ROUTE_SOURCE_ID)) return;
	const source = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource;
	source.setData({
		type: "Feature" as const,
		id: "main_route_line",
		properties: {},
		geometry: { type: "LineString", coordinates: [] },
	});
};

export const clearKilometerMarkersLayer = (map: MapboxMap): void => {
	if (!map?.getSource(KM_MARKERS_SOURCE_ID)) return;
	const source = map.getSource(KM_MARKERS_SOURCE_ID) as GeoJSONSource;
	source.setData({ type: "FeatureCollection" as const, features: [] });
};

// Walk routePath summing haversine segments until we reach distanceMeters,
// then linearly interpolate within the straddling segment. Returns null when
// the path is too short or the distance is out of range.
export const interpolateOnRoutePath = (routePath: Coordinate[], distanceMeters: number): Coordinate | null => {
	if (routePath.length < 2 || !Number.isFinite(distanceMeters) || distanceMeters < 0) return null;
	let covered = 0;
	for (let i = 0; i < routePath.length - 1; i++) {
		const a = routePath[i];
		const b = routePath[i + 1];
		const segLen = haversineDistance(a, b) * 1000;
		if (segLen <= 0) continue;
		if (covered + segLen >= distanceMeters) {
			const t = (distanceMeters - covered) / segLen;
			return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
		}
		covered += segLen;
	}
	return routePath[routePath.length - 1];
};

export const updateRouteScrubLayer = (map: MapboxMap, coord: Coordinate | null): void => {
	if (!map?.getSource(ROUTE_SCRUB_SOURCE_ID)) return;
	const source = map.getSource(ROUTE_SCRUB_SOURCE_ID) as GeoJSONSource;
	if (!coord) {
		source.setData({ type: "FeatureCollection" as const, features: [] });
		return;
	}
	source.setData({
		type: "FeatureCollection" as const,
		features: [
			{
				type: "Feature" as const,
				properties: {},
				geometry: { type: "Point" as const, coordinates: coord },
			},
		],
	});
};

export const clearRouteScrubLayer = (map: MapboxMap): void => {
	updateRouteScrubLayer(map, null);
};
