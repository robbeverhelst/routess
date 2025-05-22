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
  return undoStack.length > 0; // Can undo if there's any state on the stack (to revert to an earlier or empty state)
};

export const hasRedo = (): boolean => {
  return redoStack.length > 0;
};

export const snapshot = () => {
  if (import.meta.env.DEV) {
    console.log('[HistoryManager snapshot] Snapshot CALLED. Call stack:');
    console.trace();
  }

  const currentWaypointsSnapshot = getWaypoints().map(p => [...p]) as Coordinate[];
  const currentFlagsSnapshot = [...getDirectFlags()];

  // If the new state is identical to the current top of the undo stack, don't add it.
  if (undoStack.length > 0) {
    const lastState = undoStack[undoStack.length - 1];
    if (
      lastState && // Ensure lastState is not undefined
      JSON.stringify(lastState.points) === JSON.stringify(currentWaypointsSnapshot) &&
      JSON.stringify(lastState.flags) === JSON.stringify(currentFlagsSnapshot)
    ) {
      console.log('[HistoryManager snapshot] New state is identical to current top of undo stack. Skipping snapshot.');
      return; // Don't push identical state
    }
  }
  
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
  if (undoStack.length > 50) undoStack.shift(); // Cap the undo stack size
  
  // A new snapshot always clears the redo stack
  if (redoStack.length > 0) {
    console.log('[HistoryManager snapshot] Clearing redoStack due to new snapshot. Redo count was:', redoStack.length);
    redoStack = [];
  }
  
  saveHistoryToStorage(); 
  if (import.meta.env.DEV) {
    console.log('[HistoryManager snapshot] Final undoStack length:', undoStack.length, 'redoStack cleared and history saved.');
  }
};

export const internalDoUndo = (): WaypointHistory | null => {
  if (undoStack.length === 0) {
    console.warn('[HistoryManager internalDoUndo] Undo stack is empty.');
    return null; 
  }

  // The current live state (which is also the top of the undo stack) goes to redoStack.
  // Make sure to push a deep copy.
  const stateToPutOnRedoStack = JSON.parse(JSON.stringify(undoStack[undoStack.length - 1]));
  redoStack.push(stateToPutOnRedoStack);
  if (redoStack.length > 50) redoStack.shift(); // Cap redo stack

  // Pop the state that was current from the undo stack.
  undoStack.pop(); 

  saveHistoryToStorage(); // Save changes to both stacks

  if (undoStack.length === 0) {
    // If undo stack is now empty, it means we've undone all actions.
    // The state to apply is an "empty" or "initial" state.
    console.log('[HistoryManager internalDoUndo] Undo stack depleted. Returning empty state.');
    return { points: [], flags: [] }; 
  }

  // The state to apply is now the new top of the undo stack.
  // Return a deep copy.
  const stateToApply = JSON.parse(JSON.stringify(undoStack[undoStack.length - 1]));
  console.log('[HistoryManager internalDoUndo] State to apply after undo:', JSON.stringify(stateToApply));
  return stateToApply;
};

export const internalDoRedo = (): WaypointHistory | null => {
  if (redoStack.length === 0) {
    console.warn('[HistoryManager internalDoRedo] Redo stack is empty.');
    return null;
  }

  // The state to re-apply is popped from redoStack and also pushed to undoStack.
  // Make sure to use deep copies.
  const stateToReapply = JSON.parse(JSON.stringify(redoStack.pop()));

  undoStack.push(stateToReapply); // Push a copy
  if (undoStack.length > 50) undoStack.shift(); // Cap undo stack
  
  saveHistoryToStorage(); // Save changes to both stacks

  console.log('[HistoryManager internalDoRedo] State to reapply:', JSON.stringify(stateToReapply));
  return stateToReapply; // This is the state that becomes current
};

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