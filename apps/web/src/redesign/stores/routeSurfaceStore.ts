import { create } from "zustand";
import type { SurfaceBreakdown } from "@/features/routing/services/SurfaceService";

interface RouteSurfaceState {
	breakdown: SurfaceBreakdown | null;
	loading: boolean;
	setBreakdown: (b: SurfaceBreakdown | null) => void;
	setLoading: (v: boolean) => void;
	reset: () => void;
}

export const useRouteSurfaceStore = create<RouteSurfaceState>((set) => ({
	breakdown: null,
	loading: false,
	setBreakdown: (b) => set({ breakdown: b }),
	setLoading: (v) => set({ loading: v }),
	reset: () => set({ breakdown: null, loading: false }),
}));
