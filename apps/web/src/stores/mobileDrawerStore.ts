import { create } from "zustand";

export const MOBILE_DRAWER_SNAPS = [0.55, 0.92] as const;
export type MobileDrawerSnap = (typeof MOBILE_DRAWER_SNAPS)[number];

interface MobileDrawerState {
	snap: MobileDrawerSnap;
	setSnap: (snap: MobileDrawerSnap) => void;
}

// Tracks the active snap point for the mobile panel drawer so that inner
// panels (e.g. RouteDetailPanel) can request a preferred snap on mount
// without prop-drilling through the panel tree.
export const useMobileDrawerStore = create<MobileDrawerState>((set) => ({
	snap: MOBILE_DRAWER_SNAPS[1],
	setSnap: (snap) => set({ snap }),
}));
