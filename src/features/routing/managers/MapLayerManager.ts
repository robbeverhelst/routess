import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
import type { Coordinate } from '@/types/map';

export const ROUTE_SOURCE_ID = 'route';
export const ROUTE_LAYER_ID = 'route';
export const ROUTE_HOVER_LAYER_ID = 'route-hover-target';
export const WAYPOINTS_SOURCE_ID = 'points';
export const WAYPOINTS_LAYER_ID = 'points';
export const USER_LOCATION_SOURCE_ID = 'user-location-point';
export const USER_LOCATION_HALO_LAYER_ID = 'user-location-halo';
export const USER_LOCATION_POINT_LAYER_ID = 'user-location-point';
export const KM_MARKERS_SOURCE_ID = 'km-markers';
export const KM_MARKERS_LAYER_ID = 'km-markers';
export const TEMP_DRAG_LINES_SOURCE_ID = 'temp-drag-lines';
export const TEMP_DRAG_LINES_LAYER_ID = 'temp-drag-lines';
export const ROUTE_CASING_LAYER_ID = 'route-casing';
export const WAYPOINTS_SHADOW_LAYER_ID = 'waypoints-shadow';
export const ROUTE_ARROWS_LAYER_ID = 'route-arrows';

// Configuration for kilometer marker visibility based on zoom levels.
// Assumes GeoJSON features for markers will have a 'markerType' property
// ('major', 'medium', 'minor').
const KM_MARKER_VISIBILITY_CONFIG = {
  minZoomToShowAny: 8,    // Zoom level below which no km markers are shown.
  majorMarkerMinZoom: 8,  // Zoom level from which 'major' (e.g., multiples of 10km) markers are shown.
  mediumMarkerMinZoom: 10, // Zoom level from which 'medium' (e.g., multiples of 5km) markers are shown.
  minorMarkerMinZoom: 12   // Zoom level from which 'minor' (e.g., 1km, 2km) markers are shown.
};

// Configuration for waypoint dynamic sizing based on zoom levels
const WAYPOINT_SCALING_CONFIG = {
  zoomStops: [
    // [zoomLevel, radius, shadowRadiusOffset, strokeWidth]
    [6, 1, 1, 0.5],   // Very small at low zoom
    [8, 2, 1.5, 0.75], // Small
    [10, 4, 2, 1],    // Medium-small
    [12, 6, 2.5, 1.5], // Default/Medium (current default is radius 6, shadow 8)
    [14, 8, 3, 2],    // Large
    [16, 10, 3.5, 2.5] // Very large at high zoom
  ]
};

export const initializeSourcesAndLayers = (map: MapboxMap): void => {
  if (!map.getSource(ROUTE_SOURCE_ID)) {
    map.addSource(ROUTE_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'Feature', id: 'main_route_line', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
    });
    map.addLayer({
      id: ROUTE_CASING_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#003366', 'line-width': 6, 'line-opacity': 0.2 }
    });
    map.addLayer({
      id: ROUTE_HOVER_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#000', 'line-width': 12, 'line-opacity': 0 }
    });
    map.addLayer({
      id: ROUTE_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-opacity': 0.75,
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          '#FF8C00', // DarkOrange for hover
          '#3887be'  // Default color
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          6, // Wider line on hover
          3  // Default width
        ]
      }
    });

    map.addLayer({
      id: ROUTE_ARROWS_LAYER_ID,
      type: 'symbol',
      source: ROUTE_SOURCE_ID,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5, 30,   // Very dense at zoom 5
          12, 100,  // Still very dense up to zoom 12
          14, 300, // Maintained from previous 'good' setting (zoom 14)
          18, 400  // Maintained for deeper zoom (zoom 18)
        ],
        'text-field': '▶', 
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 12, // Larger base size at low zoom
          14, 18, // Scaled size at mid zoom
          18, 24  // Larger size at high zoom
        ],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-rotation-alignment': 'map',
        'text-pitch-alignment': 'map', 
        'text-keep-upright': false, // Allow text to rotate with the line
        'visibility': 'visible'
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#3887be', 
        'text-halo-width': 0.75, // Slightly increased halo for better definition
        'text-opacity': 0.9
      }
    });
  }

  if (!map.getSource(WAYPOINTS_SOURCE_ID)) {
    map.addSource(WAYPOINTS_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    map.addLayer({
      id: WAYPOINTS_SHADOW_LAYER_ID,
      type: 'circle',
      source: WAYPOINTS_SOURCE_ID,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          ...WAYPOINT_SCALING_CONFIG.zoomStops.flatMap(stop => [stop[0], stop[1] + stop[2]]) // stop[1] is radius, stop[2] is shadowOffset
        ],
        'circle-color': '#000',
        'circle-opacity': 0.4,
        'circle-translate': [1, 1]
      }
    });
    map.addLayer({
      id: WAYPOINTS_LAYER_ID,
      type: 'circle',
      source: WAYPOINTS_SOURCE_ID,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          ...WAYPOINT_SCALING_CONFIG.zoomStops.flatMap(stop => [stop[0], stop[1]]) // stop[1] is radius
        ],
        'circle-color': [
          'match',
          ['get', 'pointType'],
          'start', '#2ecc71',
          'end', '#e74c3c',
          'direct', '#f1c40f',
          '#3887be' // intermediate/other
        ],
        'circle-stroke-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          ...WAYPOINT_SCALING_CONFIG.zoomStops.flatMap(stop => [stop[0], stop[3]]) // stop[3] is strokeWidth
        ],
        'circle-stroke-color': '#fff'
      }
    });
  }

  if (!map.getSource(USER_LOCATION_SOURCE_ID)) {
    map.addSource(USER_LOCATION_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    map.addLayer({
      id: USER_LOCATION_HALO_LAYER_ID,
      type: 'circle',
      source: USER_LOCATION_SOURCE_ID,
      paint: { 'circle-radius': 16, 'circle-color': '#007cbf', 'circle-opacity': 0.2, 'circle-stroke-width': 0 }
    });
    map.addLayer({
      id: USER_LOCATION_POINT_LAYER_ID,
      type: 'circle',
      source: USER_LOCATION_SOURCE_ID,
      paint: { 'circle-radius': 8, 'circle-color': '#007cbf', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.8 }
    });
  }

  if (!map.getSource(KM_MARKERS_SOURCE_ID)) {
    map.addSource(KM_MARKERS_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    map.addLayer({
      id: KM_MARKERS_LAYER_ID,
      type: 'symbol',
      source: KM_MARKERS_SOURCE_ID,
      layout: {
        'text-field': ['get', 'km'], // Assumes 'km' property on feature provides the label text
        'text-size': 12,
        'text-offset': [0, -1.5],
        'text-anchor': 'bottom',
        'icon-image': 'circle-11', // Standard Mapbox icon
        'icon-size': 0.75,
        'icon-allow-overlap': true, // Kept true; filtering logic primarily controls density
        'text-allow-overlap': true  // Kept true for the same reason
      },
      paint: {
        'text-color': '#000',
        'text-halo-color': '#fff',
        'text-halo-width': 2
      },
      // Filter to control marker visibility based on zoom level and markerType.
      // Features must have a 'markerType' property ('major', 'medium', 'minor').
      filter: [
        'all',
        ['>=', ['zoom'], KM_MARKER_VISIBILITY_CONFIG.minZoomToShowAny],
        [
          'any',
          ['all', ['==', ['get', 'markerType'], 'major'], ['>=', ['zoom'], KM_MARKER_VISIBILITY_CONFIG.majorMarkerMinZoom]],
          ['all', ['==', ['get', 'markerType'], 'medium'], ['>=', ['zoom'], KM_MARKER_VISIBILITY_CONFIG.mediumMarkerMinZoom]],
          ['all', ['==', ['get', 'markerType'], 'minor'], ['>=', ['zoom'], KM_MARKER_VISIBILITY_CONFIG.minorMarkerMinZoom]]
        ]
      ]
    });
  }

  if (!map.getSource(TEMP_DRAG_LINES_SOURCE_ID)) {
    map.addSource(TEMP_DRAG_LINES_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    map.addLayer({
      id: TEMP_DRAG_LINES_LAYER_ID,
      type: 'line',
      source: TEMP_DRAG_LINES_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#3887be', 'line-width': 3, 'line-opacity': 0.75 }
    });
  }
  console.log('[MapLayerManager] All sources and layers initialized (if not already present).');
};

export const updateWaypointsLayer = (map: MapboxMap, points: Coordinate[], isMapLocked: boolean): void => {
  if (!map || !map.getSource(WAYPOINTS_SOURCE_ID)) return;

  let pointsToRender = points;
  if (isMapLocked && points.length > 2) {
    // When locked, only show the first and last waypoints
    pointsToRender = [points[0], points[points.length - 1]];
  }

  const features = pointsToRender.map((point, index, arr) => {
    let pointType = 'intermediate';
    if (arr.length === 1) pointType = 'start';
    else if (index === 0) pointType = 'start';
    else if (index === arr.length - 1) pointType = 'end';
    
    return {
      type: 'Feature' as const,
      properties: { pointType, waypointIndex: points.indexOf(point) }, // Use original index for potential future needs, though not strictly required by current spec
      geometry: { type: 'Point' as const, coordinates: point }
    };
  });

  const source = map.getSource(WAYPOINTS_SOURCE_ID) as GeoJSONSource;
  source.setData({ type: 'FeatureCollection' as const, features });
};

export const updateUserLocationLayer = (map: MapboxMap, coordinates: Coordinate | null): void => {
  if (!map || !map.getSource(USER_LOCATION_SOURCE_ID)) return;
  const features = [];
  if (coordinates) {
    features.push({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Point' as const, coordinates: coordinates }
    });
  }
  const source = map.getSource(USER_LOCATION_SOURCE_ID) as GeoJSONSource;
  source.setData({ type: 'FeatureCollection' as const, features });
};

export const updateRouteLayer = (map: MapboxMap, routeCoordinates: Coordinate[]): void => {
  if (!map || !map.getSource(ROUTE_SOURCE_ID)) return;
  const source = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource;
  source.setData({
    type: 'Feature' as const,
    id: 'main_route_line',
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: routeCoordinates }
  });
};

export const updateKilometerMarkersLayer = (map: MapboxMap, kmMarkerFeatures: GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>[]): void => {
  if (!map || !map.getSource(KM_MARKERS_SOURCE_ID)) return;
  const source = map.getSource(KM_MARKERS_SOURCE_ID) as GeoJSONSource;
  source.setData({ type: 'FeatureCollection' as const, features: kmMarkerFeatures });
};

export const updateDragLinesLayer = (map: MapboxMap, dragLineFeatures: GeoJSON.Feature<GeoJSON.LineString>[]): void => {
  if (!map || !map.getSource(TEMP_DRAG_LINES_SOURCE_ID)) return;
  const source = map.getSource(TEMP_DRAG_LINES_SOURCE_ID) as GeoJSONSource;
  source.setData({ type: 'FeatureCollection' as const, features: dragLineFeatures });
};

export const clearRouteLayer = (map: MapboxMap): void => {
  if (!map || !map.getSource(ROUTE_SOURCE_ID)) return;
  const source = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource;
  source.setData({
    type: 'Feature' as const, 
    id: 'main_route_line',
    properties: {}, 
    geometry: { type: 'LineString', coordinates: [] }
  });
};

export const clearKilometerMarkersLayer = (map: MapboxMap): void => {
  if (!map || !map.getSource(KM_MARKERS_SOURCE_ID)) return;
  const source = map.getSource(KM_MARKERS_SOURCE_ID) as GeoJSONSource;
  source.setData({ type: 'FeatureCollection' as const, features: [] });
}; 