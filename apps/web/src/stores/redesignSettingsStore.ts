import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RedesignActivity } from "./uiStore";

export type RedesignUnits = "km" | "mi";
export type RedesignMapStyle = "streets" | "outdoors" | "satellite";
export type LocationPermission = "unknown" | "granted" | "denied" | "skipped";

export type OverlayKey = "heatmap" | "contour" | "bike" | "surface" | "wind";
export type MapOverlays = Record<OverlayKey, boolean>;

export type SportSpeeds = Partial<Record<RedesignActivity, number>>;

export interface RedesignSettingsSnapshot {
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
}

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
	replaceAllSettings: (settings: RedesignSettingsSnapshot) => void;
}

export const DEFAULT_OVERLAYS: MapOverlays = {
	heatmap: true,
	contour: false,
	bike: true,
	surface: false,
	wind: false,
};

export const DEFAULT_REDESIGN_SETTINGS: RedesignSettingsSnapshot = {
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
};

function isActivity(value: unknown): value is RedesignActivity {
	return value === "run" || value === "cycle" || value === "walk";
}

function isMapStyle(value: unknown): value is RedesignMapStyle {
	return value === "streets" || value === "outdoors" || value === "satellite";
}

function isUnits(value: unknown): value is RedesignUnits {
	return value === "km" || value === "mi";
}

function isLocationPermission(value: unknown): value is LocationPermission {
	return value === "unknown" || value === "granted" || value === "denied" || value === "skipped";
}

function isFinitePositiveNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function normalizeRedesignSettings(input?: Partial<RedesignSettingsSnapshot> | null): RedesignSettingsSnapshot {
	const rawSelectedSports = Array.isArray(input?.selectedSports) ? input.selectedSports.filter(isActivity) : [];
	const selectedSports = [...new Set(rawSelectedSports)];
	const rawSportSpeeds = input?.sportSpeeds ?? {};
	const sportSpeeds: SportSpeeds = {};

	for (const activity of ["run", "cycle", "walk"] as const) {
		const value = rawSportSpeeds[activity];
		if (isFinitePositiveNumber(value)) {
			sportSpeeds[activity] = value;
		}
	}

	const rawOverlays = input?.overlays ?? {};

	return {
		units: isUnits(input?.units) ? input.units : DEFAULT_REDESIGN_SETTINGS.units,
		showPois: typeof input?.showPois === "boolean" ? input.showPois : DEFAULT_REDESIGN_SETTINGS.showPois,
		terrain3d: typeof input?.terrain3d === "boolean" ? input.terrain3d : DEFAULT_REDESIGN_SETTINGS.terrain3d,
		autoSnap: typeof input?.autoSnap === "boolean" ? input.autoSnap : DEFAULT_REDESIGN_SETTINGS.autoSnap,
		publicProfile:
			typeof input?.publicProfile === "boolean" ? input.publicProfile : DEFAULT_REDESIGN_SETTINGS.publicProfile,
		hidePrivacy: typeof input?.hidePrivacy === "boolean" ? input.hidePrivacy : DEFAULT_REDESIGN_SETTINGS.hidePrivacy,
		defaultActivity:
			typeof input?.defaultActivity === "string" ? input.defaultActivity : DEFAULT_REDESIGN_SETTINGS.defaultActivity,
		selectedSports,
		sportSpeeds,
		mapStyle: isMapStyle(input?.mapStyle) ? input.mapStyle : DEFAULT_REDESIGN_SETTINGS.mapStyle,
		overlays: {
			heatmap:
				typeof rawOverlays.heatmap === "boolean" ? rawOverlays.heatmap : DEFAULT_REDESIGN_SETTINGS.overlays.heatmap,
			contour:
				typeof rawOverlays.contour === "boolean" ? rawOverlays.contour : DEFAULT_REDESIGN_SETTINGS.overlays.contour,
			bike: typeof rawOverlays.bike === "boolean" ? rawOverlays.bike : DEFAULT_REDESIGN_SETTINGS.overlays.bike,
			surface:
				typeof rawOverlays.surface === "boolean" ? rawOverlays.surface : DEFAULT_REDESIGN_SETTINGS.overlays.surface,
			wind: typeof rawOverlays.wind === "boolean" ? rawOverlays.wind : DEFAULT_REDESIGN_SETTINGS.overlays.wind,
		},
		locationPermission: isLocationPermission(input?.locationPermission)
			? input.locationPermission
			: DEFAULT_REDESIGN_SETTINGS.locationPermission,
	};
}

export function getRedesignSettingsSnapshot(
	state: Pick<
		SettingsState,
		| "units"
		| "showPois"
		| "terrain3d"
		| "autoSnap"
		| "publicProfile"
		| "hidePrivacy"
		| "defaultActivity"
		| "selectedSports"
		| "sportSpeeds"
		| "mapStyle"
		| "overlays"
		| "locationPermission"
	>,
): RedesignSettingsSnapshot {
	return {
		units: state.units,
		showPois: state.showPois,
		terrain3d: state.terrain3d,
		autoSnap: state.autoSnap,
		publicProfile: state.publicProfile,
		hidePrivacy: state.hidePrivacy,
		defaultActivity: state.defaultActivity,
		selectedSports: [...state.selectedSports],
		sportSpeeds: { ...state.sportSpeeds },
		mapStyle: state.mapStyle,
		overlays: { ...state.overlays },
		locationPermission: state.locationPermission,
	};
}

export const useRedesignSettingsStore = create<SettingsState>()(
	persist(
		(set) => ({
			...DEFAULT_REDESIGN_SETTINGS,

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
			replaceAllSettings: (settings) => set(normalizeRedesignSettings(settings)),
		}),
		{
			name: "routess.redesign.settings",
			version: 5,
			migrate: (persisted, version) => {
				const state = persisted as Partial<RedesignSettingsSnapshot> | null;
				if (state && version < 4) {
					const stale = state.mapStyle as string | undefined;
					if (stale === "dark" || stale === "minimal" || stale === "terrain") {
						state.mapStyle = "outdoors";
					}
				}
				if (state && version < 5 && state.locationPermission === undefined) {
					state.locationPermission = "unknown";
				}
				return normalizeRedesignSettings(state);
			},
		},
	),
);
