import type { Map as MapboxMap, GeoJSONSource } from 'mapbox-gl';
import type { Coordinate } from '@/types/map';
// We might need getDirectFlags if point styling depends on it directly here
import { getDirectFlags } from '@/features/routing/managers/WaypointManager';

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

export const initializeSourcesAndLayers = (map: MapboxMap): void => {
  if (!map.getSource(ROUTE_SOURCE_ID)) {
    map.addSource(ROUTE_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
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
      paint: { 'line-color': '#3887be', 'line-width': 3, 'line-opacity': 0.75 }
    });
  }

  if (!map.getSource(WAYPOINTS_SOURCE_ID)) {
    map.addSource(WAYPOINTS_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    map.addLayer({
      id: WAYPOINTS_LAYER_ID,
      type: 'circle',
      source: WAYPOINTS_SOURCE_ID,
      paint: {
        'circle-radius': 6,
        'circle-color': [
          'match',
          ['get', 'pointType'],
          'start', '#2ecc71',
          'end', '#e74c3c',
          'direct', '#f1c40f',
          '#3887be' // intermediate/other
        ],
        'circle-stroke-width': 1.5,
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
      layout: { 'text-field': ['get', 'km'], 'text-size': 12, 'text-offset': [0, -1.5], 'text-anchor': 'bottom', 'icon-image': 'circle-11', 'icon-size': 0.75, 'icon-allow-overlap': true, 'text-allow-overlap': true },
      paint: { 'text-color': '#000', 'text-halo-color': '#fff', 'text-halo-width': 2 }
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

export const updateWaypointsLayer = (map: MapboxMap, points: Coordinate[]): void => {
  if (!map || !map.getSource(WAYPOINTS_SOURCE_ID)) return;

  const directFlags = getDirectFlags(); // Get current direct flags
  const features = points.map((point, index) => {
    let pointType = 'intermediate';
    if (points.length === 1) pointType = 'start';
    else if (index === 0) pointType = 'start';
    else if (index === points.length - 1) pointType = 'end';
    if (directFlags[index]) pointType = 'direct';

    return {
      type: 'Feature' as const,
      properties: { pointType, waypointIndex: index },
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
    type: 'Feature' as const, properties: {}, geometry: { type: 'LineString', coordinates: [] }
  });
};

export const clearKilometerMarkersLayer = (map: MapboxMap): void => {
  if (!map || !map.getSource(KM_MARKERS_SOURCE_ID)) return;
  const source = map.getSource(KM_MARKERS_SOURCE_ID) as GeoJSONSource;
  source.setData({ type: 'FeatureCollection' as const, features: [] });
}; 