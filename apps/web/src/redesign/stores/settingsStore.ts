import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RedesignActivity } from "./uiStore";

export type RedesignUnits = "km" | "mi";
export type RedesignMapStyle = "streets" | "outdoors" | "satellite";
export type LocationPermission = "unknown" | "granted" | "denied" | "skipped";

export type OverlayKey = "heatmap" | "contour" | "bike" | "surface" | "wind";
export type MapOverlays = Record<OverlayKey, boolean>;

export type SportSpeeds = Partial<Record<RedesignActivity, number>>;

export const DEFAULT_SPORT_SPEEDS_KMH: Record<RedesignActivity, number> = {
	run: 10,
	cycle: 25,
	walk: 5,
};

interface SettingsState {
	units: RedesignUnits;
	showPois: boolean;
	terrain3d: boolean;
	autoSnap: boolean;
	publicProfile: boolean;
	hidePrivacy: boolean;
	defaultActivity: string;
	selectedSports: RedesignActivity[];
	sportSpeeds: SportSpeeds;
	mapStyle: RedesignMapStyle;
	overlays: MapOverlays;
	locationPermission: LocationPermission;

	setUnits: (units: RedesignUnits) => void;
	setShowPois: (showPois: boolean) => void;
	setTerrain3d: (terrain3d: boolean) => void;
	setAutoSnap: (autoSnap: boolean) => void;
	setPublicProfile: (publicProfile: boolean) => void;
	setHidePrivacy: (hidePrivacy: boolean) => void;
	setDefaultActivity: (defaultActivity: string) => void;
	setSelectedSports: (sports: RedesignActivity[]) => void;
	toggleSport: (sport: RedesignActivity) => void;
	setSportSpeed: (sport: RedesignActivity, kmh: number) => void;
	setMapStyle: (mapStyle: RedesignMapStyle) => void;
	setOverlay: (key: OverlayKey, value: boolean) => void;
	setLocationPermission: (permission: LocationPermission) => void;
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
			selectedSports: [],
			sportSpeeds: {},
			mapStyle: "outdoors",
			overlays: DEFAULT_OVERLAYS,
			locationPermission: "unknown",

			setUnits: (units) => set({ units }),
			setShowPois: (showPois) => set({ showPois }),
			setTerrain3d: (terrain3d) => set({ terrain3d }),
			setAutoSnap: (autoSnap) => set({ autoSnap }),
			setPublicProfile: (publicProfile) => set({ publicProfile }),
			setHidePrivacy: (hidePrivacy) => set({ hidePrivacy }),
			setDefaultActivity: (defaultActivity) => set({ defaultActivity }),
			setSelectedSports: (selectedSports) => set({ selectedSports }),
			toggleSport: (sport) =>
				set((state) => ({
					selectedSports: state.selectedSports.includes(sport)
						? state.selectedSports.filter((s) => s !== sport)
						: [...state.selectedSports, sport],
				})),
			setSportSpeed: (sport, kmh) =>
				set((state) => ({
					sportSpeeds: { ...state.sportSpeeds, [sport]: kmh },
				})),
			setMapStyle: (mapStyle) => set({ mapStyle }),
			setOverlay: (key, value) =>
				set((state) => ({
					overlays: { ...state.overlays, [key]: value },
				})),
			setLocationPermission: (locationPermission) => set({ locationPermission }),
		}),
		{
			name: "routess.redesign.settings",
			version: 5,
			migrate: (persisted, version) => {
				const state = persisted as Partial<SettingsState> | null;
				if (state && version < 4) {
					const stale = state.mapStyle as string | undefined;
					if (stale === "dark" || stale === "minimal" || stale === "terrain") {
						state.mapStyle = "outdoors";
					}
				}
				if (state && version < 5 && state.locationPermission === undefined) {
					state.locationPermission = "unknown";
				}
				return state as SettingsState;
			},
		},
	),
);
