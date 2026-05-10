import { create } from "zustand";

interface WaypointHoverState {
	hoveredWaypointIndex: number | null;
	setHover: (index: number | null) => void;
	clearHover: () => void;
}

// Ephemeral UI state shared between the waypoint sidebar list and the
// map waypoint markers. Lives outside routingStore so it doesn't end up
// in undo/redo or persistence.
export const useWaypointHoverStore = create<WaypointHoverState>((set) => ({
	hoveredWaypointIndex: null,
	setHover: (index) => set({ hoveredWaypointIndex: index }),
	clearHover: () => set({ hoveredWaypointIndex: null }),
}));
