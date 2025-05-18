// src/features/routing/managers/MapInteractionManager.ts
// This manager will handle direct map interactions such as clicks, context menus, and dragging.

// Imports will be added as logic is moved in.

import type { Dispatch, SetStateAction } from 'react';
import type { Coordinate } from '@/types/map';
import type { Map as MapboxMap, MapMouseEvent, MapTouchEvent, MapLayerMouseEvent } from 'mapbox-gl';
// Removed MapboxPopup import as we're using React-based popups via callback

// Functions from routing.ts or other managers will be imported here
import { 
  getWaypoints, 
  addWaypoint, 
  updateWaypointPositionAndRecalculate,
  insertWaypointAtLocation // Added import
} from '@/features/routing/managers/WaypointManager';
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
  TEMP_DRAG_LINES_LAYER_ID,
  ROUTE_SOURCE_ID       // Added for setFeatureState
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

// To store the ID of the hovered route feature for highlighting
let hoveredRouteFeatureId: string | number | undefined = undefined;

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
    if (e.defaultPrevented) {
      console.log('[MapInteractionManager] Click event default prevented, likely due to drag. Ignoring.');
      return;
    }
    // Check if the click was on an existing waypoint or other interactive route feature
    const features = map.queryRenderedFeatures(e.point, { 
      layers: [WAYPOINTS_LAYER_ID, ROUTE_LAYER_ID, TEMP_DRAG_LINES_LAYER_ID, ROUTE_HOVER_LAYER_ID]
    });

    if (features.length > 0) {
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

  map.on('click', handleMapClickInternal);
  console.log('[MapInteractionManager] Unified map click listener added.');


  // --- ON CONTEXT MENU LOGIC ---
  const handleContextMenuInternal = (e: MapMouseEvent | MapTouchEvent) => {
    e.preventDefault();
    console.log('[MapInteractionManager] Context menu event at:', e.lngLat);

    let eventPointXY: { x: number; y: number };
    if (e.type === 'contextmenu' && 'point' in e) { 
      eventPointXY = (e as MapMouseEvent).point;
    } else if (('type' in e && (e.type === 'touchstart' || e.type === 'touchend' || e.type === 'touchcancel')) && 'points' in e ) { 
      eventPointXY = (e as MapTouchEvent).points[0];
    } else {
      if ('points' in e && e.points.length > 0) {
         eventPointXY = e.points[0];
      } else if ('point' in e) {
         eventPointXY = e.point; 
      } else {
        console.error('[MapInteractionManager] Could not determine event point for context menu.');
        return;
      }
    }

    const pointFeatures = map.queryRenderedFeatures([eventPointXY.x, eventPointXY.y], { layers: [WAYPOINTS_LAYER_ID] });
    
    if (pointFeatures && pointFeatures.length > 0) {
      const feature = pointFeatures[0];
      const idxRaw = feature.properties?.waypointIndex;
      const idx = typeof idxRaw === 'string' ? parseInt(idxRaw, 10) : typeof idxRaw === 'number' ? idxRaw : -1;
      
      if (isNaN(idx) || idx < 0 || idx >= getWaypoints().length || idx === -1) {
        console.error('[MapInteractionManager] Invalid waypoint index on context click:', idxRaw);
        setPopup(null); 
        return;
      }
      setPopup({
        longitude: e.lngLat.lng,
        latitude: e.lngLat.lat,
        type: 'remove',
        waypointIndex: idx
      });
    } else {
      const routeFeatures = map.queryRenderedFeatures([eventPointXY.x, eventPointXY.y], { layers: [ROUTE_HOVER_LAYER_ID, ROUTE_LAYER_ID] });
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
  
  map.on('contextmenu', handleContextMenuInternal);
  console.log('[MapInteractionManager] Map context menu listener added.');

  // --- GENERAL MOUSE DOWN HANDLER (for dragging existing waypoints or creating new ones on route) ---
  const generalMouseDownHandler = async (e: MapMouseEvent) => {
    // Only respond to left mouse button for drag initiation
    if (e.originalEvent.button !== 0) {
      return;
    }

    // Query for features at the click point
    const features = map.queryRenderedFeatures(e.point, { layers: [WAYPOINTS_LAYER_ID, ROUTE_LAYER_ID, ROUTE_HOVER_LAYER_ID] });
    const waypointFeature = features.find(f => f.layer && f.layer.id === WAYPOINTS_LAYER_ID);
    const routeFeature = features.find(f => f.layer && (f.layer.id === ROUTE_LAYER_ID || f.layer.id === ROUTE_HOVER_LAYER_ID) && (!waypointFeature || f !== waypointFeature));

    if (waypointFeature && waypointFeature.properties) {
      const idxRaw = waypointFeature.properties.waypointIndex;
      const idx = typeof idxRaw === 'string' ? parseInt(idxRaw, 10) : typeof idxRaw === 'number' ? idxRaw : -1;

      if (idx !== -1 && !isNaN(idx) && idx < getWaypoints().length) {
        e.preventDefault(); // Prevent map drag, text selection, etc.
        map.dragPan.disable();
        
        isDragging = true;
        draggedWaypointIndex = idx;
        currentLngLat = [e.lngLat.lng, e.lngLat.lat]; // Store initial position
        mapCanvas.style.cursor = 'grabbing';
        console.log(`[MapInteractionManager] Mousedown on waypoint ${idx}, starting drag.`);

        // Attach move and up listeners
        map.on('mousemove', onMapMouseMoveForDrag);
        map.on('mouseup', onMapMouseUpInternal);
      }
    } else if (routeFeature) {
      console.log('[MapInteractionManager] Mousedown on route. Attempting to insert and drag new waypoint.');
      e.preventDefault(); // Prevent map drag

      const result = await insertWaypointAtLocation(
        map,
        [e.lngLat.lng, e.lngLat.lat],
        accessToken,
        setRouteDistance,
        setRouteDuration,
        setHasRoute,
        handleWaypointError
      );

      if (result.success && typeof result.newIndex === 'number') {
        map.dragPan.disable();
        isDragging = true;
        draggedWaypointIndex = result.newIndex;
        // For a new point, the visual feedback for drag lines starts from its actual (potentially snapped) position.
        // insertWaypointAtLocation adds it. getWaypoints() will include it.
        // The currentLngLat should be the point to drag from.
        const newWpCoords = getWaypoints()[result.newIndex];
        currentLngLat = newWpCoords ? [...newWpCoords] as Coordinate : [e.lngLat.lng, e.lngLat.lat];
        mapCanvas.style.cursor = 'grabbing';
        console.log(`[MapInteractionManager] New waypoint ${result.newIndex} inserted on route, starting drag from`, currentLngLat);
        
        // Attach move and up listeners
        map.on('mousemove', onMapMouseMoveForDrag);
        map.on('mouseup', onMapMouseUpInternal);
      } else {
        console.warn('[MapInteractionManager] Failed to insert waypoint on route for dragging.', result.error);
        // Potentially call handleWaypointError(result.error) if not already handled by insertWaypointAtLocation's onError
      }
    }
    // If not on a waypoint or route, do nothing, allow default map drag
  };

  map.on('mousedown', generalMouseDownHandler);
  console.log('[MapInteractionManager] General mousedown listener added.');


  // --- LONG PRESS & TOUCH LOGIC ---
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
      const routeFeatures = map.queryRenderedFeatures([point.x, point.y], { layers: [ROUTE_HOVER_LAYER_ID, ROUTE_LAYER_ID] });
      if (routeFeatures && routeFeatures.length > 0 && getWaypoints().length >=1) {
        setPopup({ longitude: lngLat.lng, latitude: lngLat.lat, type: 'add_on_route' });
      } else {
        setPopup({ longitude: lngLat.lng, latitude: lngLat.lat, type: 'direct' });
      }
    }
  };

  // --- GENERAL TOUCH START HANDLER (analogous to generalMouseDownHandler) ---
  const generalTouchStartHandler = async (e: MapTouchEvent) => {
    if (e.points.length !== 1) return; // Only handle single touch
    
    const features = map.queryRenderedFeatures(e.points[0], { layers: [WAYPOINTS_LAYER_ID, ROUTE_LAYER_ID, ROUTE_HOVER_LAYER_ID] });
    const waypointFeature = features.find(f => f.layer && f.layer.id === WAYPOINTS_LAYER_ID);
    const routeFeature = features.find(f => f.layer && (f.layer.id === ROUTE_LAYER_ID || f.layer.id === ROUTE_HOVER_LAYER_ID) && (!waypointFeature || f !== waypointFeature));

    // Common logic for touch start on interactive element
    const startInteractiveTouch = (isNewWaypointInsertion: boolean = false) => {
      e.preventDefault(); // Prevent map pan/zoom, and also click events if drag occurs.
      map.dragPan.disable();
      map.touchZoomRotate.disable();
      // For new waypoints, currentLngLat will be set after insertion.
      // For existing, it's e.lngLat
      if (!isNewWaypointInsertion) {
        currentLngLat = [e.lngLat.lng, e.lngLat.lat];
      }
      mapCanvas.style.cursor = 'grabbing'; // Less relevant for touch but consistent
    };

    if (waypointFeature && waypointFeature.properties) {
      const idxRaw = waypointFeature.properties.waypointIndex;
      const idx = typeof idxRaw === 'string' ? parseInt(idxRaw, 10) : typeof idxRaw === 'number' ? idxRaw : -1;

      if (idx !== -1 && !isNaN(idx) && idx < getWaypoints().length) {
        startInteractiveTouch();
        isDragging = true;
        draggedWaypointIndex = idx;
        console.log(`[MapInteractionManager] Touchstart on waypoint ${idx}, starting drag.`);
        map.on('touchmove', onMapTouchMoveForDrag);
        map.on('touchend', onMapTouchEndInternal);
        map.on('touchcancel', onMapTouchEndInternal); // Also handle cancel
      }
    } else if (routeFeature) {
      console.log('[MapInteractionManager] Touchstart on route. Attempting to insert and drag new waypoint.');
      // Note: For touch, usually long press opens context menu.
      // A direct touch-and-drag-to-create-waypoint might conflict with map panning if not careful.
      // Here, we assume a touchstart on a route *could* initiate a drag-to-create.
      // If this feels too sensitive, it could be gated behind a short delay or specific gesture.
      
      // To prevent immediate map pan, we call preventDefault early.
      // However, this also means a simple tap on the route won't trigger 'click' for other purposes if we e.preventDefault() here.
      // The current 'click' handler already filters by features, so a tap on route (if not dragging) won't add a waypoint there.

      // Let's try inserting then starting drag.
      // This logic mirrors generalMouseDownHandler.
      e.preventDefault(); // Prevent map pan/zoom if we decide to drag.

      const result = await insertWaypointAtLocation(
        map,
        [e.lngLat.lng, e.lngLat.lat],
        accessToken,
        setRouteDistance,
        setRouteDuration,
        setHasRoute,
        handleWaypointError
      );

      if (result.success && typeof result.newIndex === 'number') {
        startInteractiveTouch(true); // Pass true as it's a new waypoint
        isDragging = true;
        draggedWaypointIndex = result.newIndex;
        console.log(`[MapInteractionManager] New waypoint ${result.newIndex} inserted on route (touch), starting drag from`, currentLngLat);
        map.on('touchmove', onMapTouchMoveForDrag);
        map.on('touchend', onMapTouchEndInternal);
        map.on('touchcancel', onMapTouchEndInternal);
      } else {
        console.warn('[MapInteractionManager] Failed to insert waypoint on route for touch-dragging.', result.error);
        // If insertion fails, re-enable pan/zoom as we might have prematurely disabled it.
        // However, since insertWaypointAtLocation is async, this is tricky.
        // Better: only call disable() *after* successful insertion.
        // For now, this structure mirrors mouse down. If it causes issues with map interaction on failed touch-insert,
        // we'll need to refine when map.dragPan.disable() and touchZoomRotate.disable() are called.
        // The e.preventDefault() is still important to stop the map from moving *during* the async operation.
      }

    } else {
      // Handle long press for context menu on empty space
      // (This part is from existing touch handlers, adapted)
      if (longPressTimeoutRef) clearTimeout(longPressTimeoutRef);
      touchStartPos = e.points[0]; // Store touch start position for move threshold check
      longPressTimeoutRef = window.setTimeout(() => {
        longPressTimeoutRef = null;
        if (touchStartPos) { // Check if touch hasn't ended or moved too much
          handleLongPressInternal(e.lngLat, e.points[0]);
        }
      }, LONG_PRESS_DURATION);
    }
  };
  
  map.on('touchstart', generalTouchStartHandler);
  console.log('[MapInteractionManager] General touchstart listener added.');


  // --- DRAG MOVE HANDLERS (largely unchanged, ensure they use module-scoped drag state) ---
  const onMapMouseMoveForDrag = (eMove: MapMouseEvent) => {
    if (!isDragging || draggedWaypointIndex === -1) return;
    eMove.preventDefault(); // Prevent text selection, etc.

    currentLngLat = [eMove.lngLat.lng, eMove.lngLat.lat];
    mapCanvas.style.cursor = 'grabbing';

    // Update the visual drag lines
    const waypoints = getWaypoints();
    const dragLineFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    const prevWaypoint = waypoints[draggedWaypointIndex - 1];
    const nextWaypoint = waypoints[draggedWaypointIndex + 1];

    if (prevWaypoint && currentLngLat) {
      dragLineFeatures.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [prevWaypoint, currentLngLat] }});
    }
    if (nextWaypoint && currentLngLat) {
      dragLineFeatures.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [currentLngLat, nextWaypoint] }});
    }
    console.log('[MapInteractionManager] Drag line features (mouse):', JSON.stringify(dragLineFeatures)); // Diagnostic log
    updateDragLinesLayer(map, dragLineFeatures);

    // Optional: Throttled update of the actual waypoint position and route for live preview
    // For now, full update happens on mouseup/touchend.
  };

  const onMapTouchMoveForDrag = (eMove: MapTouchEvent) => {
    if (!isDragging || draggedWaypointIndex === -1 || eMove.points.length !== 1) return;
    eMove.preventDefault();

    currentLngLat = [eMove.lngLat.lng, eMove.lngLat.lat];
    // mapCanvas.style.cursor = 'grabbing'; // Less relevant for touch

    const waypoints = getWaypoints();
    const dragLineFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    const prevWaypoint = waypoints[draggedWaypointIndex - 1];
    const nextWaypoint = waypoints[draggedWaypointIndex + 1];

    if (prevWaypoint && currentLngLat) {
      dragLineFeatures.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [prevWaypoint, currentLngLat] }});
    }
    if (nextWaypoint && currentLngLat) {
      dragLineFeatures.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [currentLngLat, nextWaypoint] }});
    }
    console.log('[MapInteractionManager] Drag line features (touch):', JSON.stringify(dragLineFeatures)); // Diagnostic log
    updateDragLinesLayer(map, dragLineFeatures);
  };


  // --- DRAG END HANDLERS (largely unchanged, ensure they use module-scoped drag state and call service) ---
  const onMapMouseUpInternal = async () => {
    if (!isDragging || draggedWaypointIndex === -1 || !currentLngLat) {
      // If not dragging but mouseup happened after mousedown, ensure pan is enabled
      if (!isDragging) map.dragPan.enable();
      return;
    }

    map.off('mousemove', onMapMouseMoveForDrag);
    map.off('mouseup', onMapMouseUpInternal);
    map.dragPan.enable();
    mapCanvas.style.cursor = '';

    console.log(`[MapInteractionManager] Mouseup: Drag ended for waypoint ${draggedWaypointIndex} at`, currentLngLat);
    
    // Check if currentLngLat is materially different from original before snapshot and update
    // This prevents unnecessary updates if it was just a click.
    // However, insertWaypointAtLocation already happened on mousedown for new points.
    // For existing points, this check is valid.
    // For newly inserted points, updateWaypointPositionAndRecalculate will still run.
    
    // Snapshot before updating the waypoint position permanently
    snapshot(); 
    await updateWaypointPositionAndRecalculate(
      map,
      draggedWaypointIndex,
      currentLngLat,
      accessToken,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
      handleWaypointError
    );
    
    isDragging = false;
    draggedWaypointIndex = -1;
    currentLngLat = null;
    updateDragLinesLayer(map, []); // Clear drag lines
  };

  const onMapTouchEndInternal = async () => {
    if (longPressTimeoutRef) { // If a long press was pending, clear it
      clearTimeout(longPressTimeoutRef);
      longPressTimeoutRef = null;
    }
    touchStartPos = null; // Reset long press tracking

    if (!isDragging || draggedWaypointIndex === -1 || !currentLngLat) {
      // Ensure map interactions are re-enabled if drag didn't actually happen or was for a different purpose
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      mapCanvas.style.cursor = ''; // Reset cursor if it was changed
      return;
    }
    
    map.off('touchmove', onMapTouchMoveForDrag);
    map.off('touchend', onMapTouchEndInternal);
    map.off('touchcancel', onMapTouchEndInternal);
    map.dragPan.enable();
    map.touchZoomRotate.enable();
    mapCanvas.style.cursor = '';

    console.log(`[MapInteractionManager] Touchend: Drag ended for waypoint ${draggedWaypointIndex} at`, currentLngLat);

    snapshot();
    await updateWaypointPositionAndRecalculate(
      map,
      draggedWaypointIndex,
      currentLngLat,
      accessToken,
      setRouteDistance,
      setRouteDuration,
      setHasRoute,
      handleWaypointError
    );

    isDragging = false;
    draggedWaypointIndex = -1;
    currentLngLat = null;
    updateDragLinesLayer(map, []); // Clear drag lines
  };


  // --- POINTER MOVE FOR LONG PRESS DETECTION (adapted from existing) ---
  const handlePointerMoveInternal = (e: MapTouchEvent | MapMouseEvent) => {
    if (!touchStartPos || !longPressTimeoutRef) return;

    let currentPos: { x: number; y: number };
    if ('points' in e) { // MapTouchEvent
        if (e.points.length !== 1) { // If multi-touch, cancel long press
            clearTimeout(longPressTimeoutRef);
            longPressTimeoutRef = null;
            touchStartPos = null;
            return;
        }
        currentPos = e.points[0];
    } else { // MapMouseEvent (though long press is typically touch)
        currentPos = e.point;
    }

    const deltaX = Math.abs(currentPos.x - touchStartPos.x);
    const deltaY = Math.abs(currentPos.y - touchStartPos.y);

    if (deltaX > MAX_MOVE_THRESHOLD || deltaY > MAX_MOVE_THRESHOLD) {
      if (longPressTimeoutRef) clearTimeout(longPressTimeoutRef);
      longPressTimeoutRef = null;
      touchStartPos = null;
    }
  };

  map.on('touchmove', handlePointerMoveInternal as (ev: MapTouchEvent | MapMouseEvent) => void); // For long press cancellation
  map.on('mousemove', handlePointerMoveInternal as (ev: MapTouchEvent | MapMouseEvent) => void); // Also for mouse if we want consistent long press (though unusual)
  // Note: The 'mousemove' for long press cancellation is a bit unconventional but makes the logic shareable.
  // Typically long press is touch-only.

  // --- ROUTE HOVER HIGHLIGHTING ---
  const mouseEnterRouteHandler = (e: MapLayerMouseEvent) => {
    if (map.dragPan.isActive()) return; // Check if map is being actively panned by drag
    if (e.features && e.features.length > 0) {
      map.getCanvas().style.cursor = 'pointer';
      const feature = e.features[0];
      // Use ROUTE_SOURCE_ID for feature state
      // The feature itself might not have an .id if the source GeoJSON doesn't provide it
      // or if generateId was not true on the source. For a single LineString feature,
      // we might need a predefined ID or rely on Mapbox assigning one (if generateId=true).
      // For now, assuming 'route' source, and MapLayerManager will handle feature IDing for state.
      if (hoveredRouteFeatureId !== undefined && feature.source && feature.id !== hoveredRouteFeatureId) {
         map.removeFeatureState({ source: feature.source, id: hoveredRouteFeatureId }, 'hover');
      }
      hoveredRouteFeatureId = feature.id ?? 'main_route_line'; // Fallback ID if feature.id is undefined
      if (feature.source && hoveredRouteFeatureId) {
        map.setFeatureState({ source: feature.source, id: hoveredRouteFeatureId }, { hover: true });
      }
    }
  };

  const mouseLeaveRouteHandler = () => { // No event needed if we just clear based on module-scoped ID
    map.getCanvas().style.cursor = '';
    if (hoveredRouteFeatureId !== undefined) {
      // Assuming the source is ROUTE_SOURCE_ID
      // Check if map is still loaded, source exists etc.
      if (map.getSource(ROUTE_SOURCE_ID)) {
        map.removeFeatureState({ source: ROUTE_SOURCE_ID, id: hoveredRouteFeatureId }, 'hover');
      }
      hoveredRouteFeatureId = undefined;
    }
  };

  // Attach hover listeners to the visually prominent route layer (e.g., ROUTE_HOVER_LAYER_ID or ROUTE_LAYER_ID)
  // ROUTE_HOVER_LAYER_ID is often a slightly thicker, transparent layer on top, good for hit detection.
  // Or, if ROUTE_LAYER_ID is styled to change on hover via feature state, use that.
  // Let's use ROUTE_LAYER_ID for the hover state change, assuming it's styled appropriately.
  map.on('mouseenter', ROUTE_LAYER_ID, mouseEnterRouteHandler);
  map.on('mouseleave', ROUTE_LAYER_ID, mouseLeaveRouteHandler);
  console.log('[MapInteractionManager] Route hover listeners added to', ROUTE_LAYER_ID);

  // --- Disposer function to clean up all listeners ---
  return () => {
    console.log('[MapInteractionManager] Disposing map interaction listeners.');
    map.off('click', handleMapClickInternal);
    map.off('contextmenu', handleContextMenuInternal);
    
    map.off('mousedown', generalMouseDownHandler);
    // map.off('mousemove', onMapMouseMoveForDrag); // Removed here, managed by mouseup/touchend
    // map.off('mouseup', onMapMouseUpInternal); // Removed here, managed by mouseup/touchend

    map.off('touchstart', generalTouchStartHandler);
    // map.off('touchmove', onMapTouchMoveForDrag); // Removed here, managed by mouseup/touchend
    // map.off('touchend', onMapTouchEndInternal); // Removed here, managed by mouseup/touchend
    // map.off('touchcancel', onMapTouchEndInternal); // Removed here, managed by mouseup/touchend
    
    // Clean up long press related move listeners
    map.off('touchmove', handlePointerMoveInternal as (ev: MapTouchEvent | MapMouseEvent) => void);
    map.off('mousemove', handlePointerMoveInternal as (ev: MapTouchEvent | MapMouseEvent) => void);
    if (longPressTimeoutRef) clearTimeout(longPressTimeoutRef);

    // Clean up route hover listeners
    map.off('mouseenter', ROUTE_LAYER_ID, mouseEnterRouteHandler);
    map.off('mouseleave', ROUTE_LAYER_ID, mouseLeaveRouteHandler);

    // Ensure any lingering drag state is reset (though should be handled by up/end events)
    isDragging = false;
    draggedWaypointIndex = -1;
    currentLngLat = null;
    mapCanvas.style.cursor = '';
    map.dragPan.enable(); // Ensure map interactions are re-enabled
    map.touchZoomRotate.enable();
    
    // Clear any feature state if set
    if (hoveredRouteFeatureId !== undefined && map.getSource(ROUTE_SOURCE_ID)) {
        map.removeFeatureState({ source: ROUTE_SOURCE_ID, id: hoveredRouteFeatureId }, 'hover'); // Assuming 'route' source
        hoveredRouteFeatureId = undefined;
    }
    console.log('[MapInteractionManager] All interaction listeners and states reset.');
  };
};

// Functions like mouseDownOnWaypointHandler, touchStartOnWaypointHandler, onMapMouseMoveForDrag, onMapMouseUpInternal etc.
// are now either part of the general handlers or remain as helper callbacks for those general handlers.
// The old direct layer-specific mousedown/touchstart listeners are removed.

// Ensure updateDragLinesLayer is correctly imported and used.
// WAYPOINTS_LAYER_ID and ROUTE_LAYER_ID/ROUTE_HOVER_LAYER_ID are critical.

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