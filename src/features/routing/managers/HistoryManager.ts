import type { WaypointHistory, Coordinate } from '@/types/map';
import { getWaypoints, getDirectFlags, setWaypointsAndFlags } from './WaypointManager';

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

const reinitializeHistoryState = () => {
  undoStack = [];
  redoStack = [];
  console.log('[HistoryManager.ts] Module state explicitly re-initialized.');
};

reinitializeHistoryState(); // Initial call

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[HistoryManager.ts] HMR disposing old instance.');
  });
  import.meta.hot.accept(() => {
    console.log('[HistoryManager.ts] HMR accept: Forcing state re-initialization.');
    reinitializeHistoryState();
  });
}

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
    console.log('[HistoryManager snapshot] Creating snapshot. Current waypoints:', JSON.stringify(currentWaypointsSnapshot));
    console.log('[HistoryManager snapshot] Current flags:', JSON.stringify(currentFlagsSnapshot));
    console.log('[HistoryManager snapshot] Current undoStack length BEFORE push:', undoStack.length);
  }

  undoStack.push({
    points: currentWaypointsSnapshot,
    flags: currentFlagsSnapshot
  });

  if (import.meta.env.DEV) {
    console.log('[HistoryManager snapshot] After pushing, undoStack length:', undoStack.length);
  }
  if (undoStack.length > 50) undoStack.shift(); // Limit undo stack size
  redoStack = []; // Clear redo stack on new action
  if (import.meta.env.DEV) {
    console.log('[HistoryManager snapshot] Final undoStack length:', undoStack.length, 'redoStack cleared.');
  }
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
  console.log('[HistoryManager] History completely cleared.');
}

export const stepBack = async (): Promise<void> => {
  const prevHistoryState = internalDoUndo();
  if (!prevHistoryState) {
    console.log('[HistoryManager.stepBack] No undo state available.');
    return;
  }
  setWaypointsAndFlags(prevHistoryState.points, prevHistoryState.flags);
  emitHistoryChange('historyApplied', prevHistoryState);
  console.log('[HistoryManager.stepBack] Undo applied, event emitted.');
};

export const stepForward = async (): Promise<void> => {
  const nextHistoryState = internalDoRedo();
  if (!nextHistoryState) {
    console.log('[HistoryManager.stepForward] No redo state available.');
    return;
  }
  setWaypointsAndFlags(nextHistoryState.points, nextHistoryState.flags);
  emitHistoryChange('historyApplied', nextHistoryState);
  console.log('[HistoryManager.stepForward] Redo applied, event emitted.');
}; 