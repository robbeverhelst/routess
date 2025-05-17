import type { Dispatch, SetStateAction } from 'react';
import type { Coordinate, WaypointHistory } from '@/types/map';
import type { Map as MapboxMap, Popup, MapMouseEvent, MapLayerMouseEvent, GeoJSONSource, MapTouchEvent } from 'mapbox-gl';
import { LngLatBounds } from 'mapbox-gl'; // Added for fitBounds

// Store references and state outside of the setup function to persist across renders
let waypoints: Coordinate[] = [];
let clickListenerAdded = false;
let contextMenuListenerAdded = false; // Track context menu (right-click) handler
let currentPopup: Popup | null = null; // Track active popup for waypoint removal tooltip
let directFlags: boolean[] = []; // parallel to waypoints, true if waypoint is direct
let currentRoutePathCoordinates: Coordinate[] = []; // To store the detailed path for GPX export

// --- Local Storage ---
const WAYPOINTS_STORAGE_KEY = 'mapWaypoints';

// Function to save waypoints to local storage
const saveWaypointsToLocalStorage = () => {
  try {
    const data = JSON.stringify({ waypoints, directFlags });
    localStorage.setItem(WAYPOINTS_STORAGE_KEY, data);
    console.log('[LocalStorage] Saved waypoints to local storage');
  } catch (error) {
    console.error('[LocalStorage] Error saving waypoints to local storage:', error);
  }
};

// Function to load waypoints from local storage
const loadWaypointsFromLocalStorage = () => {
  try {
    const data = localStorage.getItem(WAYPOINTS_STORAGE_KEY);
    if (data) {
      const parsedData = JSON.parse(data);
      if (parsedData && parsedData.waypoints && parsedData.directFlags) {
        waypoints = parsedData.waypoints;
        directFlags = parsedData.directFlags;
        console.log('[LocalStorage] Loaded waypoints from local storage:', waypoints);
        return true;
      }
    }
  } catch (error) {
    console.error('[LocalStorage] Error loading waypoints from local storage:', error);
  }
  return false;
};

// --- Drag state ---
let isDragging = false;
let draggedWaypointIndex = -1;

// --- History (Undo / Redo) ---
let undoStack: WaypointHistory[] = [];
let redoStack: WaypointHistory[] = [];

// Export the waypoints and directFlags for external components to use
export const getWaypoints = () => waypoints;
export const getDirectFlags = () => directFlags; // Added export for directFlags

// Helper functions to check history availability
export const hasUndo = () => {
  const result = undoStack.length > 0;
  // console.log('[hasUndo] undoStack length:', undoStack.length, 'hasUndo:', result);
  return result;
};
export const hasRedo = () => redoStack.length > 0;

// Check if a coordinate is near a road
export const checkNearRoad = async (
  coords: Coordinate,
  accessToken: string
): Promise<{ isValid: boolean; snappedCoords?: Coordinate }> => {
  try {
    // Use Mapbox Matching API, treat single point as a zero-length segment for robustness
    const coordinatesParam = `${coords[0]},${coords[1]};${coords[0]},${coords[1]}`;
    // Matching API requires radius < 50m. Use 49m for each point of the segment.
    const radiusesParam = `49;49`; 
    const url = `https://api.mapbox.com/matching/v5/mapbox/walking/${coordinatesParam}?steps=true&geometries=geojson&access_token=${accessToken}&radiuses=${radiusesParam}`;
    
    const response = await fetch(url);
    const json = await response.json();

    console.log(`[checkNearRoad] Matching API call for ${coords[0]},${coords[1]} (radius 49m) responded with:`, JSON.stringify(json));

    if (json && json.code === "Ok" && json.tracepoints && json.tracepoints.length > 0) {
      const snappedTracepoint = json.tracepoints[0];
      if (snappedTracepoint === null) {
        console.log(`[checkNearRoad] Point ${coords[0]},${coords[1]} could not be matched by Matching API (tracepoint null).`);
        return { isValid: false };
      }

      const snappedCoords = snappedTracepoint.location as Coordinate;
      const dist = haversine(coords, snappedCoords);
      
      // Adjust distance check to be within the API's snapping capability (e.g. < 50m)
      if (dist > 0.05) { // 50 meters, consistent with radius limit
        console.log(`[checkNearRoad] Point snapped too far (${dist.toFixed(3)}km > 0.05km) by Matching API.`);
        return { isValid: false };
      }
      
      console.log(`[checkNearRoad] Point is valid (Matching API), snapped at ${dist.toFixed(3)}km distance`);
      return { 
        isValid: true,
        snappedCoords
      };
    } else {
      console.log(`[checkNearRoad] Matching API failed for ${coords[0]},${coords[1]}. Code: ${json.code}, Message: ${json.message}`);
      return { isValid: false };
    }
  } catch (error) {
    console.error('[checkNearRoad] Error calling Matching API:', error);
    return { isValid: false };
  }
};

// Function to add a new waypoint from an external component
export const addWaypoint = async (
  map: MapboxMap, 
  coords: Coordinate, 
  isDirect: boolean,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  onError?: (message: string) => void
) => {
  if (isDirect || waypoints.length === 0) {
    // Snapshot current state for undo
    snapshot();
    
    waypoints.push(coords);
    directFlags.push(isDirect);
    
    // Update the visual representation on the map
    updatePoints(map, waypoints);
    
    // If we have at least 2 waypoints, calculate and show a route
    if (waypoints.length >= 2) {
      await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
    }
    saveWaypointsToLocalStorage(); // Save after adding
    return true;
  }
  
  // For regular (non-direct) waypoints, check if it's near a road
  const roadCheck = await checkNearRoad(coords, accessToken);
  
  if (!roadCheck.isValid) {
    // Point is not valid - not near a road
    if (onError) {
      onError("This location is too far from a road. Try placing it closer to a road or use direct waypoints.");
    }
    console.warn('[addWaypoint] Waypoint rejected - not near a road');
    return false;
  }
  
  // Point is valid, use snapped coordinates if available
  snapshot();
  
  if (roadCheck.snappedCoords) {
    waypoints.push(roadCheck.snappedCoords);
  } else {
    waypoints.push(coords);
  }
  
  directFlags.push(isDirect);
  
  // Update the visual representation on the map
  updatePoints(map, waypoints);
  
  // If we have at least 2 waypoints, calculate and show a route
  if (waypoints.length >= 2) {
    await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
  }
  
  saveWaypointsToLocalStorage(); // Save after adding
  return true;
}

// Function to remove a waypoint from an external component
export const removeWaypoint = async (
  map: MapboxMap,
  index: number,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
) => {
  if (index < 0 || index >= waypoints.length) return;
  
  // Snapshot current state for undo
  snapshot();
  
  // Remove the waypoint
  waypoints.splice(index, 1);
  directFlags.splice(index, 1);
  
  // Update the visual representation on the map
  updatePoints(map, waypoints);
  
  if (waypoints.length >= 2) {
    // Recalculate route with updated waypoints
    await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
  } else {
    // If fewer than 2 waypoints, clear route
    clearRoute(map);
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
  }
  saveWaypointsToLocalStorage(); // Save after removing
}

const snapshot = () => {
  const currentWaypointsSnapshot = waypoints.map(p => [...p]) as Coordinate[];
  const currentFlagsSnapshot = [...directFlags];
  console.log('[routing.ts snapshot] Creating snapshot. Current waypoints:', JSON.stringify(currentWaypointsSnapshot));
  console.log('[routing.ts snapshot] Current flags:', JSON.stringify(currentFlagsSnapshot));
  console.log('[routing.ts snapshot] Current undoStack length BEFORE push:', undoStack.length);
  
  undoStack.push({
    points: currentWaypointsSnapshot,
    flags: currentFlagsSnapshot
  });
  console.log('[routing.ts snapshot] After pushing, undoStack length:', undoStack.length);
  if (undoStack.length > 50) undoStack.shift();
  redoStack = []; 
  console.log('[routing.ts snapshot] Final undoStack length:', undoStack.length, 'redoStack cleared.');
};

export const stepBack = async (
  map: MapboxMap,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
) => {
  if (undoStack.length === 0) return;

  // Save current state to redo stack
  redoStack.push({ points: waypoints.map(p => [...p]) as Coordinate[], flags: [...directFlags] });

  // Restore previous state
  const prev = undoStack.pop() as WaypointHistory;
  waypoints = prev.points;
  directFlags = prev.flags;

  // Update visuals
  updatePoints(map, waypoints);

  if (waypoints.length >= 2) {
    await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
  } else {
    clearRoute(map);
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
  }
  saveWaypointsToLocalStorage(); // Save after undo
};

export const stepForward = async (
  map: MapboxMap,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
) => {
  if (redoStack.length === 0) return;

  // Save current state to undo stack
  undoStack.push({ points: waypoints.map(p => [...p]) as Coordinate[], flags: [...directFlags] });

  // Restore next state
  const next = redoStack.pop() as WaypointHistory;
  waypoints = next.points;
  directFlags = next.flags;

  updatePoints(map, waypoints);

  if (waypoints.length >= 2) {
    await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
  } else {
    clearRoute(map);
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
  }
  saveWaypointsToLocalStorage(); // Save after redo
};

export const reverseRoute = async (
  map: MapboxMap,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
) => {
  if (waypoints.length < 2) {
    console.log('[reverseRoute] Not enough waypoints to reverse.');
    return; // No route to reverse or not enough points
  }

  console.log('[reverseRoute] Reversing route. Current waypoints:', JSON.stringify(waypoints));
  console.log('[reverseRoute] Current directFlags:', JSON.stringify(directFlags));

  // Snapshot current state for undo
  snapshot();

  // Reverse waypoints and directFlags
  // Create new arrays to avoid issues with reversing in place if references are tricky
  const reversedWaypoints = [...waypoints].reverse();
  const reversedDirectFlags = [...directFlags].reverse();

  // The direct flag for the *start* of a segment determines if that segment is direct.
  // When reversing, the meaning of directFlags needs careful adjustment.
  // Example: A -> B (direct) -> C. flags: [false, true, false]
  // Reversed: C -> B (direct) -> A. flags should be: [false, true, false] (still B to C segment is direct)
  // The flag at index `i` refers to the segment from waypoint `i-1` to `i`.
  // So, if directFlags was [f1, f2, f3, f4] for w0-w1, w1-w2, w2-w3, w3-w4
  // After reversing waypoints to w4, w3, w2, w1, w0
  // The new flags should correspond to w3-w4, w2-w3, w1-w2, w0-w1 (original segments in reverse order)
  // However, the directFlags array is associated with the *endpoint* of the segment in current logic (directFlags[i] is for point i).
  // Point 0 (start) never has a true directFlag influencing an incoming segment.
  // If waypoints are [A, B, C, D] and flags are [false, true, false, true] meaning:
  // A->B (road), B->C (direct), C->D (road), D->E (direct)
  // After reverse: [E, D, C, B, A]
  // We want: E->D (direct), D->C (road), C->B (direct), B->A (road)
  // The flags need to be shifted and reversed essentially.
  // Original flags: [orig_f0, orig_f1, orig_f2, ..., orig_fn-1]
  // Reversed flags should be: [orig_fn-1, orig_fn-2, ..., orig_f1, orig_f0] then potentially shifted.

  // Let's analyze directFlags: directFlags[i] means waypoint `i` is a direct *target* from `i-1`.
  // Example: W0, W1, W2. Flags: [F0, F1, F2]. (F0 is usually false or ignored)
  // Segment W0->W1 uses F1. Segment W1->W2 uses F2.
  // Reversed waypoints: W2, W1, W0.
  // New flags: [NewF0, NewF1, NewF2]
  // We want segment W2->W1 to have directness of original W0->W1 (F1).
  // We want segment W1->W0 to have directness of original W1->W2 (F2).
  // So, newFlags[1] should be oldFlags[1], newFlags[2] should be oldFlags[2] etc. but applied to reversed waypoints.
  // The directFlags are associated with the point itself. directFlags[i] applies to point i.
  // If waypoints = [A, B, C], directFlags = [false, true, false]
  // This means A is normal, B is a direct connection *to* B, C is normal.
  // Route: A --road--> B* --direct--> C
  // Reversed: C, B*, A
  // We want: C --direct--> B* --road--> A
  // So new flags should be [false (for C), true (for B*), false (for A)] - this is just reversedDirectFlags.
  // BUT, the meaning changes slightly. directFlags[0] is effectively ignored for routing logic as it's the start.
  // directFlags[i] means point i is a direct *destination* from point i-1.

  // Let's re-evaluate: directFlags[i] determines if the leg TO waypoints[i] FROM waypoints[i-1] is direct.
  // W = [w0, w1, w2, w3], F = [f0, f1, f2, f3] (f0 is ignored)
  // w0 --(f1)--> w1 --(f2)--> w2 --(f3)--> w3
  // Reversed W_rev = [w3, w2, w1, w0]
  // New flags F_new = [?, new_f1, new_f2, new_f3]
  // We want w3 --(new_f1)--> w2. This segment was w2 --(f3)--> w3. So new_f1 = f3.
  // We want w2 --(new_f2)--> w1. This segment was w1 --(f2)--> w2. So new_f2 = f2.
  // We want w1 --(new_f3)--> w0. This segment was w0 --(f1)--> w1. So new_f3 = f1.
  // So, F_new should be [f0, f3, f2, f1] (if f0 is kept for consistency)
  // This means: reverse all flags, then shift right by 1, putting original f0 at the start?
  // No, simpler: reverse the flags array. The first element (originally f0) becomes the last. The second (f1) becomes second to last.
  // Example: W = [A,B,C], F = [false, true, false] (A->B road, B->C direct)
  // Reversed W_rev = [C,B,A]
  // Reversed F_rev = [false, true, false]
  // This implies C->B is road, B->A is direct. This is correct.
  // The direct flag is associated with the *target* waypoint of a segment.
  // So, simple reversal of both arrays should work.

  waypoints = reversedWaypoints;
  directFlags = reversedDirectFlags;

  console.log('[reverseRoute] Reversed waypoints:', JSON.stringify(waypoints));
  console.log('[reverseRoute] Reversed directFlags:', JSON.stringify(directFlags));

  // Update visuals and route
  updatePoints(map, waypoints);
  if (waypoints.length >= 2) {
    await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
  }
  saveWaypointsToLocalStorage(); // Save after reversing
  console.log('[reverseRoute] Route reversed and updated.');
};

// Function to update a waypoint position and recalculate the route
export const updateWaypointPositionAndRecalculate = async (
  map: MapboxMap,
  index: number,
  newCoords: Coordinate,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
) => {
  if (index < 0 || index >= waypoints.length) return;
  
  // Snapshot current state for undo
  snapshot();
  
  // Update the waypoint
  waypoints[index] = newCoords;
  
  // Update the visual representation on the map
  updatePoints(map, waypoints);
  
  if (waypoints.length >= 2) {
    // Recalculate route with updated waypoints
    await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
  }
  saveWaypointsToLocalStorage(); // Save after updating position
};

// Setup routing logic for a Mapbox map instance
export const setupRouting = (
  map: MapboxMap, 
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
) => {
  console.log('[setupRouting] Initializing routing setup...');

  // Attempt to load waypoints from local storage first
  loadWaypointsFromLocalStorage();

  // Check if map is valid
  if (!map) {
    console.error('[setupRouting] Map instance is not available');
    return;
  }
  
  console.log('[setupRouting] Starting routing setup');
  
  // Create source and layers only once
  if (!map.getSource('route')) {
    console.log('[setupRouting] Adding route and points sources/layers to map');
    try {
      // Add a source for the route
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        }
      });

      // Add an invisible wider layer to improve hit detection
      map.addLayer({
        id: 'route-hover-target',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#000',
          'line-width': 12, // Much wider for hit detection
          'line-opacity': 0 // Completely transparent
        }
      });

      // Add a layer for the route line
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3887be',
          'line-width': 3,
          'line-opacity': 0.75
        }
      });

      // Add hover interactions for the route
      map.on('mouseenter', 'route-hover-target', () => {
        map.getCanvas().style.cursor = 'pointer';
        map.setPaintProperty('route', 'line-width', 5);
        map.setPaintProperty('route', 'line-opacity', 0.9);
      });

      map.on('mouseleave', 'route-hover-target', () => {
        map.getCanvas().style.cursor = '';
        map.setPaintProperty('route', 'line-width', 3);
        map.setPaintProperty('route', 'line-opacity', 0.75);
      });

      // Add a layer for route points
      map.addSource('points', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      map.addLayer({
        id: 'points',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'match',
            ['get', 'pointType'],
            'start', '#2ecc71', // start green
            'end', '#e74c3c',   // end red
            'direct', '#f1c40f', // yellow for direct waypoint
            '#3887be' // other
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#fff'
        }
      });

      // Add source for user location
      map.addSource('user-location-point', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      // Add layer for user location halo (below the main dot)
      map.addLayer({
        id: 'user-location-halo',
        type: 'circle',
        source: 'user-location-point',
        paint: {
          'circle-radius': 16, // Larger than the main dot
          'circle-color': '#007cbf', // Same blue color
          'circle-opacity': 0.2, // More transparent
          'circle-stroke-width': 0, // No stroke for the halo
        }
      });

      // Add layer for user location main dot
      map.addLayer({
        id: 'user-location-point',
        type: 'circle',
        source: 'user-location-point',
        paint: {
          'circle-radius': 8,
          'circle-color': '#007cbf', // A distinct blue color
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.8
        }
      });

      // Add source and layer for kilometer markers
      map.addSource('km-markers', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      map.addLayer({
        id: 'km-markers',
        type: 'symbol',
        source: 'km-markers',
        layout: {
          'text-field': ['get', 'km'],
          'text-size': 12,
          'text-offset': [0, -1.5],
          'text-anchor': 'bottom',
          'icon-image': 'circle-11',
          'icon-size': 0.75,
          'icon-allow-overlap': true,
          'text-allow-overlap': true
        },
        paint: {
          'text-color': '#000',
          'text-halo-color': '#fff',
          'text-halo-width': 2
        }
      });
      
      console.log('[setupRouting] Successfully added kilometer markers layer');
      
      console.log('[setupRouting] Successfully added sources and layers');
    } catch (err) {
      console.error('[setupRouting] Error adding sources or layers:', err);
    }
  } else {
    console.log('[setupRouting] Sources and layers already exist');
  }

  // If we have waypoints (either initially present or loaded from storage), 
  // re-render them and the route.
  if (waypoints.length > 0) {
    console.log('[setupRouting] Waypoints present (either initial or loaded), updating map.');
    updatePoints(map, waypoints);
    if (waypoints.length >= 2) {
      getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
    }
  }

  // Only add click handler once to prevent duplicates
  if (!clickListenerAdded) {
    console.log('[setupRouting] Adding click handler to map');
    // Add click handler
    map.on('click', async (e: MapMouseEvent) => {
      console.log('[Map Click] Event received at:', e.lngLat);
      if (currentPopup && currentPopup.isOpen()) {
        const popupEl = currentPopup.getElement();
        if (popupEl && popupEl.querySelector('#addDirectBtn')) { // Check if it's the "Add direct waypoint" popup
          // Check if the click originated from the popup's main interactive button
          const targetElement = e.originalEvent?.target as HTMLElement | null;
          if (targetElement && (targetElement.id === 'addDirectBtn' || targetElement.closest('#addDirectBtn'))) {
            // Click was on the "Add direct waypoint" button itself. Let its dedicated handler run.
            // That handler will close the popup. We should not add a normal waypoint here.
            console.log('[Map Click] Click was on addDirectBtn, not adding waypoint');
            return;
          } else {
            // Click was not on the "Add direct waypoint" button (e.g., elsewhere on map, or popup background).
            // Close this specific popup and do not add a normal waypoint.
            console.log('[Map Click] Click was outside popup, closing popup');
            currentPopup.remove();
            currentPopup = null;
            return;
          }
        }
        // If currentPopup is open but it's not the "Add direct waypoint" popup (e.g., it's "Remove point"),
        // this map click should proceed to potentially add a normal waypoint.
        // The "Remove point" popup has closeOnClick:false and its own removal logic via its button.
      }

      console.log('[Map Click] Pre-action Waypoints:', JSON.stringify(waypoints));
      console.log('[Map Click] Pre-action DirectFlags:', JSON.stringify(directFlags));
      console.log('[Map Click] Pre-action UndoStack length:', undoStack.length);

      try {
        snapshot();
        
        const coords = [e.lngLat.lng, e.lngLat.lat] as Coordinate;
        
        waypoints.push(coords);
        directFlags.push(false); 
        console.log('[Map Click] Post-add Waypoints:', JSON.stringify(waypoints));
        console.log('[Map Click] Post-add DirectFlags:', JSON.stringify(directFlags));
        
        updatePoints(map, waypoints);
        
        if (waypoints.length >= 2) {
          await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
        }
        saveWaypointsToLocalStorage(); // Save after click actions
      } catch (error) {
        console.error('[Map Click] CRITICAL ERROR in click handler:', error);
      }
    });
    
    clickListenerAdded = true;
    console.log('[setupRouting] Click listener added successfully');
  } else {
    console.log('[setupRouting] Click listener already added');
  }

  // Add context-menu (right-click) handler once
  if (!contextMenuListenerAdded) {
    console.log('[setupRouting] Adding context menu handler for points layer');
    
    // Handle right click on waypoints (remove point)
    map.on('contextmenu', (e: MapMouseEvent) => {
      e.preventDefault(); // Prevent browser context menu
      console.log('[ContextMenu] Right-click detected', e.lngLat);

      try {
        // First check if click was on a waypoint
        const features = map.queryRenderedFeatures(e.point, { layers: ['points'] });
        
        if (features && features.length > 0) {
          // Clicked on a waypoint - show remove option
          const feature = features[0];
          const idxRaw = feature.properties?.waypointIndex;
          const idx = typeof idxRaw === 'string' ? parseInt(idxRaw, 10) : idxRaw;
          
          if (isNaN(idx) || idx < 0 || idx >= waypoints.length) {
            console.log('[ContextMenu] Invalid waypoint index:', idxRaw);
            return;
          }

          // Remove existing popup if any
          if (currentPopup) {
            currentPopup.remove();
            currentPopup = null;
          }

          console.log('[ContextMenu] Showing remove popup for waypoint', idx);
          // Show a small tooltip (popup) with "Remove" option
          // Ensure feature.geometry is a Point before accessing coordinates
          let popupCoords: Coordinate = [e.lngLat.lng, e.lngLat.lat];
          if (feature.geometry.type === 'Point') {
            popupCoords = feature.geometry.coordinates as Coordinate;
          }

          const popupHTML = `
            <div id="removeWaypointBtn" 
              style="
                display:flex;
                align-items:center;
                gap:6px;
                padding:6px 10px;
                background:rgba(255,255,255,0.95);
                border-radius:6px;
                box-shadow:0 2px 6px rgba(0,0,0,0.15);
                font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                font-size:12px;
                font-weight:600;
                color:#e74c3c;
                cursor:pointer;
                user-select:none;
              "
            >
              <span style="font-size:14px;">🗑️</span>
              <span>Remove point</span>
            </div>`;

          try {
            // Try to create popup using the appropriate method
            if (typeof window !== 'undefined' && window.mapboxgl) {
              currentPopup = new window.mapboxgl.Popup({
                closeButton: false,
                offset: 30,
                closeOnClick: false
              })
                .setLngLat(popupCoords)
                .setHTML(popupHTML)
                .addTo(map);
            } else {
              console.error('[ContextMenu] No Popup constructor available. Ensure mapboxgl is loaded.');
            }
          } catch (popupErr) {
            console.error('[ContextMenu] Error creating popup:', popupErr);
          }

          // Attach click handler to the popup content once it is mounted
          setTimeout(() => {
            if (currentPopup) {
              const popupEl = currentPopup.getElement();
              
              if (popupEl) {
                const removeBtn = popupEl.querySelector('#removeWaypointBtn');
                if (removeBtn) {
                  removeBtn.addEventListener('click', async () => {
                    try {
                      console.log('[ContextMenu] Remove button clicked for waypoint', idx);
                      // Snapshot current state for undo
                      snapshot();

                      // Remove the waypoint
                      waypoints.splice(idx, 1);
                      directFlags.splice(idx,1);

                      // Update points on map
                      updatePoints(map, waypoints);

                      if (waypoints.length >= 2) {
                        // Recalculate route with updated waypoints
                        await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
                      } else {
                        // If fewer than 2 waypoints, clear route
                        clearRoute(map);
                        setRouteDistance('');
                        setRouteDuration('');
                        setHasRoute(false);
                      }
                    } catch (err) {
                      console.error('[Tooltip Remove] Error while removing waypoint:', err);
                    } finally {
                      // Close and clear the popup
                      if (currentPopup) {
                        currentPopup.remove();
                        currentPopup = null;
                      }
                    }
                  }, { once: true });
                }
              }
            }
          }, 50);
        } else {
          // Not clicked on a waypoint - show direct waypoint option
          console.log('[ContextMenu] Show direct waypoint option');
          
          // Show popup with option to add direct waypoint
          if (currentPopup) { 
            currentPopup.remove(); 
            currentPopup = null; 
          }

          const coordsScreen = [e.lngLat.lng, e.lngLat.lat] as Coordinate;
          const popupHTML = `
            <div id="addDirectBtn" 
              style="
                padding:6px 10px;
                background:rgba(255,255,255,0.95);
                border-radius:6px;
                box-shadow:0 2px 6px rgba(0,0,0,0.15);
                font-size:12px;
                font-weight:600;
                color:#3498db;
                cursor:pointer; user-select:none;"
            >Add direct waypoint</div>`;

          try {
            // Try to create popup using the appropriate method
            if (typeof window !== 'undefined' && window.mapboxgl) {
              currentPopup = new window.mapboxgl.Popup({ 
                closeButton: false, 
                offset: 30, 
                closeOnClick: false 
              })
                .setLngLat(coordsScreen)
                .setHTML(popupHTML)
                .addTo(map);
            } else {
              console.error('[Direct ContextMenu] No Popup constructor available. Ensure mapboxgl is loaded.');
            }
          } catch (popupErr) {
            console.error('[Direct ContextMenu] Error creating popup:', popupErr);
            return;
          }

          // Attach click handler to the popup content
          setTimeout(() => {
            if (currentPopup) {
              const popupEl = currentPopup.getElement();
              if (popupEl) {
                const directBtn = popupEl.querySelector('#addDirectBtn');
                if (directBtn) {
                  directBtn.addEventListener('click', async () => {
                    try {
                      console.log('[Direct ContextMenu] Adding direct waypoint at', coordsScreen);
                      snapshot();
                      waypoints.push(coordsScreen);
                      directFlags.push(true);
                      updatePoints(map, waypoints);

                      if (waypoints.length >= 2) {
                        await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
                      }
                    } catch (err) {
                      console.error('[Direct ContextMenu] Error adding direct waypoint:', err);
                    } finally {
                      if (currentPopup) { 
                        currentPopup.remove(); 
                        currentPopup = null; 
                      }
                    }
                  }, { once: true });
                }
              }
            }
          }, 50);
        }
      } catch (err) {
        console.error('[ContextMenu] Error handling context menu:', err);
      }
    });

    contextMenuListenerAdded = true;
    console.log('[setupRouting] Context menu listeners added');
  } else {
    console.log('[setupRouting] Context menu listeners already exist');
  }

  // Add drag handlers for waypoints
  console.log('[setupRouting] Adding mousedown/touchstart handlers for waypoints');
  
  // Change cursor when hovering over waypoints (Desktop only)
  map.on('mouseenter', 'points', () => {
    if (!isDragging) map.getCanvas().style.cursor = 'grab';
  });
  
  map.on('mouseleave', 'points', () => {
    if (!isDragging) {
      map.getCanvas().style.cursor = '';
    }
  });
  
  // --- Mouse Drag Handlers ---
  const onMapMouseMove = (eMove: MapMouseEvent) => {
    if (!isDragging || draggedWaypointIndex < 0 || draggedWaypointIndex >= waypoints.length) return;
    
    const newCoords = [eMove.lngLat.lng, eMove.lngLat.lat] as Coordinate;
    waypoints[draggedWaypointIndex] = newCoords;
    updatePoints(map, waypoints);
    
    // Update temporary drag lines if they exist and are relevant
    if (map.getSource('temp-drag-lines')) {
      const features = [];
      // Previous point to new point
      if (draggedWaypointIndex > 0) {
        features.push({
          type: 'Feature' as const, // Re-add 'as const' here
          properties: {},
          geometry: { type: 'LineString' as const, coordinates: [waypoints[draggedWaypointIndex - 1], newCoords] }
        });
      }
      // New point to next point
      if (draggedWaypointIndex < waypoints.length - 1) {
        features.push({
          type: 'Feature' as const, // Re-add 'as const' here
          properties: {},
          geometry: { type: 'LineString' as const, coordinates: [newCoords, waypoints[draggedWaypointIndex + 1]] }
        });
      }
      (map.getSource('temp-drag-lines') as GeoJSONSource).setData({
        type: 'FeatureCollection' as const,
        features
      });
    }
  };

  const onMapMouseUp = async () => {
    if (!isDragging || draggedWaypointIndex < 0) return;

    console.log('[Drag End - Mouse] Waypoint drag ended for index:', draggedWaypointIndex);
    const finalCoords = waypoints[draggedWaypointIndex]; // Already updated by onMapMouseMove

    // Persist changes and update route
    try {
      // Snapshot before road check for potential coordinate change
      // snapshot(); // snapshot() is now called inside updateWaypointPositionAndRecalculate

      // For non-direct waypoints, snap to road after drag.
      // Direct waypoints remain exactly where dropped.
      if (!directFlags[draggedWaypointIndex]) {
        console.log('[Drag End - Mouse] Waypoint is not direct, checking road proximity for:', finalCoords);
        await updateWaypointPositionAndRecalculate(
          map, 
          draggedWaypointIndex, 
          finalCoords, // Pass the current (possibly unsnapped) coords
          accessToken, 
          setRouteDistance, 
          setRouteDuration, 
          setHasRoute
        );
      } else {
        // For direct waypoints, just save and update route if necessary
        console.log('[Drag End - Mouse] Waypoint is direct. Final Coords:', finalCoords);
        snapshot(); // Snapshot current state as final
        // updatePoints(map, waypoints); // Already called by onMapMouseMove
        if (waypoints.length >= 2) {
          await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
        }
        saveWaypointsToLocalStorage();
      }
    } catch (error) {
      console.error('[Drag End - Mouse] Error during mouse up processing:', error);
    } finally {
      isDragging = false;
      draggedWaypointIndex = -1;
      map.getCanvas().style.cursor = '';
      map.dragPan.enable();
      map.off('mousemove', onMapMouseMove);
      map.off('mouseup', onMapMouseUp);
      
      // Clear temporary drag lines
      if (map.getSource('temp-drag-lines')) {
        (map.getSource('temp-drag-lines') as GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      console.log('[Drag End - Mouse] Mouse listeners removed, pan enabled.');
    }
  };

  map.on('mousedown', 'points', (e: MapLayerMouseEvent) => {
    if (currentPopup && currentPopup.isOpen()) {
      console.log('[Drag Start - Mouse] Popup open, preventing drag.');
      return;
    }
    // Ensure it's a left-click (button 0)
    if (e.originalEvent.button !== 0) {
      console.log('[Drag Start - Mouse] Not a left click, ignoring.');
      return;
    }
    
    e.preventDefault();
    
    if (!e.features || e.features.length === 0) return;
    
    const feature = e.features[0];
    const idxRaw = feature.properties?.waypointIndex;
    const idx = typeof idxRaw === 'string' ? parseInt(idxRaw, 10) : typeof idxRaw === 'number' ? idxRaw : -1;
    
    if (idx === -1 || isNaN(idx) || idx < 0 || idx >= waypoints.length) {
      console.log('[Drag Start - Mouse] Invalid waypoint index:', idxRaw);
      return;
    }
    
    console.log('[Drag Start - Mouse] Initiating drag for waypoint index:', idx);
    isDragging = true;
    draggedWaypointIndex = idx;
    map.getCanvas().style.cursor = 'grabbing';
    map.dragPan.disable();
    
    map.on('mousemove', onMapMouseMove);
    map.on('mouseup', onMapMouseUp);

    // Add temporary source and layer for drag visual lines if not already present
    // This logic could be moved to a more general setup if these layers are always desired
    if (!map.getSource('temp-drag-lines')) {
      map.addSource('temp-drag-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addLayer({
        id: 'temp-drag-lines',
        type: 'line',
        source: 'temp-drag-lines',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3887be', 'line-width': 3, 'line-opacity': 0.75 }
      });
    }
  });

  // --- Touch Drag Handlers ---
  const onMapTouchMove = (eMove: MapTouchEvent) => {
    if (!isDragging || draggedWaypointIndex < 0 || draggedWaypointIndex >= waypoints.length) return;
    
    // Prevent default touch actions like scrolling
    eMove.preventDefault();

    const newCoords = [eMove.lngLat.lng, eMove.lngLat.lat] as Coordinate;
    waypoints[draggedWaypointIndex] = newCoords;
    updatePoints(map, waypoints);

    // Update temporary drag lines (similar to mouse move)
    if (map.getSource('temp-drag-lines')) {
      const features = [];
      if (draggedWaypointIndex > 0) {
        features.push({
          type: 'Feature' as const, // Re-add 'as const' here
          properties: {},
          geometry: { type: 'LineString' as const, coordinates: [waypoints[draggedWaypointIndex - 1], newCoords] }
        });
      }
      if (draggedWaypointIndex < waypoints.length - 1) {
        features.push({
          type: 'Feature' as const, // Re-add 'as const' here
          properties: {},
          geometry: { type: 'LineString' as const, coordinates: [newCoords, waypoints[draggedWaypointIndex + 1]] }
        });
      }
      (map.getSource('temp-drag-lines') as GeoJSONSource).setData({
        type: 'FeatureCollection' as const,
        features
      });
    }
  };

  const onMapTouchEnd = async () => {
    if (!isDragging || draggedWaypointIndex < 0) return;

    console.log('[Drag End - Touch] Waypoint touch drag ended for index:', draggedWaypointIndex);
    const finalCoords = waypoints[draggedWaypointIndex];

    try {
      // For non-direct waypoints, snap to road after drag.
      if (!directFlags[draggedWaypointIndex]) {
        console.log('[Drag End - Touch] Waypoint is not direct, checking road proximity for:', finalCoords);
        await updateWaypointPositionAndRecalculate(
          map, 
          draggedWaypointIndex, 
          finalCoords,
          accessToken, 
          setRouteDistance, 
          setRouteDuration, 
          setHasRoute
        );
      } else {
        console.log('[Drag End - Touch] Waypoint is direct. Final Coords:', finalCoords);
        snapshot();
        // updatePoints(map, waypoints); // Already called by onMapTouchMove
        if (waypoints.length >= 2) {
          await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
        }
        saveWaypointsToLocalStorage();
      }
    } catch (error) {
      console.error('[Drag End - Touch] Error during touch end processing:', error);
    } finally {
      isDragging = false;
      draggedWaypointIndex = -1;
      // No cursor style to reset for touch
      map.dragPan.enable();
      map.off('touchmove', onMapTouchMove);
      map.off('touchend', onMapTouchEnd);
      
      // Clear temporary drag lines
      if (map.getSource('temp-drag-lines')) {
        (map.getSource('temp-drag-lines') as GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      console.log('[Drag End - Touch] Touch listeners removed, pan enabled.');
    }
  };

  map.on('touchstart', 'points', (e: MapTouchEvent) => { // Changed MapLayerMouseEvent to MapTouchEvent
    if (currentPopup && currentPopup.isOpen()) {
      console.log('[Drag Start - Touch] Popup open, preventing drag.');
      return;
    }
    // For touch, we usually don't check e.originalEvent.button.
    // Ensure it's a single touch to initiate drag.
    // The 'points' property in MapTouchEvent (from originalEvent) tells us number of touch points.
    // However, react-map-gl's MapLayerMouseEvent might not directly expose this if it wraps it.
    // We rely on the fact that mapbox-gl itself will typically only fire this for the primary touch on the layer.
    // More robust check could be event.originalEvent.touches.length === 1 if originalEvent is a TouchEvent.
    // For now, assume single touch initiates.

    e.preventDefault(); // Prevent default touch actions like scrolling or zooming
    
    if (!e.features || e.features.length === 0) return;
    
    const feature = e.features[0];
    const idxRaw = feature.properties?.waypointIndex;
    const idx = typeof idxRaw === 'string' ? parseInt(idxRaw, 10) : typeof idxRaw === 'number' ? idxRaw : -1;
    
    if (idx === -1 || isNaN(idx) || idx < 0 || idx >= waypoints.length) {
      console.log('[Drag Start - Touch] Invalid waypoint index:', idxRaw);
      return;
    }
    
    console.log('[Drag Start - Touch] Initiating touch drag for waypoint index:', idx);
    isDragging = true;
    draggedWaypointIndex = idx;
    // No cursor style for touch
    map.dragPan.disable(); // Disable map panning during waypoint drag
    
    map.on('touchmove', onMapTouchMove);
    map.on('touchend', onMapTouchEnd);

    // Add temporary source and layer for drag visual lines (same as mousedown)
    if (!map.getSource('temp-drag-lines')) {
      map.addSource('temp-drag-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addLayer({
        id: 'temp-drag-lines',
        type: 'line',
        source: 'temp-drag-lines',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3887be', 'line-width': 3, 'line-opacity': 0.75 }
      });
    }
  });
  
  console.log('[setupRouting] Mousedown/touchstart handlers for points layer added.');

  // Handle clicking and dragging on the route directly
  map.on('mousedown', 'route-hover-target', (e: MapLayerMouseEvent) => {
    // Don't do anything if a popup is open
    if (currentPopup && currentPopup.isOpen()) return;

    // Only proceed for left-clicks (button 0).
    // This prevents this handler from interfering with right-click (context menu) logic.
    if (e.originalEvent.button !== 0) {
      return;
    }
    
    // Prevent default browser behavior (e.g., text selection, drag image)
    e.preventDefault();
    
    // Check if we have a valid route
    if (waypoints.length < 2) return;
    
    // Get the click point
    const clickPoint = [e.lngLat.lng, e.lngLat.lat] as Coordinate;
    
    // First, check if we're already close to an existing waypoint
    // Query rendered features to see if we're clicking near an existing waypoint
    const features = map.queryRenderedFeatures(e.point, { layers: ['points'] });
    if (features && features.length > 0) {
      // We're clicking near an existing waypoint, so don't create a new one
      // The existing waypoint's drag handler will take over
      return;
    }
    
    // We need to find the closest position on the route to add a new waypoint
    // Get the route coordinates
    const routeSource = map.getSource('route');
    let routeData: { geometry?: { coordinates?: Coordinate[] } } | undefined;
    
    try {
      // @ts-expect-error _data is not in type definition but is used by mapbox internally
      routeData = routeSource?._data;
    } catch (err) {
      console.error('[Route Click] Failed to get route data:', err);
      return;
    }
    
    if (!routeData || !routeData.geometry || !routeData.geometry.coordinates || routeData.geometry.coordinates.length === 0) {
      console.warn('[Route Click] No valid route data found');
      return;
    }
    
    const routeCoords = routeData.geometry.coordinates;
    
    // Find the closest point on the route line and its segment index
    let minDistance = Infinity;
    let closestPointOnRoute: Coordinate = [0, 0];
    let insertIndex = 1; // We'll insert after the first waypoint by default
    
    for (let i = 0; i < routeCoords.length - 1; i++) {
      const start = routeCoords[i];
      const end = routeCoords[i + 1];
      
      // Find closest point on this line segment
      const point = closestPointOnSegment(clickPoint, start, end);
      const distance = haversine(clickPoint, point);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPointOnRoute = point;
        
        // Determine proper insertion index in the waypoints array
        // For simplicity, we'll look at distance to existing waypoints
        for (let j = 0; j < waypoints.length - 1; j++) {
          // Calculate distance from start of each segment
          const segStart = routeCoords.findIndex(
            (coord: Coordinate) => coord[0] === waypoints[j][0] && coord[1] === waypoints[j][1]
          );
          
          const segEnd = routeCoords.findIndex(
            (coord: Coordinate) => coord[0] === waypoints[j + 1][0] && coord[1] === waypoints[j + 1][1]
          );
          
          if (segStart !== -1 && segEnd !== -1 && i >= segStart && i < segEnd) {
            insertIndex = j + 1;
            break;
          }
        }
      }
    }
    
    // If no reasonably close point was found, abort
    if (minDistance > 0.1) { // More than 100m away
      console.warn('[Route Click] Click was too far from route:', minDistance);
      return;
    }
    
    // Snapshot for undo
    snapshot();
    
    // Add the new waypoint at the proper insert position
    waypoints.splice(insertIndex, 0, closestPointOnRoute);
    directFlags.splice(insertIndex, 0, false); // Default to regular waypoint
    
    // Update markers visually
    updatePoints(map, waypoints);
    
    // Set up dragging for this new waypoint immediately
    isDragging = true;
    draggedWaypointIndex = insertIndex;
    map.getCanvas().style.cursor = 'grabbing';
    
    // Disable map dragging during waypoint drag
    map.dragPan.disable();
    
    // Add a temporary source and layer for drag visual lines
    if (!map.getSource('temp-drag-lines')) {
      map.addSource('temp-drag-lines', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection' as const,
          features: []
        }
      });
      
      map.addLayer({
        id: 'temp-drag-lines',
        type: 'line',
        source: 'temp-drag-lines',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3887be', // Match the route color
          'line-width': 3,
          'line-opacity': 0.75
        }
      });
    }
    
    // Setup the same mouse move and mouse up handlers as regular waypoint dragging
    const onMouseMove = (eMove: MapMouseEvent) => {
      if (!isDragging) return;
      
      const coords = [eMove.lngLat.lng, eMove.lngLat.lat] as Coordinate;
      
      // Update the waypoint position (visually only, don't recalculate route yet)
      waypoints[draggedWaypointIndex] = coords;
      updatePoints(map, waypoints);
      
      // Create temporary straight lines to adjacent waypoints
      const features: Array<GeoJSON.Feature<GeoJSON.LineString>> = [];
      
      // If not the first waypoint, create line to previous waypoint
      if (draggedWaypointIndex > 0) {
        features.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [waypoints[draggedWaypointIndex - 1], coords]
          }
        });
      }
      
      // If not the last waypoint, create line to next waypoint
      if (draggedWaypointIndex < waypoints.length - 1) {
        features.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [coords, waypoints[draggedWaypointIndex + 1]]
          }
        });
      }
      
      // Update temp drag lines
      const tempSource = map.getSource('temp-drag-lines');
      if (tempSource) {
        (tempSource as GeoJSONSource).setData({
          type: 'FeatureCollection',
          features
        });
      }
      
      // The route should remain visible for other segments
      // No need to hide the entire route as we're overlaying
      // our temp lines only for the segments connected to the dragged point
    };
    
    // Mouse up handler - finalize drag and recalculate route
    const onMouseUp = async () => {
      if (!isDragging) return;

      // Snapshot for undo
      snapshot(); 

      isDragging = false;
      map.getCanvas().style.cursor = '';
      map.dragPan.enable();

      // Remove temporary drag lines
      const tempSource = map.getSource('temp-drag-lines');
      if (tempSource) {
        (tempSource as GeoJSONSource).setData({ type: 'FeatureCollection', features: [] });
      }

      // Recalculate route with the new waypoint
      if (waypoints.length >= 2) {
        console.log('[Route Click Drag End] Recalculating route after adding waypoint on route');
        await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
      }
      draggedWaypointIndex = -1;
      saveWaypointsToLocalStorage(); // Save after dragging new waypoint from route

      // Remove listeners
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
    };
    
    // Add temporary event listeners
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);
  });

  return map;
};

// Update the marker points on the map
export const updatePoints = (map: MapboxMap, points: Coordinate[]) => {
  if (!map || !map.getSource) return;
  
  const features = points.map((point, index) => {
    let pointType = 'intermediate';
    if (points.length === 1) {
      pointType = 'start'; 
    } else if (index === 0) {
      pointType = 'start';
    } else if (index === points.length - 1) {
      pointType = 'end';
    }
    if (directFlags[index]) {
      pointType = 'direct';
    }

    return {
      type: 'Feature' as const,
      properties: { pointType, waypointIndex: index },
      geometry: {
        type: 'Point' as const,
        coordinates: point
      }
    };
  });

  const pointsSource = map.getSource('points');
  if (pointsSource) {
    (pointsSource as GeoJSONSource).setData({
      type: 'FeatureCollection' as const,
      features
    });
  }
};

// Clear the displayed route
export const clearRoute = (map: MapboxMap) => {
  if (!map || !map.getSource) return;
  
  const routeSource = map.getSource('route') as GeoJSONSource | undefined;
  if (routeSource) {
    routeSource.setData({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: []
      }
    });
  }
  currentRoutePathCoordinates = []; // Clear detailed path
};

// Calculate and place kilometer markers along the route
const addKilometerMarkers = (map: MapboxMap, coordinates: Coordinate[]) => {
  if (!map || !map.getSource || !map.getSource('km-markers') || coordinates.length < 2) {
    console.warn('[addKilometerMarkers] Map or km-markers source not available. Aborting.');
    return;
  }
  
  console.log('[addKilometerMarkers] Calculating kilometer markers...');
  
  const kmMarkers: Array<{
    geometry: { type: string; coordinates: Coordinate };
    properties: { km: string };
    type: string;
  }> = [];
  
  let distanceCovered = 0;
  let nextKmMarker = 1; // First marker at 1km
  
  // Loop through each segment of the route
  for (let i = 0; i < coordinates.length - 1; i++) {
    const start = coordinates[i];
    const end = coordinates[i + 1];
    
    // Calculate distance of this segment
    const segmentDistance = haversine(start, end);
    
    // Check if we cross a kilometer marker in this segment
    if (distanceCovered + segmentDistance >= nextKmMarker) {
      // How far into this segment is the km marker
      const segmentFraction = (nextKmMarker - distanceCovered) / segmentDistance;
      
      // Calculate the position of the km marker using linear interpolation
      const markerLng = start[0] + segmentFraction * (end[0] - start[0]);
      const markerLat = start[1] + segmentFraction * (end[1] - start[1]);
      
      // Add the marker
      kmMarkers.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [markerLng, markerLat]
        },
        properties: {
          km: `${nextKmMarker} km`
        }
      });
      
      // Move to next kilometer marker
      nextKmMarker++;
    }
    
    // Add the distance of this segment
    distanceCovered += segmentDistance;
  }
  
  // Update the GeoJSON source with the kilometer markers
  const source = map.getSource('km-markers') as GeoJSONSource | undefined;
  if (source) { 
    source.setData({
      type: 'FeatureCollection',
      features: kmMarkers as GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>[]
    });
  }
  
  console.log(`[addKilometerMarkers] Added ${kmMarkers.length} kilometer markers`);
};

// Clear kilometer markers from the map
const clearKilometerMarkers = (map: MapboxMap) => {
  if (map && map.getSource && map.getSource('km-markers')) {
    const source = map.getSource('km-markers') as GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: []
      });
    }
    console.log('[clearKilometerMarkers] Cleared kilometer markers');
  }
};

// Calculate and display a route between waypoints
export const getRoute = async (
  map: MapboxMap, 
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
) => {
  if (!map || !map.getSource) {
    console.warn('[getRoute] Map or map.getSource is not available. Aborting.');
    return;
  }
  
  // Clear existing kilometer markers
  clearKilometerMarkers(map);
  const routeSource = map.getSource('route') as GeoJSONSource | undefined;
  
  if (directFlags.some(Boolean)) {
      const { coordsAccum, totalDist, waypointsUpdated } = await buildMixedRoute(accessToken);
      if (routeSource) {
        routeSource.setData({ type:'Feature', properties:{}, geometry:{ type:'LineString', coordinates: coordsAccum } });
      }
      currentRoutePathCoordinates = coordsAccum; // Store detailed mixed path
      // Update marker positions based on snapped coords (if they were updated in buildMixedRoute)
      if (waypointsUpdated) {
        updatePoints(map, waypoints);
      }
      const duration = Math.round(totalDist/5*60);
      setRouteDistance(`${totalDist.toFixed(2)} km`);
      setRouteDuration(`${duration} min`);
      setHasRoute(true);
      
      // Add kilometer markers along the mixed route
      addKilometerMarkers(map, coordsAccum);
      // zoomToRoute(map, currentRoutePathCoordinates); // <--- REMOVED CALL
      if (waypointsUpdated) { // Save if buildMixedRoute updated global waypoints
        saveWaypointsToLocalStorage();
      }
      return;
  }

  try {
    // Use a copy of the points for the API request to avoid modifying the global 'waypoints' array prematurely
    const currentWaypointsForAPI = [...waypoints];
    console.log('[getRoute] Started. Calculating route with waypoints:', currentWaypointsForAPI.length, 'Points:', JSON.stringify(currentWaypointsForAPI));
    
    const waypointsString = currentWaypointsForAPI.map(point => `${point[0]},${point[1]}`).join(';');
    
    // Create a radiuses string with much larger values for better snapping
    // Use larger values (150m) to help Mapbox find the nearest appropriate road
    const radiusesString = currentWaypointsForAPI.map(() => '150').join(';');
    
    console.log('[getRoute] Waypoints string for API:', waypointsString);
    console.log('[getRoute] Radiuses string for API:', radiusesString);
    
    // Build the URL with additional parameters for better route accuracy
    // overview=full: Get the most detailed route geometry
    // steps=true: Include detailed steps for better snapping
    // geometries=geojson: Get GeoJSON format for direct use
    // continue_straight=true: Prefer going straight at intersections
    const queryUrl = `https://api.mapbox.com/directions/v5/mapbox/walking/${waypointsString}?` + 
                    `steps=true&geometries=geojson&overview=full&continue_straight=true&` +
                    `access_token=${accessToken}&radiuses=${radiusesString}`;

    console.log('[getRoute] Fetching URL:', queryUrl);

    const query = await fetch(queryUrl, { method: 'GET' });
    
    console.log('[getRoute] API fetch status:', query.status);
    const json = await query.json();
    console.log('[getRoute] API response JSON:', JSON.stringify(json));
    // Add this new log to inspect the raw json.waypoints from the API
    console.log('[getRoute] API response json.waypoints:', JSON.stringify(json.waypoints));
    
    if (!json || !json.routes || json.routes.length === 0) {
      console.error('[getRoute] No routes array found in API response or it is empty. Response:', json);
      setHasRoute(false);
      return;
    }
    
    const data = json.routes[0];
    
    if (!data || !data.geometry || !data.geometry.coordinates || data.geometry.coordinates.length === 0) {
      console.error('[getRoute] First route in API response is missing geometry or coordinates. Route data:', data);
      setHasRoute(false);
      return;
    }

    // Extract snapped waypoints from the API response
    if (json.waypoints && Array.isArray(json.waypoints)) {
      const apiSnappedWaypoints = json.waypoints.map((wp: { location: Coordinate }) => wp.location);

      // Check if the number of waypoints returned by API matches number of waypoints sent
      if (apiSnappedWaypoints.length === currentWaypointsForAPI.length) {
        
        // **CRITICAL CHECK**: Before applying API's snapped waypoints, ensure the
        // global `waypoints` haven't fundamentally changed since this `getRoute` was initiated.
        // This prevents a stale `getRoute` (e.g., one that was in-flight during a reset)
        // from overwriting the newer state.
        let isContextStillValid = waypoints.length === currentWaypointsForAPI.length;
        if (isContextStillValid) {
          for (let i = 0; i < waypoints.length; i++) {
            // Compare current global `waypoints` to the `waypoints` that initiated this `getRoute` call
            if (waypoints[i][0] !== currentWaypointsForAPI[i][0] || 
                waypoints[i][1] !== currentWaypointsForAPI[i][1]) {
              isContextStillValid = false;
              break;
            }
          }
        }

        if (!isContextStillValid) {
          console.log('[getRoute] Global waypoints have changed since this getRoute call was initiated (e.g. reset or new points). Discarding this API snapping result.');
        } else {
          // Context is valid, now check if snapping actually changed anything compared to current global waypoints
          let actualChangeMadeBySnapping = false;
          // Compare the current global waypoints (which match currentWaypointsForAPI) with what the API returned.
          // This loop ensures we only update if the API provided genuinely different (snapped) coordinates.
          for (let i = 0; i < waypoints.length; i++) { // waypoints.length is same as apiSnappedWaypoints.length here
            if (waypoints[i][0] !== apiSnappedWaypoints[i][0] || 
                waypoints[i][1] !== apiSnappedWaypoints[i][1]) {
              actualChangeMadeBySnapping = true;
              break;
            }
          }

          if (actualChangeMadeBySnapping) {
            console.log('[getRoute] Snapped waypoints from API are different from current global waypoints:', JSON.stringify(apiSnappedWaypoints));
            waypoints = [...apiSnappedWaypoints]; // Update global waypoints with API's snapped version
            console.log('[getRoute] Global waypoints updated with snapped locations from API.');
            updatePoints(map, waypoints); 
            console.log('[getRoute] Called updatePoints with snapped waypoints.');
            saveWaypointsToLocalStorage(); 
          } else {
            console.log('[getRoute] Snapped waypoints from API are identical to current global ones. No update needed.');
          }
        }
      } else {
        console.warn('[getRoute] Mismatch between waypoints sent to API (count: ' + currentWaypointsForAPI.length + ') and waypoints returned by API (count: ' + apiSnappedWaypoints.length + '). Not updating global waypoints from this call.');
      }
    } else {
      console.warn('[getRoute] Snapped waypoints (json.waypoints) not found or not an array in API response.');
    }
    
    const route = data.geometry.coordinates;
    const routeSourceFromAPI = map.getSource('route') as GeoJSONSource | undefined;
    
    if (routeSourceFromAPI) {
      console.log('[getRoute] Updating route source on map.');
      routeSourceFromAPI.setData({
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: route
        }
      });
      currentRoutePathCoordinates = route; // Store detailed path from API
      console.log('[getRoute] Route source updated.');
      
      // Add kilometer markers along the route
      addKilometerMarkers(map, route);
      // zoomToRoute(map, currentRoutePathCoordinates); // <--- REMOVED CALL
    } else {
      console.warn('[getRoute] Route source not found on map.');
    }
    
    const distance = (data.distance / 1000).toFixed(2);
    const duration = Math.floor(data.duration / 60);
    
    console.log('[getRoute] Preparing to set React state for route info. Distance:', distance, 'Duration:', duration);
    setRouteDistance(`${distance} km`);
    setRouteDuration(`${duration} min`);
    setHasRoute(true);
    console.log('[getRoute] React state for route info updated.');
    
    console.log('[getRoute] Finished successfully (React state updates bypassed, snap-to-road attempted). Route updated, distance:', distance, 'km, duration:', duration, 'min');
    
  } catch (error) {
    console.error('[getRoute] CRITICAL ERROR in getRoute:', error);
    setHasRoute(false);
  }
};

// Reset all routing data and UI
export const resetRouting = (
  map: MapboxMap,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
) => {
  console.log('[routing.ts resetRouting] Resetting route START');
  
  if (map) { 
    clearRoute(map);
    updatePoints(map, []);
    waypoints = [];
    directFlags = [];
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
    
    clearKilometerMarkers(map);

    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }

    undoStack = [];
    redoStack = [];
    saveWaypointsToLocalStorage(); 

    console.log('[routing.ts resetRouting] Reset COMPLETE. Waypoints:', JSON.stringify(waypoints));
    console.log('[routing.ts resetRouting] DirectFlags:', JSON.stringify(directFlags));
    console.log('[routing.ts resetRouting] UndoStack length:', undoStack.length);
  }
};

// Helper to calculate distance between coordinates using haversine formula
const haversine = (c1: Coordinate, c2: Coordinate) => {
  const toRad = (v: number) => v * Math.PI / 180;
  const R = 6371; // km
  const dLat = toRad(c2[1] - c1[1]);
  const dLon = toRad(c2[0] - c1[0]);
  const lat1 = toRad(c1[1]);
  const lat2 = toRad(c2[1]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Build a route that includes both direct (as-the-crow-flies) and road segments
async function buildMixedRoute(accessToken: string) {
  const coordsAccum = [];
  let totalDist = 0;
  let waypointsUpdated = false; // Flag to indicate if global waypoints were modified

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];

    if (directFlags[i + 1]) {
      // Direct segment
      if (coordsAccum.length === 0) coordsAccum.push(from);
      coordsAccum.push(to);
      totalDist += haversine(from, to);
    } else {
      // Use Mapbox Directions for this pair (could batch, but keeps simple)
      // Added better parameters for road following
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${from[0]},${from[1]};${to[0]},${to[1]}?` +
                 `steps=true&geometries=geojson&overview=full&access_token=${accessToken}&radiuses=150;150&continue_straight=true`;
      try {
        const res = await fetch(url);
        const json = await res.json();
        if (json && json.routes && json.routes[0]) {
          const geom = json.routes[0].geometry.coordinates;
          const distKm = json.routes[0].distance / 1000;
          // Append coordinates, avoid duplicating first
          if (coordsAccum.length === 0) coordsAccum.push(...geom);
          else {
            coordsAccum.push(...geom.slice(1));
          }
          totalDist += distKm;
          if (json && json.waypoints && json.waypoints.length === 2) {
            // Update snapped waypoint coords globally for NON-direct points only
            const newWp0 = json.waypoints[0].location;
            const newWp1 = json.waypoints[1].location;
            if (!directFlags[i] && (waypoints[i][0] !== newWp0[0] || waypoints[i][1] !== newWp0[1])) {
              waypoints[i]   = newWp0;
              waypointsUpdated = true;
            }
            if (!directFlags[i+1] && (waypoints[i+1][0] !== newWp1[0] || waypoints[i+1][1] !== newWp1[1])) {
              waypoints[i+1] = newWp1;
              waypointsUpdated = true;
            }
          }
        } else {
          // No route found; convert to direct segment
          if (!directFlags[i+1]) { // only update if it was not already direct
            directFlags[i+1] = true;
            waypointsUpdated = true; // directFlags is part of the persisted data
          }
          if (coordsAccum.length === 0) coordsAccum.push(from);
          coordsAccum.push(to);
          totalDist += haversine(from, to);
        }
      } catch(err) {
        console.error('[buildMixedRoute] Error fetching segment: ', err);
        // No route found; convert to direct segment
        if (!directFlags[i+1]) { // only update if it was not already direct
          directFlags[i+1] = true;
          waypointsUpdated = true; // directFlags is part of the persisted data
        }
        if (coordsAccum.length === 0) coordsAccum.push(from);
        coordsAccum.push(to);
        totalDist += haversine(from, to);
      }
    }
  }
  if (waypointsUpdated) {
    console.log('[buildMixedRoute] Global waypoints or directFlags updated.');
  }
  return { coordsAccum, totalDist, waypointsUpdated };
}

// Helper function to find the closest point on a line segment
const closestPointOnSegment = (p: Coordinate, v: Coordinate, w: Coordinate): Coordinate => {
  const l2 = (v[0] - w[0])**2 + (v[1] - w[1])**2;
  if (l2 === 0) return v;
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  return [
    v[0] + t * (w[0] - v[0]),
    v[1] + t * (w[1] - v[1])
  ];
};

// Function to update the user location point on the map
export const updateUserLocationPoint = (map: MapboxMap, coordinates: Coordinate | null) => {
  if (!map || !map.getSource) return;

  const features = [];
  if (coordinates) {
    features.push({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Point' as const,
        coordinates: coordinates
      }
    });
  }

  const userLocationSource = map.getSource('user-location-point') as GeoJSONSource | undefined;
  if (userLocationSource) {
    userLocationSource.setData({
      type: 'FeatureCollection' as const,
      features
    });
  }
};

// --- GPX Export ---
export const exportRouteToGPX = () => {
  if (waypoints.length === 0 && currentRoutePathCoordinates.length === 0) {
    console.warn('[GPX Export] No waypoints or route path to export.');
    alert('No route to export.');
    return;
  }

  let gpxString = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="WebApp Route Planner" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>Exported Route</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
`;

  // Export <rte> (route with waypoints)
  if (waypoints.length > 0) {
    gpxString += `  <rte>
    <name>Planned Route Waypoints</name>
`;
    waypoints.forEach((waypoint, index) => {
      const lat = waypoint[1];
      const lon = waypoint[0];
      gpxString += `    <rtept lat="${lat}" lon="${lon}">
`;
      gpxString += `      <name>Waypoint ${index + 1}</name>
`;
      gpxString += `    </rtept>
`;
    });
    gpxString += `  </rte>
`;
  }

  // Export <trk> (track with detailed path)
  if (currentRoutePathCoordinates.length > 0) {
    gpxString += `  <trk>
    <name>Tracked Path</name>
    <trkseg>
`;
    currentRoutePathCoordinates.forEach(coord => {
      const lat = coord[1];
      const lon = coord[0];
      gpxString += `      <trkpt lat="${lat}" lon="${lon}"></trkpt>
`;
    });
    gpxString += `    </trkseg>
  </trk>
`;
  }

  gpxString += `</gpx>`;

  try {
    const blob = new Blob([gpxString], { type: 'application/gpx+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `route_${timestamp}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    console.log('[GPX Export] Route exported successfully.');
  } catch (error) {
    console.error('[GPX Export] Error exporting route:', error);
    alert('Error exporting route. See console for details.');
  }
};


// --- GPX Import ---
export const importRouteFromGPX = async (
  gpxString: string,
  map: MapboxMap, 
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  onError?: (message: string) => void
) => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxString, "application/xml");

    const parserError = xmlDoc.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
      console.error("[GPX Import] Error parsing GPX XML:", parserError[0].textContent);
      if (onError) onError("Invalid GPX file: XML parsing error.");
      return;
    }
    
    const gpxCoords: Coordinate[] = [];
    const pointsToParse = xmlDoc.getElementsByTagName("rtept").length > 0 
      ? xmlDoc.getElementsByTagName("rtept") 
      : xmlDoc.getElementsByTagName("trkpt");

    if (pointsToParse.length > 0) {
      console.log(`[GPX Import] Found ${pointsToParse.length} <${pointsToParse[0].tagName}> elements.`);
      for (let i = 0; i < pointsToParse.length; i++) {
        const lat = pointsToParse[i].getAttribute("lat");
        const lon = pointsToParse[i].getAttribute("lon");
        if (lat && lon) {
          gpxCoords.push([parseFloat(lon), parseFloat(lat)]);
        }
      }
    } else {
      console.warn("[GPX Import] No <rtept> or <trkpt> elements found in GPX file.");
      if (onError) onError("No route or track points found in the GPX file.");
      return;
    }

    if (gpxCoords.length === 0) {
      console.warn("[GPX Import] No valid waypoints extracted from GPX.");
      if (onError) onError("Could not extract any waypoints from the GPX file.");
      return;
    }

    // Check road proximity for all points in parallel
    console.log(`[GPX Import] Checking road proximity for ${gpxCoords.length} points...`);
    const roadChecks = await Promise.all(
      gpxCoords.map(coord => checkNearRoad(coord, accessToken))
    );
    console.log("[GPX Import] Road proximity checks complete.");

    const finalNewWaypoints: Coordinate[] = [];
    const newDirectFlags: boolean[] = [];

    gpxCoords.forEach((coord, index) => {
      finalNewWaypoints.push(coord); // Always use original GPX coordinates for the initial list
      // If checkNearRoad.isValid is true (it's near a road), then directFlag should be false.
      // If checkNearRoad.isValid is false (it's NOT near a road), then directFlag should be true.
      newDirectFlags.push(!roadChecks[index].isValid);
    });

    // ADD THIS LOGGING:
    console.log("[GPX Import] Determined directFlags:", JSON.stringify(newDirectFlags));
    console.log("[GPX Import] Corresponding roadChecks:", JSON.stringify(roadChecks));

    // Reset current route and history
    resetRouting(map, setRouteDistance, setRouteDuration, setHasRoute);
    
    snapshot(); 

    waypoints = finalNewWaypoints; // Populate global waypoints with original coordinates
    directFlags = newDirectFlags;   // Populate global directFlags based on heuristic

    updatePoints(map, waypoints); // Visually update map with original points initially
    saveWaypointsToLocalStorage();

    if (waypoints.length >= 2) {
      console.log("[GPX Import] Recalculating route for imported waypoints using smart flags.");
      // getRoute will now use the directFlags. 
      // If a flag is false (heuristic said it's on-road), getRoute will attempt to snap it.
      // If a flag is true (heuristic said it's off-road), buildMixedRoute will use the original coordinate.
      await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
    } else if (waypoints.length === 1) {
      setRouteDistance('');
      setRouteDuration('');
      setHasRoute(false);
      currentRoutePathCoordinates = []; // Clear path if only one waypoint
    }

    console.log(`[GPX Import] Successfully imported ${waypoints.length} waypoints with smart direct flags.`);

  } catch (error) {
    console.error("[GPX Import] Error importing route:", error);
    if (onError) onError(`Error importing GPX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// --- New function to insert a waypoint at a specific location on the route ---
export const insertWaypointAtLocation = async (
  map: MapboxMap,
  clickedCoords: Coordinate,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  onError?: (message: string) => void // Optional error handler
) => {
  console.log('[insertWaypointAtLocation] Attempting to insert waypoint at:', clickedCoords);

  if (waypoints.length < 1) { // Need at least one waypoint to have a route segment to insert into (practically 2 for a visible route)
    console.warn('[insertWaypointAtLocation] Not enough waypoints to define a route segment.');
    if (onError) onError("Cannot add waypoint: No existing route segment.");
    return;
  }

  const routeSource = map.getSource('route') as GeoJSONSource | undefined;
  if (!routeSource) {
    console.error('[insertWaypointAtLocation] Route source not found.');
    if (onError) onError("Cannot add waypoint: Route data unavailable.");
    return;
  }

  const routeData = routeSource?._data as GeoJSON.Feature<GeoJSON.LineString> | undefined;

  if (!routeData || routeData.type !== 'Feature' || !routeData.geometry || routeData.geometry.type !== 'LineString' || !routeData.geometry.coordinates || routeData.geometry.coordinates.length === 0) {
    console.warn('[insertWaypointAtLocation] No valid route path coordinates found in route source.');
     // If currentRoutePathCoordinates has data (e.g. from mixed route), try using that as a fallback.
    if (!currentRoutePathCoordinates || currentRoutePathCoordinates.length < 2) {
        if (onError) onError("Cannot add waypoint: Route path is not defined.");
        return;
    } 
    // If routeSource._data is empty but currentRoutePathCoordinates exists, proceed with it.
    console.log('[insertWaypointAtLocation] Using currentRoutePathCoordinates as fallback for route path.');
  }

  let routePathTyped: Coordinate[];
  if (routeData?.geometry?.coordinates && routeData.geometry.coordinates.length > 0) {
    // Ensure each position is cast to Coordinate if GeoJSON types are loose (e.g. number[] instead of [number, number])
    routePathTyped = routeData.geometry.coordinates.map(p => [p[0], p[1]] as Coordinate);
  } else {
    routePathTyped = currentRoutePathCoordinates;
  }

  if (!routePathTyped || routePathTyped.length < 2) {
    console.warn('[insertWaypointAtLocation] Route path is too short or undefined even after fallback.');
    if (onError) onError("Cannot add waypoint: Route path is too short.");
    return;
  }

  let minDistance = Infinity;
  let closestPointOnRoute: Coordinate = clickedCoords; // Default to clickedCoords if no better found
  let insertIndex = waypoints.length; // Default to adding at the end if no segment found (should ideally not happen if clicked on route)

  // Find the closest point on the *detailed route path* to the clicked coordinates
  // And determine the segment of the *waypoints* this point belongs to.
  for (let i = 0; i < routePathTyped.length - 1; i++) {
    const start = routePathTyped[i]; // No more casting needed here due to routePathTyped
    const end = routePathTyped[i + 1]; // No more casting needed here
    const pointOnSegment = closestPointOnSegment(clickedCoords, start, end);
    const correctedDistance = haversine(clickedCoords, pointOnSegment);

    if (correctedDistance < minDistance) {
      minDistance = correctedDistance;
      closestPointOnRoute = pointOnSegment;

      // Now, determine which pair of *original waypoints* this segment of the routePath corresponds to.
      // This logic is similar to what's in the 'mousedown' on 'route-hover-target' handler.
      for (let j = 0; j < waypoints.length -1; j++) {
        // Find the start and end indices in routePath that correspond to waypoints[j] and waypoints[j+1]
        // This assumes waypoints are present in routePath, which is true for snapped routes.
        // For mixed routes (with direct segments), this mapping might be more complex.
        // However, `buildMixedRoute` ensures `currentRoutePathCoordinates` contains original waypoints for direct segments.
        let wpStartIndexInPath = -1;
        let wpEndIndexInPath = -1;

        // Find wpStartIndexInPath
        for(let k=0; k < routePathTyped.length; k++){
            if(routePathTyped[k][0] === waypoints[j][0] && routePathTyped[k][1] === waypoints[j][1]){
                wpStartIndexInPath = k;
                break;
            }
        }
        // Find wpEndIndexInPath
        for(let k=0; k < routePathTyped.length; k++){
            if(routePathTyped[k][0] === waypoints[j+1][0] && routePathTyped[k][1] === waypoints[j+1][1]){
                wpEndIndexInPath = k;
                break;
            }
        }
        // If both waypoints are found in the path, and our current segment `i` is between them or at the start of their segment.
        if (wpStartIndexInPath !== -1 && wpEndIndexInPath !== -1 && i >= wpStartIndexInPath && i < wpEndIndexInPath) {
          insertIndex = j + 1;
          break; // Found the correct waypoint segment
        } else if (wpStartIndexInPath !== -1 && j === waypoints.length - 2 && i >= wpStartIndexInPath) {
          // If it's the last waypoint segment, and current path segment is beyond the start of it.
          insertIndex = j + 1;
          break;
        }
      }
    }
  }
  
  // A small tolerance for clicking near the route, e.g., 50-100 meters.
  // If minDistance is too large, it means the click was likely not on the route.
  const MAX_CLICK_DISTANCE_FROM_ROUTE = 0.1; // 100 meters
  if (minDistance > MAX_CLICK_DISTANCE_FROM_ROUTE && waypoints.length >=2 ) { // only apply distance check if there is a route
    console.warn('[insertWaypointAtLocation] Click was too far from the route path. Distance:', minDistance.toFixed(3), 'km');
    // Do not show user error, just don't add point, as context menu might have appeared due to route-hover-target generosity
    // if (onError) onError("Could not add waypoint: Click too far from route.");
    return; 
  }

  console.log('[insertWaypointAtLocation] Determined insert index:', insertIndex, 'New waypoint coords:', closestPointOnRoute);

  // Snapshot current state for undo
  snapshot();

  // Insert the new waypoint
  waypoints.splice(insertIndex, 0, closestPointOnRoute);
  directFlags.splice(insertIndex, 0, false); // New waypoints on route are initially not direct

  // Update map visuals and recalculate route
  updatePoints(map, waypoints);
  if (waypoints.length >= 2) {
    await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
  }
  saveWaypointsToLocalStorage();
  console.log('[insertWaypointAtLocation] Waypoint inserted and route updated.');
};

// --- New function to set route data from external source (e.g., shared link) ---
export const setRouteData = async (
  map: MapboxMap,
  accessToken: string,
  newWaypoints: Coordinate[],
  newDirectFlags: boolean[],
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
) => {
  console.log('[setRouteData] Setting route from external data');
  resetRouting(map, setRouteDistance, setRouteDuration, setHasRoute); // Clear existing

  // Take a snapshot for undo, even though it's a fresh state from a link,
  // this makes the history consistent if the user immediately modifies it.
  snapshot(); 

  waypoints = [...newWaypoints];
  directFlags = [...newDirectFlags];

  updatePoints(map, waypoints);
  saveWaypointsToLocalStorage();

  if (waypoints.length >= 2) {
    console.log('[setRouteData] Recalculating route for loaded data.');
    await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
  } else if (waypoints.length === 1) {
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
    currentRoutePathCoordinates = []; 
  }
  console.log(`[setRouteData] Successfully set ${waypoints.length} waypoints.`);
};

// Helper function to fit the map view to the route
export const zoomToRoute = (map: MapboxMap, coordinates: Coordinate[]) => {
  if (!map || !map.getBounds || !coordinates || coordinates.length === 0) {
    console.warn('[zoomToRoute] Map not ready or no coordinates to zoom to.');
    return;
  }

  try {
    const currentPitch = map.getPitch();
    const currentBearing = map.getBearing();

    const bounds = coordinates.reduce(
      (currentBounds, coord) => {
        return currentBounds.extend(coord);
      },
      new LngLatBounds(coordinates[0], coordinates[0])
    );

    map.fitBounds(bounds, {
      padding: 75, // Uniform padding
      maxZoom: 16,
      duration: 1000,
      essential: true,
      pitch: currentPitch,      // Preserve current pitch
      bearing: currentBearing   // Preserve current bearing
    });
    console.log('[zoomToRoute] Adjusted map bounds to fit route, preserving pitch and bearing.');
  } catch (error) {
    console.error('[zoomToRoute] Error fitting bounds:', error);
  }
};