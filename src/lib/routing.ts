import type { Dispatch, SetStateAction } from 'react';
import type { Coordinate, WaypointHistory } from '@/types/map';
import type { Map as MapboxMap, Popup } from 'mapbox-gl';

// Store references and state outside of the setup function to persist across renders
let waypoints: Coordinate[] = [];
let clickListenerAdded = false;
let contextMenuListenerAdded = false; // Track context menu (right-click) handler
let currentPopup: Popup | null = null; // Track active popup for waypoint removal tooltip
let directFlags: boolean[] = []; // parallel to waypoints, true if waypoint is direct

// --- Drag state ---
let isDragging = false;
let draggedWaypointIndex = -1;
let dragListenersAdded = false;

// --- History (Undo / Redo) ---
let undoStack: WaypointHistory[] = [];
let redoStack: WaypointHistory[] = [];

// --- Kilometer markers ---
let kmMarkersAdded = false;  // Track if km markers source/layer was added

// Export the waypoints and directFlags for external components to use
export const getWaypoints = () => waypoints;
export const getDirectFlags = () => directFlags;

// Check if a coordinate is near a road
export const checkNearRoad = async (
  coords: Coordinate,
  accessToken: string
): Promise<{ isValid: boolean; snappedCoords?: Coordinate }> => {
  try {
    // Create a query to the Mapbox API with a single point
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coords[0]},${coords[1]}?steps=true&geometries=geojson&access_token=${accessToken}&radiuses=150`;
    
    const response = await fetch(url);
    const json = await response.json();
    
    // Check if we got a valid response with waypoints
    if (json && json.code === "NoRoute") {
      console.log('[checkNearRoad] No route found for this point');
      return { isValid: false };
    }
    
    if (json && json.code === "NoSegment") {
      console.log('[checkNearRoad] No road segment found near this point');
      return { isValid: false };
    }
    
    if (json && json.waypoints && json.waypoints.length > 0) {
      const snappedCoords = json.waypoints[0].location as Coordinate;
      // Calculate distance from original to snapped point
      const dist = haversine(coords, snappedCoords);
      
      // If the snapped point is too far (150+ meters), consider it invalid
      if (dist > 0.15) {
        console.log(`[checkNearRoad] Point snapped too far (${dist.toFixed(3)}km)`);
        return { isValid: false };
      }
      
      console.log(`[checkNearRoad] Point is valid, snapped at ${dist.toFixed(3)}km distance`);
      return { 
        isValid: true,
        snappedCoords
      };
    }
    
    return { isValid: false };
  } catch (error) {
    console.error('[checkNearRoad] Error checking if point is near road:', error);
    return { isValid: false };
  }
};

// Function to add a new waypoint from an external component
export const addWaypoint = async (
  map: any, 
  coords: Coordinate, 
  isDirect: boolean,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>,
  onError?: (message: string) => void
) => {
  // For direct waypoints, or if it's the first waypoint, accept it without validation
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
  
  return true;
}

// Function to remove a waypoint from an external component
export const removeWaypoint = async (
  map: any,
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
}

const snapshot = () => {
  console.log('[snapshot] Creating snapshot, current waypoints:', waypoints.length, 'current undoStack:', undoStack.length);
  undoStack.push({
    points: waypoints.map(p => [...p]) as Coordinate[],
    flags: [...directFlags]
  });
  console.log('[snapshot] After pushing, undoStack length:', undoStack.length);
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
  console.log('[snapshot] Final undoStack:', undoStack.length, 'redoStack cleared');
};

export const stepBack = async (
  map: any,
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
};

export const stepForward = async (
  map: any,
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
};

// Helper functions to check history availability
export const hasUndo = () => {
  const result = undoStack.length > 0;
  // console.log('[hasUndo] undoStack length:', undoStack.length, 'hasUndo:', result);
  return result;
};
export const hasRedo = () => redoStack.length > 0;

// Function to update a waypoint position and recalculate the route
export const updateWaypointPositionAndRecalculate = async (
  map: any,
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
};

// Setup routing logic for a Mapbox map instance
export const setupRouting = (
  map: any, 
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
) => {
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
      
      kmMarkersAdded = true;
      console.log('[setupRouting] Successfully added kilometer markers layer');
      
      console.log('[setupRouting] Successfully added sources and layers');
    } catch (err) {
      console.error('[setupRouting] Error adding sources or layers:', err);
    }
  } else {
    console.log('[setupRouting] Sources and layers already exist');
  }

  // If we already have waypoints, re-render them (helps persist state)
  if (waypoints.length > 0) {
    updatePoints(map, waypoints);
    
    if (waypoints.length >= 2) {
      getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
    }
  }

  // Only add click handler once to prevent duplicates
  if (!clickListenerAdded) {
    console.log('[setupRouting] Adding click handler to map');
    // Add click handler
    map.on('click', async (e: any) => {
      console.log('[Map Click] Click event received at:', e.lngLat);
      if (currentPopup && currentPopup.isOpen()) {
        const popupEl = currentPopup.getElement();
        if (popupEl.querySelector('#addDirectBtn')) { // Check if it's the "Add direct waypoint" popup
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

      // --- Original logic for adding a normal waypoint starts here ---
      try {
        console.log('[Map Click] Started. Current waypoints:', waypoints.length);
        
        // Snapshot current state for undo
        snapshot();
        
        const coords = [e.lngLat.lng, e.lngLat.lat] as Coordinate;
        
        waypoints.push(coords);
        directFlags.push(false); // Normal waypoints are not direct by default
        console.log('[Map Click] Added waypoint. New count:', waypoints.length, 'New waypoint:', coords);
        
        console.log('[Map Click] Updating points on map...');
        updatePoints(map, waypoints);
        console.log('[Map Click] Points updated on map.');
        
        if (waypoints.length >= 2) {
          console.log('[Map Click] More than 1 waypoint, attempting to get route...');
          await getRoute(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
          console.log('[Map Click] getRoute call completed.');
        } else {
          console.log('[Map Click] Less than 2 waypoints, not calling getRoute.');
        }
        console.log('[Map Click] Handler finished successfully (all functions enabled).');
      } catch (error) {
        console.error('[Map Click] CRITICAL ERROR in click handler:', error);
      }
      // --- End of original logic ---
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
    map.on('contextmenu', (e: any) => {
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
          const coords = feature.geometry?.coordinates || [e.lngLat.lng, e.lngLat.lat];
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
                .setLngLat(coords)
                .setHTML(popupHTML)
                .addTo(map);
            } else if (map.Popup) {
              // Use the map's constructor to create a popup
              currentPopup = new map.Popup({
                closeButton: false,
                offset: 30,
                closeOnClick: false
              })
                .setLngLat(coords)
                .setHTML(popupHTML)
                .addTo(map);
            } else {
              console.error('[ContextMenu] No Popup constructor available');
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
            } else if (map.Popup) {
              currentPopup = new map.Popup({ 
                closeButton: false, 
                offset: 30, 
                closeOnClick: false 
              })
                .setLngLat(coordsScreen)
                .setHTML(popupHTML)
                .addTo(map);
            } else {
              console.error('[Direct ContextMenu] No Popup constructor available');
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
  if (!dragListenersAdded) {
    console.log('[setupRouting] Adding drag handlers for waypoints');
    
    // Change cursor when hovering over waypoints
    map.on('mouseenter', 'points', () => {
      map.getCanvas().style.cursor = 'grab';
    });
    
    map.on('mouseleave', 'points', () => {
      if (!isDragging) {
        map.getCanvas().style.cursor = '';
      }
    });
    
    // Start dragging
    map.on('mousedown', 'points', (e: any) => {
      // Prevent if popup is open
      if (currentPopup && currentPopup.isOpen()) return;
      
      e.preventDefault();
      
      // Check if we have a valid feature
      if (!e.features || e.features.length === 0) return;
      
      const feature = e.features[0];
      const idxRaw = feature.properties?.waypointIndex;
      const idx = typeof idxRaw === 'string' ? parseInt(idxRaw, 10) : idxRaw;
      
      if (isNaN(idx) || idx < 0 || idx >= waypoints.length) {
        console.log('[Drag] Invalid waypoint index:', idxRaw);
        return;
      }
      
      // Set dragging state
      isDragging = true;
      draggedWaypointIndex = idx;
      map.getCanvas().style.cursor = 'grabbing';
      
      // Disable map dragging during waypoint drag
      map.dragPan.disable();
      
      // Add a temporary source and layer for drag visual lines
      if (!map.getSource('temp-drag-lines')) {
        map.addSource('temp-drag-lines', {
          type: 'geojson',
          data: {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
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
      
      // Mouse move handler - update waypoint position
      const onMouseMove = (e: any) => {
        if (!isDragging) return;
        
        const coords = [e.lngLat.lng, e.lngLat.lat] as Coordinate;
        
        // Update the waypoint position (visually only, don't recalculate route yet)
        waypoints[draggedWaypointIndex] = coords;
        updatePoints(map, waypoints);
        
        // Create temporary straight lines to adjacent waypoints
        const features = [];
        
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
          tempSource.setData({
            type: 'FeatureCollection',
            features
          });
        }
        
        // The route should remain visible for other segments
        // No need to hide the entire route as we're overlaying
        // our temp lines only for the segments connected to the dragged point
      };
      
      // Mouse up handler - finalize position and recalculate route
      const onMouseUp = async () => {
        if (!isDragging) return;
        
        map.getCanvas().style.cursor = '';
        map.dragPan.enable();
        
        // Clear temporary drag lines
        const tempSource = map.getSource('temp-drag-lines');
        if (tempSource) {
          tempSource.setData({
            type: 'FeatureCollection',
            features: []
          });
        }
        
        try {
          // Remove the drag lines layer and source
          if (map.getLayer('temp-drag-lines')) {
            map.removeLayer('temp-drag-lines');
          }
          if (map.getSource('temp-drag-lines')) {
            map.removeSource('temp-drag-lines');
          }
        } catch (err) {
          console.warn('[Drag] Error removing temporary layers:', err);
        }
        
        // Save state and recalculate route
        if (draggedWaypointIndex !== -1) {
          await updateWaypointPositionAndRecalculate(
            map,
            draggedWaypointIndex,
            waypoints[draggedWaypointIndex],
            accessToken,
            setRouteDistance,
            setRouteDuration,
            setHasRoute
          );
        }
        
        // Reset dragging state
        isDragging = false;
        draggedWaypointIndex = -1;
        
        // Remove event listeners
        map.off('mousemove', onMouseMove);
        map.off('mouseup', onMouseUp);
      };
      
      // Add temporary event listeners
      map.on('mousemove', onMouseMove);
      map.on('mouseup', onMouseUp);
    });
    
    dragListenersAdded = true;
    console.log('[setupRouting] Drag handlers added successfully');
  } else {
    console.log('[setupRouting] Drag handlers already added');
  }

  // Handle clicking and dragging on the route directly
  map.on('mousedown', 'route-hover-target', (e: any) => {
    // Don't do anything if a popup is open
    if (currentPopup && currentPopup.isOpen()) return;
    
    // Prevent default browser behavior
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
    let routeData: any;
    
    try {
      routeData = routeSource._data;
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
          type: 'FeatureCollection',
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
    const onMouseMove = (e: any) => {
      if (!isDragging) return;
      
      const coords = [e.lngLat.lng, e.lngLat.lat] as Coordinate;
      
      // Update the waypoint position (visually only, don't recalculate route yet)
      waypoints[draggedWaypointIndex] = coords;
      updatePoints(map, waypoints);
      
      // Create temporary straight lines to adjacent waypoints
      const features = [];
      
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
        tempSource.setData({
          type: 'FeatureCollection',
          features
        });
      }
      
      // The route should remain visible for other segments
      // No need to hide the entire route as we're overlaying
      // our temp lines only for the segments connected to the dragged point
    };
    
    // Mouse up handler - finalize position and recalculate route
    const onMouseUp = async () => {
      if (!isDragging) return;
      
      map.getCanvas().style.cursor = '';
      map.dragPan.enable();
      
      // Clear temporary drag lines
      const tempSource = map.getSource('temp-drag-lines');
      if (tempSource) {
        tempSource.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      
      try {
        // Remove the drag lines layer and source
        if (map.getLayer('temp-drag-lines')) {
          map.removeLayer('temp-drag-lines');
        }
        if (map.getSource('temp-drag-lines')) {
          map.removeSource('temp-drag-lines');
        }
      } catch (err) {
        console.warn('[Drag] Error removing temporary layers:', err);
      }
      
      // Save state and recalculate route
      if (draggedWaypointIndex !== -1) {
        await updateWaypointPositionAndRecalculate(
          map,
          draggedWaypointIndex,
          waypoints[draggedWaypointIndex],
          accessToken,
          setRouteDistance,
          setRouteDuration,
          setHasRoute
        );
      }
      
      // Reset dragging state
      isDragging = false;
      draggedWaypointIndex = -1;
      
      // Remove event listeners
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
export const updatePoints = (map: any, points: Coordinate[]) => {
  if (!map || !map.getSource) return;
  
  const features = points.map((point, index) => {
    let pointType = 'intermediate';
    if (points.length === 1) {
      pointType = 'start'; // Or handle as a special case if desired
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
    pointsSource.setData({
      type: 'FeatureCollection',
      features
    });
  }
};

// Clear the displayed route
export const clearRoute = (map: any) => {
  if (!map || !map.getSource) return;
  
  const routeSource = map.getSource('route');
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
  const source = map.getSource('km-markers')!;
  // @ts-ignore - MapboxGL types don't properly expose setData on all source types
  source.setData({
    type: 'FeatureCollection',
    features: kmMarkers
  });
  
  console.log(`[addKilometerMarkers] Added ${kmMarkers.length} kilometer markers`);
};

// Clear kilometer markers from the map
const clearKilometerMarkers = (map: MapboxMap) => {
  if (map && map.getSource && map.getSource('km-markers')) {
    const source = map.getSource('km-markers')!;
    // @ts-ignore - MapboxGL types don't properly expose setData on all source types
    source.setData({
      type: 'FeatureCollection',
      features: []
    });
    console.log('[clearKilometerMarkers] Cleared kilometer markers');
  }
};

// Calculate and display a route between waypoints
export const getRoute = async (
  map: any, 
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
  
  if (directFlags.some(Boolean)) {
      const { coordsAccum, totalDist } = await buildMixedRoute(accessToken);
      const routeSource = map.getSource('route');
      if (routeSource) {
        routeSource.setData({ type:'Feature', properties:{}, geometry:{ type:'LineString', coordinates: coordsAccum } });
      }
      // Update marker positions based on snapped coords
      updatePoints(map, waypoints);
      const duration = Math.round(totalDist/5*60);
      setRouteDistance(`${totalDist.toFixed(2)} km`);
      setRouteDuration(`${duration} min`);
      setHasRoute(true);
      
      // Add kilometer markers along the mixed route
      addKilometerMarkers(map, coordsAccum);
      
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
      const snappedWaypoints = json.waypoints.map((wp: any) => wp.location as Coordinate);
      if (snappedWaypoints.length === currentWaypointsForAPI.length) {
        console.log('[getRoute] Snapped waypoints received:', JSON.stringify(snappedWaypoints));
        // Update the global waypoints array with the snapped coordinates
        waypoints = [...snappedWaypoints]; // Replace global waypoints with snapped ones
        console.log('[getRoute] Global waypoints updated with snapped locations.');
        // Update the visual markers on the map to their snapped positions
        updatePoints(map, waypoints); 
        console.log('[getRoute] Called updatePoints with snapped waypoints.');
      } else {
        console.warn('[getRoute] Mismatch between original and snapped waypoint counts. Not updating global waypoints.');
      }
    } else {
      console.warn('[getRoute] Snapped waypoints not found in API response.');
    }
    
    const route = data.geometry.coordinates;
    const routeSource = map.getSource('route');
    
    if (routeSource) {
      console.log('[getRoute] Updating route source on map.');
      routeSource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: route
        }
      });
      console.log('[getRoute] Route source updated.');
      
      // Add kilometer markers along the route
      addKilometerMarkers(map, route);
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
  map: any,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
) => {
  console.log('Resetting route');
  
  if (map && map.getSource) {
    clearRoute(map);
    updatePoints(map, []);
    waypoints = [];
    directFlags = [];
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
    
    // Clear kilometer markers
    clearKilometerMarkers(map);

    // Clear history stacks
    undoStack = [];
    redoStack = [];
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
  let coordsAccum: any[] = [];
  let totalDist = 0;

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
            if (!directFlags[i])   waypoints[i]   = json.waypoints[0].location;
            if (!directFlags[i+1]) waypoints[i+1] = json.waypoints[1].location;
          }
        } else {
          // No route found; convert to direct segment
          directFlags[i+1] = true;
          if (coordsAccum.length === 0) coordsAccum.push(from);
          coordsAccum.push(to);
          totalDist += haversine(from, to);
        }
      } catch(err) {
        // No route found; convert to direct segment
        directFlags[i+1] = true;
        if (coordsAccum.length === 0) coordsAccum.push(from);
        coordsAccum.push(to);
        totalDist += haversine(from, to);
      }
    }
  }
  return { coordsAccum, totalDist };
}

// Helper function to find the closest point on a line segment
const closestPointOnSegment = (p: Coordinate, v: Coordinate, w: Coordinate): Coordinate => {
  // Convert to simple points for easier calculation
  const point = { x: p[0], y: p[1] };
  const start = { x: v[0], y: v[1] };
  const end = { x: w[0], y: w[1] };
  
  // Calculate squared length of segment
  const l2 = Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2);
  
  // If segment is a point, return the point
  if (l2 === 0) return [start.x, start.y];
  
  // Calculate projection scalar
  const t = Math.max(0, Math.min(1, 
    ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / l2
  ));
  
  // Calculate projection point
  return [
    start.x + t * (end.x - start.x),
    start.y + t * (end.y - start.y)
  ];
}; 