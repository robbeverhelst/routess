import { useState, useEffect } from 'react';
import {
  hasUndo as historyHasUndo,
  hasRedo as historyHasRedo,
} from '@/features/routing/managers/HistoryManager';

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedoState(): UndoRedoState {
  const [canUndo, setCanUndo] = useState<boolean>(historyHasUndo()); // Initialize with current state
  const [canRedo, setCanRedo] = useState<boolean>(historyHasRedo()); // Initialize with current state

  useEffect(() => {
    const interval = setInterval(() => {
      const currentCanUndo = historyHasUndo();
      const currentCanRedo = historyHasRedo();
      
      // Only update state if the value has actually changed to prevent unnecessary re-renders
      setCanUndo(prev => prev !== currentCanUndo ? currentCanUndo : prev);
      setCanRedo(prev => prev !== currentCanRedo ? currentCanRedo : prev);
    }, 250); // Poll at a reasonable interval (e.g., 250ms)
    
    return () => clearInterval(interval); // Cleanup interval on unmount
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  return { canUndo, canRedo };
} 