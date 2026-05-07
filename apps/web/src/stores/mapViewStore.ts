import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SolarPosition } from "@/lib/solar";

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

const LIGHT_PRESETS_ORDER: TimeOfDay[] = ["dawn", "day", "dusk", "night"];
const BEARING_PRESETS = [0, 90, 180, 270];

interface MapViewPersisted {
	lightPreset: TimeOfDay;
	showSunDirection: boolean;
}

interface MapViewState extends MapViewPersisted {
	// Transient (not persisted)
	bearing: number;
	sunPosition: SolarPosition | null;

	setLightPreset: (preset: TimeOfDay) => void;
	cycleLightPreset: () => TimeOfDay;
	setBearing: (bearing: number) => void;
	cycleBearing: () => number;
	setShowSunDirection: (show: boolean) => void;
	setSunPosition: (position: SolarPosition | null) => void;
}

export const useMapViewStore = create<MapViewState>()(
	persist(
		(set, get) => ({
			lightPreset: "day",
			showSunDirection: false,
			bearing: 0,
			sunPosition: null,

			setLightPreset: (lightPreset) => set({ lightPreset }),
			cycleLightPreset: () => {
				const current = get().lightPreset;
				const idx = LIGHT_PRESETS_ORDER.indexOf(current);
				const next = LIGHT_PRESETS_ORDER[(idx + 1) % LIGHT_PRESETS_ORDER.length];
				set({ lightPreset: next });
				return next;
			},
			setBearing: (bearing) => set({ bearing }),
			cycleBearing: () => {
				const current = get().bearing;
				const idx = BEARING_PRESETS.indexOf(current);
				const safeIdx = idx === -1 ? 0 : idx;
				const next = BEARING_PRESETS[(safeIdx + 1) % BEARING_PRESETS.length];
				set({ bearing: next });
				return next;
			},
			setShowSunDirection: (showSunDirection) => set({ showSunDirection }),
			setSunPosition: (sunPosition) => set({ sunPosition }),
		}),
		{
			name: "routess.map-view",
			version: 1,
			partialize: (state): MapViewPersisted => ({
				lightPreset: state.lightPreset,
				showSunDirection: state.showSunDirection,
			}),
		},
	),
);
