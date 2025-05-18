// src/features/routing/managers/MapInteractionManager.ts
// This manager will handle direct map interactions such as clicks, context menus, and dragging.

// Imports will be added as logic is moved in.

import type { Dispatch, SetStateAction } from 'react';
import type { Coordinate } from '@/types/map';
import type { Map as MapboxMap, MapMouseEvent, MapTouchEvent, MapLayerMouseEvent } from 'mapbox-gl';
// Removed MapboxPopup import as we're using React-based popups via callback

// Functions from routing.ts or other managers will be imported here
import { getWaypoints, addWaypoint, updateWaypointPositionAndRecalculate } from '@/features/routing/managers/WaypointManager';
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
  ROUTE_LAYER_ID,
  TEMP_DRAG_LINES_LAYER_ID
} from '@/features/routing/managers/MapLayerManager';

// Define PopupInfo structure (mirroring what's in MapPopup.tsx and MapWithRouting.tsx)
// Ideally, this would be a shared type.
export interface PopupInfo {
  longitude: number;
  latitude: number;
  type: 'direct' | 'remove' | 'info' | 'add_on_route';
  waypointIndex?: number;
  message?: string;
}

// Listener flags removed - will be handled by disposer pattern
// let clickListenerAttached = false;
// let contextMenuListenerAttached = false;
// let touchInteractionListenersAttached = false; // For long press and related touch events

// Drag state variables - these are fine as module-scoped as they manage ongoing interaction state
let isDragging = false;
let draggedWaypointIndex = -1;
let currentLngLat: Coordinate | null = null;

// Long press detection variables
let longPressTimeoutRef: number | null = null; // NodeJS.Timeout changed to number for window.setTimeout
let touchStartPos: { x: number; y: number } | null = null;
const LONG_PRESS_DURATION = 750; // ms
const MAX_MOVE_THRESHOLD = 10; // pixels

export const initializeMapInteractions = (
  map: MapboxMap,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  setPopup: Dispatch<SetStateAction<PopupInfo | null>>,
  handleWaypointError: (message: string | null) => void
): () => void => { // Return a disposer function
  const mapCanvas = map.getCanvas();

  // --- ON MAP CLICK LOGIC ---
  const handleMapClickInternal = (e: MapMouseEvent) => {
    // Check if the click was on an existing waypoint or other interactive route feature
    const features = map.queryRenderedFeatures(e.point, { 
      layers: [WAYPOINTS_LAYER_ID, ROUTE_LAYER_ID, TEMP_DRAG_LINES_LAYER_ID]
    });

    // If click is on an existing waypoint or route element, do not add a new waypoint.
    // Dragging waypoints is handled by mousedown/touchstart listeners.
    // Clearing popup here might be too aggressive if a popup related to these features is desired.
    // For now, if a feature is hit, we assume other interactions (drag, context menu) handle it.
    if (features.length > 0) {
      // Optionally, one could clear a generic 'info' popup if it's not related to the feature.
      // For now, let's only clear if no feature is hit, to be safe.
      // Or, always clear if the click is not on the popup itself.
      // The current behavior is: if you click map, popup clears.
      // If we want to preserve popup if clicking on a feature, this needs more nuanced logic.
      // Let's stick to: clear popup, then *maybe* add waypoint.
      console.log('[MapInteractionManager] Clicked on existing feature. Popup cleared. No new waypoint added.', features.map(f => f.layer?.id).filter(id => id !== undefined));
      setPopup(null); 
      return; 
    }

    console.log('[MapInteractionManager] Map click on empty area. Clearing popup and adding waypoint.', e.lngLat);
    setPopup(null); 

    addWaypoint(
      map,
      [e.lngLat.lng, e.lngLat.lat],
      false, // isDirect = false for left click
      accessToken,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
      handleWaypointError
    );
  };

  // map.off('click', handleMapClickInternal); // Remove existing before adding - no longer needed with disposer
  map.on('click', handleMapClickInternal);
  // clickListenerAttached = true; // Flag removed
  console.log('[MapInteractionManager] Unified map click listener (for clearing React popup) added.');


  // --- ON CONTEXT MENU LOGIC (from MapWithRouting.tsx) ---
  const handleContextMenuInternal = (e: MapMouseEvent | MapTouchEvent) => {
    e.preventDefault();
    console.log('[MapInteractionManager] Context menu event at:', e.lngLat);

    let eventPointXY: { x: number; y: number };
    if (e.type === 'contextmenu' && 'point' in e) { // MapMouseEvent
      eventPointXY = (e as MapMouseEvent).point;
    } else if (('type' in e && (e.type === 'touchstart' || e.type === 'touchend' || e.type === 'touchcancel')) && 'points' in e ) { // MapTouchEvent
      eventPointXY = (e as MapTouchEvent).points[0];
    } else {
      // Fallback or error if type is unexpected, though contextmenu is usually MapMouseEvent
      // For safety, if it is a MapTouchEvent from a contextmenu listener somehow, use points[0]
      if ('points' in e && e.points.length > 0) {
         eventPointXY = e.points[0];
      } else if ('point' in e) {
         eventPointXY = e.point; // Should be covered by first case
      } else {
        console.error('[MapInteractionManager] Could not determine event point for context menu.');
        return;
      }
    }

    // Check for waypoints first
    const pointFeatures = map.queryRenderedFeatures([eventPointXY.x, eventPointXY.y], { layers: [WAYPOINTS_LAYER_ID] });
    
    if (pointFeatures && pointFeatures.length > 0) {
      const feature = pointFeatures[0];
      const idxRaw = feature.properties?.waypointIndex;
      const idx = typeof idxRaw === 'string' ? parseInt(idxRaw, 10) : idxRaw;
      
      if (isNaN(idx) || idx < 0 || idx >= getWaypoints().length) {
        console.error('[MapInteractionManager] Invalid waypoint index on context click:', idxRaw);
        setPopup(null); // Clear any previous popup
        return;
      }
      setPopup({
        longitude: e.lngLat.lng,
        latitude: e.lngLat.lat,
        type: 'remove',
        waypointIndex: idx
      });
    } else {
      // Not on a waypoint, check if on the route
      const routeFeatures = map.queryRenderedFeatures([eventPointXY.x, eventPointXY.y], { layers: [ROUTE_HOVER_LAYER_ID] });
      if (routeFeatures && routeFeatures.length > 0 && getWaypoints().length >=1 ) {
        setPopup({
          longitude: e.lngLat.lng,
          latitude: e.lngLat.lat,
          type: 'add_on_route'
        });
      } else {
        setPopup({
          longitude: e.lngLat.lng,
          latitude: e.lngLat.lat,
          type: 'direct'
        });
      }
    }
  };
  
  // map.off('contextmenu', handleContextMenuInternal); // Remove if pre-existing - no longer needed with disposer
  map.on('contextmenu', handleContextMenuInternal);
  // contextMenuListenerAttached = true; // Flag removed
  console.log('[MapInteractionManager] Map context menu listener (for React popup) added.');


  // --- LONG PRESS & TOUCH LOGIC (from MapWithRouting.tsx) ---
  const handleLongPressInternal = (lngLat: { lng: number; lat: number }, point: { x: number; y: number }) => {
    console.log('[MapInteractionManager] Long press at:', lngLat);
    // This logic is identical to handleContextMenuInternal for determining what popup to show
    const pointFeatures = map.queryRenderedFeatures([point.x, point.y], { layers: [WAYPOINTS_LAYER_ID] });
    if (pointFeatures && pointFeatures.length > 0) {
      const feature = pointFeatures[0];
      const idxRaw = feature.properties?.waypointIndex;
      const idx = typeof idxRaw === 'string' ? parseInt(idxRaw, 10) : typeof idxRaw === 'number' ? idxRaw : -1;
      if (idx === -1 || isNaN(idx) || idx < 0 || idx >= getWaypoints().length) {
        console.error('[MapInteractionManager] Invalid waypoint index on long press:', idxRaw);
        setPopup(null);
        return;
      }
      setPopup({ longitude: lngLat.lng, latitude: lngLat.lat, type: 'remove', waypointIndex: idx });
    } else {
      const routeFeatures = map.queryRenderedFeatures([point.x, point.y], { layers: [ROUTE_HOVER_LAYER_ID] });
      if (routeFeatures && routeFeatures.length > 0 && getWaypoints().length >=1) {
        setPopup({ longitude: lngLat.lng, latitude: lngLat.lat, type: 'add_on_route' });
      } else {
        setPopup({ longitude: lngLat.lng, latitude: lngLat.lat, type: 'direct' });
      }
    }
  };

  const handleTouchStartInternal = (e: MapTouchEvent) => {
    if (e.points.length > 1) {
      if (longPressTimeoutRef) clearTimeout(longPressTimeoutRef);
      longPressTimeoutRef = null;
      touchStartPos = null;
      return;
    }
    touchStartPos = { x: e.point.x, y: e.point.y };
    if (longPressTimeoutRef) clearTimeout(longPressTimeoutRef);
    longPressTimeoutRef = window.setTimeout(() => {
      if (touchStartPos) { // Check if touch is still active and hasn't moved much
        handleLongPressInternal(e.lngLat, e.point);
      }
      longPressTimeoutRef = null;
      touchStartPos = null; 
    }, LONG_PRESS_DURATION);
  };

  const handleTouchEndInternal = () => {
    if (longPressTimeoutRef) clearTimeout(longPressTimeoutRef);
    longPressTimeoutRef = null;
    touchStartPos = null;
  };

  const handlePointerMoveInternal = (e: MapTouchEvent | MapMouseEvent) => {
    let currentPoint: { x: number; y: number };
    let currentPointsLength: number;

    if ('points' in e) { // TouchEvent
      currentPoint = e.point; 
      currentPointsLength = e.points.length;
    } else { // MouseEvent
      currentPoint = e.point;
      currentPointsLength = 1; 
    }

    if (!touchStartPos || currentPointsLength > 1) {
      if (longPressTimeoutRef) clearTimeout(longPressTimeoutRef);
      longPressTimeoutRef = null;
      touchStartPos = null;
      return;
    }

    const dx = Math.abs(currentPoint.x - touchStartPos.x);
    const dy = Math.abs(currentPoint.y - touchStartPos.y);

    if (dx > MAX_MOVE_THRESHOLD || dy > MAX_MOVE_THRESHOLD) {
      if (longPressTimeoutRef) clearTimeout(longPressTimeoutRef);
      longPressTimeoutRef = null;
      touchStartPos = null;
    }
  };

  // Remove existing listeners before attaching new ones - no longer needed with disposer
  // map.off('touchstart', handleTouchStartInternal);
  // map.off('touchend', handleTouchEndInternal);
  // map.off('touchmove', handlePointerMoveInternal);
  // map.off('mousemove', handlePointerMoveInternal); 

  map.on('touchstart', handleTouchStartInternal);
  map.on('touchend', handleTouchEndInternal);
  map.on('touchmove', handlePointerMoveInternal);
  map.on('mousemove', handlePointerMoveInternal); // Mouse move should also cancel a pending long press

  // touchInteractionListenersAttached = true; // Flag removed
  console.log('[MapInteractionManager] Touch interaction listeners (for long press) added.');


  // --- WAYPOINT DRAGGING LOGIC (existing, ensure it coexists) ---
  // Important: The 'mousemove' listener for dragging is set below (onMapMouseMoveForDrag).
  // The handlePointerMoveInternal is for *cancelling* a long press if movement occurs.
  // They serve different purposes and should coexist. The drag-specific mousemove is only active *during* a drag.

  const mouseEnterWaypointHandler = () => { mapCanvas.style.cursor = 'move'; };
  const mouseLeaveWaypointHandler = () => { mapCanvas.style.cursor = ''; };

  map.on('mouseenter', WAYPOINTS_LAYER_ID, mouseEnterWaypointHandler);
  map.on('mouseleave', WAYPOINTS_LAYER_ID, mouseLeaveWaypointHandler);

  const mouseDownOnWaypointHandler = (e: MapLayerMouseEvent) => {
    if (e.originalEvent.button !== 0) return; 
    // Check if the click was on a waypoint; if so, initiate drag.
    // If not, the general map click (handleMapClickInternal) will handle it (e.g., clear popup).
    // This mousedown should only proceed if it's truly starting a drag on a waypoint.
    const features = map.queryRenderedFeatures(e.point, { layers: [WAYPOINTS_LAYER_ID] });
    if (!features.length) return; // Not on a waypoint feature

    e.preventDefault(); // Prevent text selection, etc.
    mapCanvas.style.cursor = 'grab';

    const clickedFeature = features[0];
    if (clickedFeature.properties && (typeof clickedFeature.properties.waypointIndex === 'number' || typeof clickedFeature.properties.waypointIndex === 'string')) {
      const waypointIndexRaw = clickedFeature.properties.waypointIndex;
      const parsedIndex = parseInt(String(waypointIndexRaw), 10);

      if (!isNaN(parsedIndex)) {
        draggedWaypointIndex = parsedIndex;
        isDragging = true;
        map.dragPan.disable();
        snapshot(); 

        const waypoints = getWaypoints(); 
        const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
        const currentDragPos = e.lngLat.toArray() as Coordinate;
        if (draggedWaypointIndex > 0 && waypoints[draggedWaypointIndex - 1]) {
          lines.push({
            type: 'Feature', properties: {},
            geometry: { type: 'LineString', coordinates: [waypoints[draggedWaypointIndex - 1], currentDragPos] }
          });
        }
        if (draggedWaypointIndex < waypoints.length - 1 && waypoints[draggedWaypointIndex + 1]) {
          lines.push({
            type: 'Feature', properties: {},
            geometry: { type: 'LineString', coordinates: [currentDragPos, waypoints[draggedWaypointIndex + 1]] }
          });
        }
        updateDragLinesLayer(map, lines);
      } else {
        console.warn('[MapInteractionManager] Could not parse waypointIndex on mousedown:', waypointIndexRaw);
      }
    }
  };
  map.on('mousedown', WAYPOINTS_LAYER_ID, mouseDownOnWaypointHandler);


  const onMapMouseMoveForDrag = (eMove: MapMouseEvent) => {
    if (!isDragging || draggedWaypointIndex === -1) return;
    
    // This is exclusively for waypoint dragging.
    // The other 'mousemove' (handlePointerMoveInternal) is for long-press cancellation.
    mapCanvas.style.cursor = 'grabbing';
    currentLngLat = eMove.lngLat.toArray() as Coordinate; // Update global currentLngLat for mouse drag
    const coords = currentLngLat;
    const waypoints = getWaypoints();
    const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];

    if (draggedWaypointIndex > 0 && waypoints[draggedWaypointIndex - 1]) {
      lines.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [waypoints[draggedWaypointIndex - 1], coords] }});
    }
    if (draggedWaypointIndex < waypoints.length - 1 && waypoints[draggedWaypointIndex + 1]) {
      lines.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [coords, waypoints[draggedWaypointIndex + 1]] }});
    }
    updateDragLinesLayer(map, lines);
  };
  
  // For simplicity, let onMapMouseMoveForDrag internally check `isDragging`.
  // map.off('mousemove', onMapMouseMoveForDrag); // Remove if existing - no longer needed
  map.on('mousemove', onMapMouseMoveForDrag);


  const onMapMouseUpInternal = async () => {
    if (!isDragging || draggedWaypointIndex === -1) return;
    mapCanvas.style.cursor = '';
    isDragging = false;
    map.dragPan.enable();
    updateDragLinesLayer(map, []); 

    if (currentLngLat) { // currentLngLat is updated by onMapMouseMoveForDrag
      try {
        await updateWaypointPositionAndRecalculate(
          map, draggedWaypointIndex, currentLngLat, accessToken,
          setRouteDistance, setRouteDuration, setHasRoute
        );
      } catch (error) {
        console.error('[MapInteractionManager] Error updating waypoint position after mouse drag:', error);
      } finally {
        draggedWaypointIndex = -1;
        currentLngLat = null;
      }
    } else {
      draggedWaypointIndex = -1; 
    }
  };
  // map.off('mouseup', onMapMouseUpInternal); // Remove if existing - no longer needed
  map.on('mouseup', onMapMouseUpInternal);


  // --- Touch equivalents for dragging (existing, ensure coexists) ---
  const touchStartOnWaypointHandler = (e: MapTouchEvent) => { // Corrected type to MapTouchEvent
    // Check if this touch is on a waypoint. If so, start drag.
    // The general touchstart (handleTouchStartInternal) handles long press initiation.
    // This one is specific to starting a drag on a waypoint.
    const features = map.queryRenderedFeatures([e.point.x, e.point.y], { layers: [WAYPOINTS_LAYER_ID] }); // Corrected e.point format
    if (!features.length) return; // Not on a waypoint, let general touchstart handle it.
    if (e.originalEvent.touches.length !== 1) return;

    e.preventDefault(); 
    mapCanvas.style.cursor = 'grab'; // Though cursor might not be visible on touch devices
    
    const clickedFeature = features[0];
    if (clickedFeature.properties && (typeof clickedFeature.properties.waypointIndex === 'number' || typeof clickedFeature.properties.waypointIndex === 'string')) {
      const waypointIndexRaw = clickedFeature.properties.waypointIndex;
      const parsedIndex = parseInt(String(waypointIndexRaw), 10);

      if (!isNaN(parsedIndex)) {
        draggedWaypointIndex = parsedIndex;
        isDragging = true;
        map.dragPan.disable();
        snapshot(); 
        currentLngLat = e.lngLat.toArray() as Coordinate; 

        const waypoints = getWaypoints(); 
        const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
        if (draggedWaypointIndex > 0 && waypoints[draggedWaypointIndex - 1]) {
          lines.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [waypoints[draggedWaypointIndex - 1], currentLngLat] }});
        }
        if (draggedWaypointIndex < waypoints.length - 1 && waypoints[draggedWaypointIndex + 1]) {
          lines.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [currentLngLat, waypoints[draggedWaypointIndex + 1]] }});
        }
        updateDragLinesLayer(map, lines);
      } else {
        console.warn('[MapInteractionManager] Could not parse waypointIndex on touchstart:', waypointIndexRaw);
      }
    }
  };
  map.on('touchstart', WAYPOINTS_LAYER_ID, touchStartOnWaypointHandler);


  const onMapTouchMoveForDrag = (eMove: MapTouchEvent) => {
    if (eMove.originalEvent.touches.length !== 1 || !isDragging || draggedWaypointIndex === -1) return;
    // This is exclusively for waypoint dragging with touch.
    eMove.preventDefault(); 
    currentLngLat = eMove.lngLat.toArray() as Coordinate; // Update global currentLngLat for touch drag
    mapCanvas.style.cursor = 'grabbing'; // For hybrid devices
    
    const coords = currentLngLat;
    const waypoints = getWaypoints();
    const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    if (draggedWaypointIndex > 0 && waypoints[draggedWaypointIndex - 1]) {
      lines.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [waypoints[draggedWaypointIndex - 1], coords] }});
    }
    if (draggedWaypointIndex < waypoints.length - 1 && waypoints[draggedWaypointIndex + 1]) {
      lines.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [coords, waypoints[draggedWaypointIndex + 1]] }});
    }
    updateDragLinesLayer(map, lines);
  };
  // map.off('touchmove', onMapTouchMoveForDrag); // Remove if existing - no longer needed
  map.on('touchmove', onMapTouchMoveForDrag);

  const onMapTouchEndInternal = async () => {
    if (!isDragging || draggedWaypointIndex === -1) return;
    // This is for ending a touch-based waypoint drag.
    mapCanvas.style.cursor = '';
    isDragging = false;
    map.dragPan.enable();
    updateDragLinesLayer(map, []);

    if (currentLngLat) { // currentLngLat is updated by onMapTouchMoveForDrag
      try {
        await updateWaypointPositionAndRecalculate(
          map, draggedWaypointIndex, currentLngLat, accessToken,
          setRouteDistance, setRouteDuration, setHasRoute
        );
      } catch (error) {
        console.error('[MapInteractionManager] Error updating waypoint position after touch drag:', error);
      } finally {
        draggedWaypointIndex = -1;
        currentLngLat = null;
      }
    } else {
      draggedWaypointIndex = -1;
    }
  };
  // map.off('touchend', onMapTouchEndInternal); // Remove if existing - no longer needed
  map.on('touchend', onMapTouchEndInternal);
  
  console.log('[MapInteractionManager] All map interaction listeners initialized/updated.');

  // Return a cleanup function
  return () => {
    map.off('click', handleMapClickInternal);
    map.off('contextmenu', handleContextMenuInternal);
    
    map.off('touchstart', handleTouchStartInternal); // General touch start for long press
    map.off('touchend', handleTouchEndInternal);   // General touch end for long press
    map.off('touchmove', handlePointerMoveInternal); // General touch move for long press cancellation
    map.off('mousemove', handlePointerMoveInternal); // General mouse move for long press cancellation

    map.off('mouseenter', WAYPOINTS_LAYER_ID, mouseEnterWaypointHandler);
    map.off('mouseleave', WAYPOINTS_LAYER_ID, mouseLeaveWaypointHandler);
    map.off('mousedown', WAYPOINTS_LAYER_ID, mouseDownOnWaypointHandler);
    map.off('mousemove', onMapMouseMoveForDrag); // Mouse move for drag
    map.off('mouseup', onMapMouseUpInternal);

    map.off('touchstart', WAYPOINTS_LAYER_ID, touchStartOnWaypointHandler); // Touch start on waypoint for drag
    map.off('touchmove', onMapTouchMoveForDrag); // Touch move for drag
    map.off('touchend', onMapTouchEndInternal);   // Touch end for drag

    console.log('[MapInteractionManager] All listeners for this map instance cleaned up.');
  };
};

// Cleanup function if ever needed - REMOVED as initializeMapInteractions now returns a disposer
// export const removeMapInteractions = (mapInstance: MapboxMap) => {
//   // Example: mapInstance.off('click', handleMapClickInternal);
//   // ... remove all listeners added in initializeMapInteractions
//   // This is a placeholder; a more robust cleanup would remove specific handlers for this mapInstance.
//   // The current listener flags are module-scoped and don't distinguish by map instance.
//   console.log('[MapInteractionManager] Listener cleanup placeholder. Map instance container ID:', mapInstance.getContainer().id);
//   clickListenerAttached = false; // These flags would need to be instance-specific for multi-map scenarios
//   contextMenuListenerAttached = false;
//   touchInteractionListenersAttached = false;
// }; 