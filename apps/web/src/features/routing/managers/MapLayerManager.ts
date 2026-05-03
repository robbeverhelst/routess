import type { Waypoint } from "@routess/core";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { Logger } from "@/lib/logger";
import type { Coordinate } from "@/types/map";

export const ROUTE_SOURCE_ID = "route";
export const ROUTE_LAYER_ID = "route";
export const ROUTE_HOVER_LAYER_ID = "route-hover-target";
export const WAYPOINTS_SOURCE_ID = "points";
export const WAYPOINTS_LAYER_ID = "points";
export const USER_LOCATION_SOURCE_ID = "user-location-point";
export const USER_LOCATION_HALO_LAYER_ID = "user-location-halo";
export const USER_LOCATION_POINT_LAYER_ID = "user-location-point";
export const KM_MARKERS_SOURCE_ID = "km-markers";
export const KM_MARKERS_LAYER_ID = "km-markers";
export const TEMP_DRAG_LINES_SOURCE_ID = "temp-drag-lines";
export const TEMP_DRAG_LINES_LAYER_ID = "temp-drag-lines";
export const ROUTE_CASING_LAYER_ID = "route-casing";
export const WAYPOINTS_SHADOW_LAYER_ID = "waypoints-shadow";
export const ROUTE_ARROWS_LAYER_ID = "route-arrows";

// Configuration for kilometer marker visibility based on zoom levels.
// Assumes GeoJSON features for markers will have a 'markerType' property
// ('major', 'medium', 'minor').
const KM_MARKER_VISIBILITY_CONFIG = {
	minZoomToShowAny: 8, // Zoom level below which no km markers are shown.
	majorMarkerMinZoom: 8, // Zoom level from which 'major' (e.g., multiples of 10km) markers are shown.
	mediumMarkerMinZoom: 10, // Zoom level from which 'medium' (e.g., multiples of 5km) markers are shown.
	minorMarkerMinZoom: 12, // Zoom level from which 'minor' (e.g., 1km, 2km) markers are shown.
};

// Configuration for waypoint dynamic sizing based on zoom levels
const WAYPOINT_SCALING_CONFIG = {
	zoomStops: [
		// [zoomLevel, radius, shadowRadiusOffset, strokeWidth]
		[6, 1, 1, 0.5], // Very small at low zoom
		[8, 2, 1.5, 0.75], // Small
		[10, 4, 2, 1], // Medium-small
		[12, 6, 2.5, 1.5], // Default/Medium (current default is radius 6, shadow 8)
		[14, 8, 3, 2], // Large
		[16, 10, 3.5, 2.5], // Very large at high zoom
	],
};

export const initializeSourcesAndLayers = (map: MapboxMap): void => {
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
				"line-color": "#003366",
				"line-width": 6,
				"line-opacity": 0.2,
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
				"line-width": 12,
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
				"line-opacity": 0.75,
				"line-color": [
					"case",
					["boolean", ["feature-state", "hover"], false],
					"#FF8C00", // DarkOrange for hover
					"#3887be", // Default color
				],
				"line-width": [
					"case",
					["boolean", ["feature-state", "hover"], false],
					6, // Wider line on hover
					3, // Default width
				],
				"line-emissive-strength": 1, // Make line color ignore map lighting
			},
		});

		map.addLayer({
			id: ROUTE_ARROWS_LAYER_ID,
			type: "symbol",
			source: ROUTE_SOURCE_ID,
			layout: {
				"symbol-placement": "line",
				"symbol-spacing": [
					"interpolate",
					["linear"],
					["zoom"],
					5,
					30, // Very dense at zoom 5
					12,
					100, // Still very dense up to zoom 12
					14,
					300, // Maintained from previous 'good' setting (zoom 14)
					18,
					400, // Maintained for deeper zoom (zoom 18)
				],
				"text-field": "▶",
				"text-size": [
					"interpolate",
					["linear"],
					["zoom"],
					10,
					12, // Larger base size at low zoom
					14,
					18, // Scaled size at mid zoom
					18,
					24, // Larger size at high zoom
				],
				"text-allow-overlap": true,
				"text-ignore-placement": true,
				"text-rotation-alignment": "map",
				"text-pitch-alignment": "map",
				"text-keep-upright": false, // Allow text to rotate with the line
				visibility: "visible",
			},
			paint: {
				"text-color": "#FFFFFF",
				"text-halo-color": "#3887be",
				"text-halo-width": 0.75, // Slightly increased halo for better definition
				"text-opacity": 0.9,
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
				"circle-radius": [
					"interpolate",
					["linear"],
					["zoom"],
					...WAYPOINT_SCALING_CONFIG.zoomStops.flatMap((stop) => [stop[0], stop[1] + stop[2]]), // stop[1] is radius, stop[2] is shadowOffset
				],
				"circle-color": "#000",
				"circle-opacity": 0.4,
				"circle-translate": [1, 1],
			},
		});
		map.addLayer({
			id: WAYPOINTS_LAYER_ID,
			type: "circle",
			source: WAYPOINTS_SOURCE_ID,
			paint: {
				"circle-radius": [
					"interpolate",
					["linear"],
					["zoom"],
					...WAYPOINT_SCALING_CONFIG.zoomStops.flatMap((stop) => [stop[0], stop[1]]), // stop[1] is radius
				],
				"circle-color": [
					"match",
					["get", "pointType"],
					"start",
					"#2ecc71",
					"end",
					"#e74c3c",
					"direct",
					"#f1c40f",
					"#3887be", // intermediate/other
				],
				"circle-stroke-width": [
					"interpolate",
					["linear"],
					["zoom"],
					...WAYPOINT_SCALING_CONFIG.zoomStops.flatMap((stop) => [stop[0], stop[3]]), // stop[3] is strokeWidth
				],
				"circle-stroke-color": "#fff",
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
				"circle-color": "#007cbf",
				"circle-opacity": 0.2,
				"circle-stroke-width": 0,
			},
		});
		map.addLayer({
			id: USER_LOCATION_POINT_LAYER_ID,
			type: "circle",
			source: USER_LOCATION_SOURCE_ID,
			paint: {
				"circle-radius": 8,
				"circle-color": "#007cbf",
				"circle-stroke-width": 2,
				"circle-stroke-color": "#ffffff",
				"circle-opacity": 0.8,
			},
		});
	}

	// Kilometre Markers
	// Ensure the source exists
	if (!map.getSource(KM_MARKERS_SOURCE_ID)) {
		map.addSource(KM_MARKERS_SOURCE_ID, {
			type: "geojson",
			data: { type: "FeatureCollection", features: [] },
		});
	}

	// Remove the layer if it already exists to ensure style updates
	if (map.getLayer(KM_MARKERS_LAYER_ID)) {
		map.removeLayer(KM_MARKERS_LAYER_ID);
	}
	// Add the kilometer markers layer with the updated styling
	map.addLayer({
		id: KM_MARKERS_LAYER_ID,
		type: "symbol",
		source: KM_MARKERS_SOURCE_ID,
		layout: {
			"text-field": ["get", "km"],
			"text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"], // Use a clear, slightly bold font
			"text-size": 11, // Balanced text size
			"text-anchor": "bottom", // Anchor text at its bottom
			"text-offset": [0, -0.75], // Offset text 0.75em upwards from the point
			"text-allow-overlap": true, // Allow text to overlap if necessary (density controlled by filters)
			"text-ignore-placement": false, // Default, let Mapbox attempt to avoid collisions first
			"symbol-placement": "point", // Markers are points
		},
		paint: {
			"text-color": "#FFFFFF", // White text for good contrast
			"text-halo-color": "rgba(0, 0, 0, 0.8)", // Strong dark halo (black, 80% opacity)
			"text-halo-width": 1.2, // Crisp halo width
			"text-halo-blur": 0, // No blur for sharp edges
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
			paint: { "line-color": "#3887be", "line-width": 3, "line-opacity": 0.75 },
		});
	}
	Logger.info("[MapLayerManager] All sources and layers initialized (if not already present).");
};

export const updateWaypointsLayer = (map: MapboxMap, waypoints: Waypoint[], isMapLocked: boolean): void => {
	if (!map || !map.getSource(WAYPOINTS_SOURCE_ID)) return;

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
			properties: { pointType, waypointIndex: originalIndex },
			geometry: { type: "Point" as const, coordinates: wp.coord },
		};
	});

	const source = map.getSource(WAYPOINTS_SOURCE_ID) as GeoJSONSource;
	source.setData({ type: "FeatureCollection" as const, features });
};

export const updateUserLocationLayer = (map: MapboxMap, coordinates: Coordinate | null): void => {
	if (!map || !map.getSource(USER_LOCATION_SOURCE_ID)) return;
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

export const updateRouteLayer = (map: MapboxMap, routeCoordinates: Coordinate[]): void => {
	if (!map || !map.getSource(ROUTE_SOURCE_ID)) return;
	const source = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource;
	source.setData({
		type: "Feature" as const,
		id: "main_route_line",
		properties: {},
		geometry: { type: "LineString" as const, coordinates: routeCoordinates },
	});
};

export const updateKilometerMarkersLayer = (
	map: MapboxMap,
	kmMarkerFeatures: GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>[],
): void => {
	if (!map || !map.getSource(KM_MARKERS_SOURCE_ID)) return;
	const source = map.getSource(KM_MARKERS_SOURCE_ID) as GeoJSONSource;
	source.setData({ type: "FeatureCollection" as const, features: kmMarkerFeatures });
};

export const updateDragLinesLayer = (map: MapboxMap, dragLineFeatures: GeoJSON.Feature<GeoJSON.LineString>[]): void => {
	if (!map || !map.getSource(TEMP_DRAG_LINES_SOURCE_ID)) return;
	const source = map.getSource(TEMP_DRAG_LINES_SOURCE_ID) as GeoJSONSource;
	source.setData({ type: "FeatureCollection" as const, features: dragLineFeatures });
};

export const clearRouteLayer = (map: MapboxMap): void => {
	if (!map || !map.getSource(ROUTE_SOURCE_ID)) return;
	const source = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource;
	source.setData({
		type: "Feature" as const,
		id: "main_route_line",
		properties: {},
		geometry: { type: "LineString", coordinates: [] },
	});
};

export const clearKilometerMarkersLayer = (map: MapboxMap): void => {
	if (!map || !map.getSource(KM_MARKERS_SOURCE_ID)) return;
	const source = map.getSource(KM_MARKERS_SOURCE_ID) as GeoJSONSource;
	source.setData({ type: "FeatureCollection" as const, features: [] });
};
