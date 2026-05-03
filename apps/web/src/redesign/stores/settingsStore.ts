import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RedesignUnits = "km" | "mi";
export type RedesignMapStyle = "streets" | "outdoors" | "satellite" | "terrain" | "dark" | "minimal";

export type OverlayKey = "heatmap" | "contour" | "bike" | "surface" | "wind";
export type MapOverlays = Record<OverlayKey, boolean>;

interface SettingsState {
	units: RedesignUnits;
	showPois: boolean;
	terrain3d: boolean;
	autoSnap: boolean;
	publicProfile: boolean;
	hidePrivacy: boolean;
	defaultActivity: string;
	mapStyle: RedesignMapStyle;
	overlays: MapOverlays;

	setUnits: (units: RedesignUnits) => void;
	setShowPois: (showPois: boolean) => void;
	setTerrain3d: (terrain3d: boolean) => void;
	setAutoSnap: (autoSnap: boolean) => void;
	setPublicProfile: (publicProfile: boolean) => void;
	setHidePrivacy: (hidePrivacy: boolean) => void;
	setDefaultActivity: (defaultActivity: string) => void;
	setMapStyle: (mapStyle: RedesignMapStyle) => void;
	setOverlay: (key: OverlayKey, value: boolean) => void;
}

const DEFAULT_OVERLAYS: MapOverlays = {
	heatmap: true,
	contour: false,
	bike: true,
	surface: false,
	wind: false,
};

export const useRedesignSettingsStore = create<SettingsState>()(
	persist(
		(set) => ({
			units: "km",
			showPois: true,
			terrain3d: false,
			autoSnap: true,
			publicProfile: false,
			hidePrivacy: true,
			defaultActivity: "Cycling",
			mapStyle: "outdoors",
			overlays: DEFAULT_OVERLAYS,

			setUnits: (units) => set({ units }),
			setShowPois: (showPois) => set({ showPois }),
			setTerrain3d: (terrain3d) => set({ terrain3d }),
			setAutoSnap: (autoSnap) => set({ autoSnap }),
			setPublicProfile: (publicProfile) => set({ publicProfile }),
			setHidePrivacy: (hidePrivacy) => set({ hidePrivacy }),
			setDefaultActivity: (defaultActivity) => set({ defaultActivity }),
			setMapStyle: (mapStyle) => set({ mapStyle }),
			setOverlay: (key, value) =>
				set((state) => ({
					overlays: { ...state.overlays, [key]: value },
				})),
		}),
		{
			name: "routess.redesign.settings",
			version: 2,
		},
	),
);
