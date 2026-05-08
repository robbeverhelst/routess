import { create } from "zustand";

interface RouteScrubState {
	hoveredDistanceMeters: number | null;
	setHover: (meters: number | null) => void;
	clearHover: () => void;
}

// Ephemeral UI state for the RouteProfileChart hover/scrub indicator.
// Lives outside routingStore on purpose — it isn't part of the RouteDraft
// and shouldn't show up in undo/redo or persistence.
export const useRouteScrubStore = create<RouteScrubState>((set) => ({
	hoveredDistanceMeters: null,
	setHover: (meters) => set({ hoveredDistanceMeters: meters }),
	clearHover: () => set({ hoveredDistanceMeters: null }),
}));
