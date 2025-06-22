import { useState, useEffect } from "react";
import {
  hasUndo as historyHasUndo,
  hasRedo as historyHasRedo,
} from "@/features/routing/managers/HistoryManager"; // Reverted import

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedoState(): UndoRedoState {
  const [canUndo, setCanUndo] = useState<boolean>(historyHasUndo()); // Call imported function
  const [canRedo, setCanRedo] = useState<boolean>(historyHasRedo()); // Call imported function

  useEffect(() => {
    const interval = setInterval(() => {
      const currentCanUndo = historyHasUndo(); // Call imported function
      const currentCanRedo = historyHasRedo(); // Call imported function

      // Only update state if the value has actually changed to prevent unnecessary re-renders
      setCanUndo((prev) => (prev !== currentCanUndo ? currentCanUndo : prev));
      setCanRedo((prev) => (prev !== currentCanRedo ? currentCanRedo : prev));
    }, 250); // Poll at a reasonable interval (e.g., 250ms)

    return () => clearInterval(interval); // Cleanup interval on unmount
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  return { canUndo, canRedo };
}
