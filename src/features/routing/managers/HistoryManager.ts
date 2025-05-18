import type { WaypointHistory, Coordinate } from '@/types/map';
import { getWaypoints, getDirectFlags, setWaypointsAndFlags } from './WaypointManager';
import { saveWaypointsToLocalStorage as saveWaypointsToStorage } from '@/features/routing/services/LocalStorageService'; // Still needed for stepBack/Forward initially
import type { Map as MapboxMap } from 'mapbox-gl';
import type { Dispatch, SetStateAction } from 'react';
import { getRoute as getRouteFromService, clearCurrentRoutePath, type RouteResult } from '@/features/routing/services/RouteCalculationService';
import { updateWaypointsLayer, clearRouteLayer, clearKilometerMarkersLayer } from '@/features/routing/managers/MapLayerManager';

// --- History (Undo / Redo) ---
let undoStack: WaypointHistory[] = [];
let redoStack: WaypointHistory[] = [];

export const hasUndo = (): boolean => {
  return undoStack.length > 0;
};

export const hasRedo = (): boolean => {
  return redoStack.length > 0;
};

export const snapshot = () => {
  const currentWaypointsSnapshot = getWaypoints().map(p => [...p]) as Coordinate[];
  const currentFlagsSnapshot = [...getDirectFlags()];
  
  console.log('[HistoryManager snapshot] Creating snapshot. Current waypoints:', JSON.stringify(currentWaypointsSnapshot));
  console.log('[HistoryManager snapshot] Current flags:', JSON.stringify(currentFlagsSnapshot));
  console.log('[HistoryManager snapshot] Current undoStack length BEFORE push:', undoStack.length);

  undoStack.push({
    points: currentWaypointsSnapshot,
    flags: currentFlagsSnapshot
  });

  console.log('[HistoryManager snapshot] After pushing, undoStack length:', undoStack.length);
  if (undoStack.length > 50) undoStack.shift(); // Limit undo stack size
  redoStack = []; // Clear redo stack on new action
  console.log('[HistoryManager snapshot] Final undoStack length:', undoStack.length, 'redoStack cleared.');
  // Note: saveWaypointsToStorage is called by the functions in routing.ts that use these history functions.
};

export const internalDoUndo = (): WaypointHistory | null => {
  if (undoStack.length === 0) return null;
  const currentWaypoints = getWaypoints().map(p => [...p]) as Coordinate[];
  const currentFlags = [...getDirectFlags()];
  redoStack.push({ points: currentWaypoints, flags: currentFlags });
  if (redoStack.length > 50) redoStack.shift(); // Limit stack size
  return undoStack.pop() || null;
}

export const internalDoRedo = (): WaypointHistory | null => {
  if (redoStack.length === 0) return null;
  const currentWaypoints = getWaypoints().map(p => [...p]) as Coordinate[];
  const currentFlags = [...getDirectFlags()];
  undoStack.push({ points: currentWaypoints, flags: currentFlags });
  if (undoStack.length > 50) undoStack.shift(); // Limit stack size
  return redoStack.pop() || null;
}

export const clearHistory = () => {
  undoStack = [];
  redoStack = [];
  console.log('[HistoryManager] History cleared.');
}

export const stepBack = async (
  map: MapboxMap,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
): Promise<void> => {
  const prevHistoryState = internalDoUndo();
  if (!prevHistoryState) {
    console.log('[HistoryManager.stepBack] No undo state available.');
    return;
  }

  setWaypointsAndFlags(prevHistoryState.points, prevHistoryState.flags);
  updateWaypointsLayer(map, getWaypoints());

  if (getWaypoints().length >= 2) {
    const routeResult: RouteResult = await getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
    if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
      setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
      updateWaypointsLayer(map, getWaypoints());
    }
  } else {
    clearRouteLayer(map);
    clearKilometerMarkersLayer(map);
    clearCurrentRoutePath();
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
    if (getWaypoints().length === 0) updateWaypointsLayer(map, []);
  }
  saveWaypointsToStorage(getWaypoints(), getDirectFlags());
  console.log('[HistoryManager.stepBack] Undo complete, route updated.');
};

export const stepForward = async (
  map: MapboxMap,
  accessToken: string,
  setRouteDistance: Dispatch<SetStateAction<string>>,
  setRouteDuration: Dispatch<SetStateAction<string>>,
  setHasRoute: Dispatch<SetStateAction<boolean>>
): Promise<void> => {
  const nextHistoryState = internalDoRedo();
  if (!nextHistoryState) {
    console.log('[HistoryManager.stepForward] No redo state available.');
    return;
  }

  setWaypointsAndFlags(nextHistoryState.points, nextHistoryState.flags);
  updateWaypointsLayer(map, getWaypoints());

  if (getWaypoints().length >= 2) {
    const routeResult: RouteResult = await getRouteFromService(map, accessToken, setRouteDistance, setRouteDuration, setHasRoute);
    if (routeResult.success && routeResult.waypointsSnapped && routeResult.snappedWaypoints && routeResult.snappedDirectFlags) {
      setWaypointsAndFlags(routeResult.snappedWaypoints, routeResult.snappedDirectFlags);
      updateWaypointsLayer(map, getWaypoints());
    }
  } else {
    clearRouteLayer(map);
    clearKilometerMarkersLayer(map);
    clearCurrentRoutePath();
    setRouteDistance('');
    setRouteDuration('');
    setHasRoute(false);
    if (getWaypoints().length === 0) updateWaypointsLayer(map, []);
  }
  saveWaypointsToStorage(getWaypoints(), getDirectFlags());
  console.log('[HistoryManager.stepForward] Redo complete, route updated.');
};

// stepBack and stepForward still need to be moved and refactored.
// They will need access to map, accessToken, setters for route distance/duration, etc.
// This indicates they might not fully belong in HistoryManager if they have too many external dependencies,
// or HistoryManager needs to emit events/callbacks.
// For now, we keep them in routing.ts and they will call snapshot() from here.
// When stepBack/stepForward are called from routing.ts, they will then call setWaypointsAndFlags from WaypointManager. 