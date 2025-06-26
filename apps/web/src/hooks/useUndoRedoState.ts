import { useCanUndo, useCanRedo } from "@/stores/routingStore";

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedoState(): UndoRedoState {
  // Get state directly from Zustand store - no polling needed!
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  return { canUndo, canRedo };
}
