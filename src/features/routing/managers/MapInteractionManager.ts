// src/features/routing/managers/MapInteractionManager.ts
// This manager will handle direct map interactions such as clicks, context menus, and dragging.

// Imports will be added as logic is moved in.

import type { Dispatch, SetStateAction } from 'react';
import type { Coordinate } from '@/types/map';
import type { Map as MapboxMap, MapMouseEvent, MapTouchEvent, MapLayerMouseEvent } from 'mapbox-gl';
import { Popup as MapboxPopup } from 'mapbox-gl';

// Functions from routing.ts or other managers will be imported here
import { addWaypoint, updateWaypointPositionAndRecalculate, insertWaypointAtLocation } from '@/lib/routing';
import { getWaypoints } from '@/features/routing/managers/WaypointManager';
import { snapshot } from '@/features/routing/managers/HistoryManager';
// TODO: Correct import for snapshot if it's separate from getWaypoints
// For now, let's assume getWaypoints and snapshot come from a combined manager or routing.ts temporarily
// For snapshot: import { snapshot } from '@/features/routing/managers/HistoryManager';
// For getWaypoints: import { getWaypoints } from '@/features/routing/managers/WaypointManager';

// Assuming updateDragLinesLayer will be moved to MapLayerManager or similar
// For now, direct import if it was part of routing.ts or its own module.
// import { updateDragLinesLayer } from '@/lib/routing'; // Placeholder
// We need a concrete definition or import for updateDragLinesLayer & WAYPOINTS_LAYER_ID
// For now, I will define them locally as placeholders if not directly available for import.

import {
  updateDragLinesLayer, 
  WAYPOINTS_LAYER_ID, 
  ROUTE_HOVER_LAYER_ID,
} from '@/features/routing/managers/MapLayerManager';

let currentPopup: MapboxPopup | null = null;
let clickListenerAdded = false;
let contextMenuListenerAdded = false;

// Drag state variables
let isDragging = false;
let draggedWaypointIndex = -1;
let currentLngLat: Coordinate | null = null; // Used by mouse and touch drag handlers

export const initializeMapInteractions = (
  map: MapboxMap,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
) => {
  const mapCanvas = map.getCanvas();

  // --- ON MAP CLICK LOGIC (from previous step) ---
  const onMapClick = async (e: MapMouseEvent) => {
    if (currentPopup && currentPopup.isOpen()) {
      const popupEl = currentPopup.getElement();
      const targetElement = e.originalEvent.target as HTMLElement | null;
      if (popupEl && popupEl.contains(targetElement)) {
        console.log('[MapInteractionManager.onMapClick] Clicked inside an open popup. Ignoring map click.');
        return;
      }
      console.log('[MapInteractionManager.onMapClick] Clicked outside an open popup. Closing popup.');
      currentPopup.remove();
      currentPopup = null;
      return; 
    }

    try {
      const coords = [e.lngLat.lng, e.lngLat.lat] as Coordinate;
      console.log('[MapInteractionManager.onMapClick] Adding regular waypoint at:', coords);
      await addWaypoint(
        map,
        coords,
        false, // isDirect is false for a normal map click
        accessToken,
        setRouteDistance,
        setRouteDuration,
        setHasRoute,
        (errorMsg) => console.error(`[MapInteractionManager.onMapClick] Error adding waypoint: ${errorMsg}`)
      );
    } catch (error) {
      console.error('[MapInteractionManager.onMapClick] Critical error in click handler:', error);
    }
  };

  if (!clickListenerAdded) {
    map.on('click', onMapClick);
    clickListenerAdded = true;
    console.log('[MapInteractionManager] Map click listener added.');
  }

  // --- ON CONTEXT MENU LOGIC ---
  const onContextMenu = (e: MapMouseEvent | MapTouchEvent) => {
    e.preventDefault(); // Prevent browser context menu

    // Clear any existing Mapbox GL JS popup managed by this service
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }
    // The UI for context menu actions (like adding direct waypoint or removing a waypoint)
    // is now handled by the React component (MapWithRouting.tsx) which sets its own popup state.
    // This handler primarily ensures the default browser context menu is prevented.
    console.log('[MapInteractionManager.onContextMenu] Context menu event. Default prevented. Component handles UI.');
  };

  if (!contextMenuListenerAdded) {
    map.on('contextmenu', onContextMenu);
    contextMenuListenerAdded = true;
    console.log('[MapInteractionManager] Map context menu listener added.');
  }

  // --- WAYPOINT DRAGGING LOGIC ---
  map.on('mouseenter', WAYPOINTS_LAYER_ID, () => {
    mapCanvas.style.cursor = 'move';
  });
  map.on('mouseleave', WAYPOINTS_LAYER_ID, () => {
    mapCanvas.style.cursor = '';
  });

  map.on('mousedown', WAYPOINTS_LAYER_ID, (e: MapMouseEvent) => {
    if (e.originalEvent.button !== 0) return; // Only main button
    e.preventDefault();
    mapCanvas.style.cursor = 'grab';

    const features = map.queryRenderedFeatures(e.point, { layers: [WAYPOINTS_LAYER_ID] });
    if (!features.length) return;

    const clickedFeature = features[0];
    if (clickedFeature.properties && typeof clickedFeature.properties.waypointIndex === 'number') {
      draggedWaypointIndex = clickedFeature.properties.waypointIndex;
      isDragging = true;
      map.dragPan.disable();
      snapshot(); // Correctly call snapshot

      const waypoints = getWaypoints(); // Correctly call getWaypoints
      const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
      if (draggedWaypointIndex > 0 && waypoints[draggedWaypointIndex - 1]) {
        lines.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [waypoints[draggedWaypointIndex - 1], e.lngLat.toArray() as Coordinate] }
        });
      }
      if (draggedWaypointIndex < waypoints.length - 1 && waypoints[draggedWaypointIndex + 1]) {
        lines.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [e.lngLat.toArray() as Coordinate, waypoints[draggedWaypointIndex + 1]] }
        });
      }
      updateDragLinesLayer(map, lines); // Placeholder for now
    }
  });

  const onMapMouseMoveInternal = (eMove: MapMouseEvent) => {
    currentLngLat = eMove.lngLat.toArray() as Coordinate;
    if (!isDragging || draggedWaypointIndex === -1) return;

    mapCanvas.style.cursor = 'grabbing';
    const coords = currentLngLat;
    const waypoints = getWaypoints(); // TODO: Import getWaypoints
    const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];

    if (draggedWaypointIndex > 0 && waypoints[draggedWaypointIndex - 1]) {
      lines.push({
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: [waypoints[draggedWaypointIndex - 1], coords] }
      });
    }
    if (draggedWaypointIndex < waypoints.length - 1 && waypoints[draggedWaypointIndex + 1]) {
      lines.push({
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: [coords, waypoints[draggedWaypointIndex + 1]] }
      });
    }
    updateDragLinesLayer(map, lines); // Placeholder
  };

  const onMapMouseUp = async () => {
    if (!isDragging || draggedWaypointIndex === -1) return;
    mapCanvas.style.cursor = '';
    isDragging = false;
    map.dragPan.enable();
    updateDragLinesLayer(map, []); // Clear drag lines

    if (currentLngLat) {
      try {
        console.log(`[MapInteractionManager] Drag ended. Updating waypoint ${draggedWaypointIndex} to new position:`, currentLngLat);
        // snapshot(); // Take snapshot before updating (after drag operation is confirmed)
        await updateWaypointPositionAndRecalculate(
          map,
          draggedWaypointIndex,
          currentLngLat,
          accessToken,
          setRouteDistance,
          setRouteDuration,
          setHasRoute
        );
      } catch (error) {
        console.error('[MapInteractionManager] Error updating waypoint position after drag:', error);
      } finally {
        draggedWaypointIndex = -1;
        currentLngLat = null;
      }
    } else {
      console.warn('[MapInteractionManager] onMapMouseUp: currentLngLat is not set, cannot update waypoint.');
      draggedWaypointIndex = -1; // Reset index even if currentLngLat is null
    }
  };

  map.on('mousemove', onMapMouseMoveInternal);
  map.on('mouseup', onMapMouseUp); // Also consider mouseleave from map container for safety

  // --- Touch equivalents for dragging ---
  map.on('touchstart', WAYPOINTS_LAYER_ID, (e: MapTouchEvent) => {
    if (e.originalEvent.touches.length !== 1) return;
    e.preventDefault(); // Prevent default touch actions like scrolling page
    mapCanvas.style.cursor = 'grab';
    const features = map.queryRenderedFeatures(e.point, { layers: [WAYPOINTS_LAYER_ID] });
    if (!features.length) return;

    const clickedFeature = features[0];
    if (clickedFeature.properties && typeof clickedFeature.properties.waypointIndex === 'number') {
      draggedWaypointIndex = clickedFeature.properties.waypointIndex;
      isDragging = true;
      map.dragPan.disable();
      snapshot(); // Correctly call snapshot
      currentLngLat = e.lngLat.toArray() as Coordinate; // Initial position for drag lines

      const waypoints = getWaypoints(); // Correctly call getWaypoints
      const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
      if (draggedWaypointIndex > 0 && waypoints[draggedWaypointIndex - 1]) {
        lines.push({
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: [waypoints[draggedWaypointIndex - 1], currentLngLat] }
        });
      }
      if (draggedWaypointIndex < waypoints.length - 1 && waypoints[draggedWaypointIndex + 1]) {
        lines.push({
          type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: [currentLngLat, waypoints[draggedWaypointIndex + 1]] }
        });
      }
      updateDragLinesLayer(map, lines); // Placeholder
    }
  });

  const onMapTouchMove = (eMove: MapTouchEvent) => {
    if (eMove.originalEvent.touches.length !== 1 || !isDragging || draggedWaypointIndex === -1) return;
    eMove.preventDefault(); // Prevent scrolling while dragging point
    currentLngLat = eMove.lngLat.toArray() as Coordinate;
    mapCanvas.style.cursor = 'grabbing';

    const coords = currentLngLat;
    const waypoints = getWaypoints(); // TODO: Import getWaypoints
    const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    if (draggedWaypointIndex > 0 && waypoints[draggedWaypointIndex - 1]) {
      lines.push({
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: [waypoints[draggedWaypointIndex - 1], coords] }
      });
    }
    if (draggedWaypointIndex < waypoints.length - 1 && waypoints[draggedWaypointIndex + 1]) {
      lines.push({
        type: 'Feature', properties: {},
        geometry: { type: 'LineString', coordinates: [coords, waypoints[draggedWaypointIndex + 1]] }
      });
    }
    updateDragLinesLayer(map, lines); // Placeholder
  };

  const onMapTouchEnd = async () => {
    if (!isDragging || draggedWaypointIndex === -1) return;
    mapCanvas.style.cursor = '';
    isDragging = false;
    map.dragPan.enable();
    updateDragLinesLayer(map, []); // Clear drag lines

    if (currentLngLat) {
      try {
        console.log(`[MapInteractionManager] Touch drag ended. Updating waypoint ${draggedWaypointIndex} to new position:`, currentLngLat);
        // snapshot(); // Take snapshot before updating
        await updateWaypointPositionAndRecalculate(
          map,
          draggedWaypointIndex,
          currentLngLat,
          accessToken,
          setRouteDistance,
          setRouteDuration,
          setHasRoute
        );
      } catch (error) {
        console.error('[MapInteractionManager] Error updating waypoint position after touch drag:', error);
      } finally {
        draggedWaypointIndex = -1;
        currentLngLat = null;
      }
    } else {
      console.warn('[MapInteractionManager] onMapTouchEnd: currentLngLat is not set, cannot update waypoint.');
      draggedWaypointIndex = -1;
    }
  };

  map.on('touchmove', onMapTouchMove);
  map.on('touchend', onMapTouchEnd);
  map.on('touchcancel', onMapTouchEnd); // Also handle touchcancel for safety

  // --- ROUTE HOVER LAYER INTERACTIONS ---
  map.on('mouseenter', ROUTE_HOVER_LAYER_ID, () => {
    map.getCanvas().style.cursor = 'copy';
  });
  map.on('mouseleave', ROUTE_HOVER_LAYER_ID, () => {
    map.getCanvas().style.cursor = '';
  });

  map.on('click', ROUTE_HOVER_LAYER_ID, async (e: MapLayerMouseEvent) => {
    console.log('[MapInteractionManager] Clicked on route hover layer to insert waypoint.');
    if (e.features && e.features.length > 0) {
      const clickedPoint = e.lngLat.toArray() as Coordinate;
      // Prevent adding waypoint if click was on an existing waypoint feature on this layer
      if (e.features.some(f => f.layer && f.layer.id === WAYPOINTS_LAYER_ID)) {
          console.log('[MapInteractionManager] Click on route hover layer was also on a waypoint, ignoring for insertWaypointAtLocation.');
          return;
      }
      console.log('[MapInteractionManager] Clicked LngLat for new waypoint:', clickedPoint);
      try {
        // Snapshot is not typically taken before insertWaypointAtLocation as it has its own snapshot
        await insertWaypointAtLocation(
          map,
          clickedPoint,
          accessToken,
          setRouteDistance,
          setRouteDuration,
          setHasRoute,
          (errorMessage) => { console.error(`[MapInteractionManager] Error inserting waypoint on route: ${errorMessage}`); }
        );
      } catch (error) {
        console.error('[MapInteractionManager] Failed to insert waypoint on route click:', error);
      }
    }
  });
}; 