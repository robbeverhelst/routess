import { create } from "zustand";

interface TrashRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

interface WaypointDragState {
	// True while a waypoint is lifted by a touch drag on the map.
	isTouchDragging: boolean;
	// True while the dragged waypoint hovers the trash drop zone.
	isOverTrash: boolean;
	// Client-coordinate rect of the trash zone, registered by the overlay.
	trashRect: TrashRect | null;
	startTouchDrag: () => void;
	endTouchDrag: () => void;
	setOverTrash: (over: boolean) => void;
	setTrashRect: (rect: TrashRect | null) => void;
}

// Ephemeral UI state shared between MapInteractionManager (non-React) and the
// WaypointDragTrash overlay. Lives outside routingStore so it doesn't end up
// in undo/redo or persistence.
export const useWaypointDragStore = create<WaypointDragState>((set) => ({
	isTouchDragging: false,
	isOverTrash: false,
	trashRect: null,
	startTouchDrag: () => set({ isTouchDragging: true, isOverTrash: false }),
	endTouchDrag: () => set({ isTouchDragging: false, isOverTrash: false }),
	setOverTrash: (over) => set({ isOverTrash: over }),
	setTrashRect: (rect) => set({ trashRect: rect }),
}));
