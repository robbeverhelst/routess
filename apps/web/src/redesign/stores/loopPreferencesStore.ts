import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LoopDirection = "any" | "n" | "e" | "s" | "w";
export type LoopSurface = "Mixed" | "Roads only" | "Trails" | "Paved bike paths";

interface LoopPreferencesState {
	distanceKm: number;
	direction: LoopDirection;
	surface: LoopSurface;

	setDistanceKm: (v: number) => void;
	setDirection: (v: LoopDirection) => void;
	setSurface: (v: LoopSurface) => void;
}

export const useLoopPreferencesStore = create<LoopPreferencesState>()(
	persist(
		(set) => ({
			distanceKm: 12,
			direction: "any",
			surface: "Mixed",
			setDistanceKm: (distanceKm) => set({ distanceKm }),
			setDirection: (direction) => set({ direction }),
			setSurface: (surface) => set({ surface }),
		}),
		{
			name: "routess.redesign.loop-prefs",
			version: 1,
		},
	),
);
