import type { WaypointHistory, Coordinate } from '@/types/map';
import { getWaypoints, getDirectFlags, setWaypointsAndFlags } from './WaypointManager';

// --- LocalStorage Keys ---
const UNDO_STACK_STORAGE_KEY = 'routingAppHistoryUndoStack';
const REDO_STACK_STORAGE_KEY = 'routingAppHistoryRedoStack';

// --- Event Emitter ---
type HistoryEventListener = (historyState: WaypointHistory) => void;
const eventListeners: Record<string, HistoryEventListener[]> = {};

export const subscribeToHistoryChanges = (eventName: string, listener: HistoryEventListener) => {
  if (!eventListeners[eventName]) {
    eventListeners[eventName] = [];
  }
  eventListeners[eventName].push(listener);
  return () => {
    eventListeners[eventName] = eventListeners[eventName].filter(l => l !== listener);
  };
};

const emitHistoryChange = (eventName: string, historyState: WaypointHistory) => {
  if (eventListeners[eventName]) {
    eventListeners[eventName].forEach(listener => listener(historyState));
  }
};

// --- History (Undo / Redo) ---
let undoStack: WaypointHistory[] = [];
let redoStack: WaypointHistory[] = [];

// --- Helper functions for localStorage ---
const loadHistoryFromStorage = (): { undo: WaypointHistory[], redo: WaypointHistory[] } => {
  try {
    const storedUndo = localStorage.getItem(UNDO_STACK_STORAGE_KEY);
    const storedRedo = localStorage.getItem(REDO_STACK_STORAGE_KEY);
    const undo = storedUndo ? JSON.parse(storedUndo) : [];
    const redo = storedRedo ? JSON.parse(storedRedo) : [];
    console.log('[HistoryManager] Loaded history from storage. Undo:', undo.length, 'Redo:', redo.length);
    return { undo, redo };
  } catch (error) {
    console.error('[HistoryManager] Error loading history from localStorage:', error);
    return { undo: [], redo: [] }; // Return empty on error
  }
};

const saveHistoryToStorage = () => {
  try {
    localStorage.setItem(UNDO_STACK_STORAGE_KEY, JSON.stringify(undoStack));
    localStorage.setItem(REDO_STACK_STORAGE_KEY, JSON.stringify(redoStack));
    if (import.meta.env.DEV) {
      console.log('[HistoryManager] Saved history to storage. Undo:', undoStack.length, 'Redo:', redoStack.length);
    }
  } catch (error) {
    console.error('[HistoryManager] Error saving history to localStorage:', error);
  }
};

// --- Initialization and HMR ---
const reinitializeHistoryState = (fromHMR: boolean = false) => {
  const loaded = loadHistoryFromStorage();
  undoStack = loaded.undo;
  redoStack = loaded.redo;
  if (fromHMR) {
    console.log('[HistoryManager.ts] Module state re-initialized due to HMR, loaded from storage.');
  } else {
    console.log('[HistoryManager.ts] Module state initialized, loaded from storage.');
  }
  // No explicit save here, saving happens on modification
};

reinitializeHistoryState(); // Initial call

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[HistoryManager.ts] HMR disposing old instance. Current history will be saved by modification functions if needed, or reloaded on accept.');
  });
  import.meta.hot.accept(() => {
    console.log('[HistoryManager.ts] HMR accept: Forcing state re-initialization from storage.');
    reinitializeHistoryState(true);
  });
}

// --- Public API ---
export const hasUndo = (): boolean => {
  return undoStack.length > 0;
};

export const hasRedo = (): boolean => {
  return redoStack.length > 0;
};

export const snapshot = () => {
  const currentWaypointsSnapshot = getWaypoints().map(p => [...p]) as Coordinate[];
  const currentFlagsSnapshot = [...getDirectFlags()];
  
  if (import.meta.env.DEV) {
    console.log('[HistoryManager snapshot] Creating snapshot. Waypoints:', JSON.stringify(currentWaypointsSnapshot), 'Flags:', JSON.stringify(currentFlagsSnapshot));
    console.log('[HistoryManager snapshot] Current undoStack length BEFORE push:', undoStack.length);
  }

  undoStack.push({
    points: currentWaypointsSnapshot,
    flags: currentFlagsSnapshot
  });

  if (import.meta.env.DEV) {
    console.log('[HistoryManager snapshot] After pushing, undoStack length:', undoStack.length);
  }
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
  saveHistoryToStorage(); // <-- SAVE
  if (import.meta.env.DEV) {
    console.log('[HistoryManager snapshot] Final undoStack length:', undoStack.length, 'redoStack cleared and history saved.');
  }
};

export const internalDoUndo = (): WaypointHistory | null => {
  if (undoStack.length === 0) return null;
  const currentWaypoints = getWaypoints().map(p => [...p]) as Coordinate[];
  const currentFlags = [...getDirectFlags()];
  redoStack.push({ points: currentWaypoints, flags: currentFlags });
  if (redoStack.length > 50) redoStack.shift();
  const undoneState = undoStack.pop() || null;
  saveHistoryToStorage(); // <-- SAVE
  return undoneState;
}

export const internalDoRedo = (): WaypointHistory | null => {
  if (redoStack.length === 0) return null;
  const currentWaypoints = getWaypoints().map(p => [...p]) as Coordinate[];
  const currentFlags = [...getDirectFlags()];
  undoStack.push({ points: currentWaypoints, flags: currentFlags });
  if (undoStack.length > 50) undoStack.shift();
  const redoneState = redoStack.pop() || null;
  saveHistoryToStorage(); // <-- SAVE
  return redoneState;
}

export const clearHistory = () => {
  undoStack = [];
  redoStack = [];
  saveHistoryToStorage(); // <-- SAVE
  console.log('[HistoryManager] History completely cleared and saved.');
}

export const stepBack = async (): Promise<void> => {
  const prevHistoryState = internalDoUndo();
  if (!prevHistoryState) {
    console.log('[HistoryManager.stepBack] No undo state available.');
    return;
  }
  setWaypointsAndFlags(prevHistoryState.points, prevHistoryState.flags);
  emitHistoryChange('historyApplied', prevHistoryState);
  console.log('[HistoryManager.stepBack] Undo applied, event emitted. History saved by internalDoUndo.');
};

export const stepForward = async (): Promise<void> => {
  const nextHistoryState = internalDoRedo();
  if (!nextHistoryState) {
    console.log('[HistoryManager.stepForward] No redo state available.');
    return;
  }
  setWaypointsAndFlags(nextHistoryState.points, nextHistoryState.flags);
  emitHistoryChange('historyApplied', nextHistoryState);
  console.log('[HistoryManager.stepForward] Redo applied, event emitted. History saved by internalDoRedo.');
}; 