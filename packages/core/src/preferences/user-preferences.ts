import { mergeRoutingDefaults, normalizeRoutingDefaults } from "../routing/preferences";
import type { RoutingDefaults, RoutingPreferences } from "../routing/types";

export type RoutingDefaultsUpdate = Partial<Record<UserPreferenceActivity, Partial<RoutingPreferences>>>;

export const ACTIVITIES = ["run", "cycle", "walk"] as const;
export type UserPreferenceActivity = (typeof ACTIVITIES)[number];

export const UNITS = ["km", "mi"] as const;
export type UserPreferenceUnits = (typeof UNITS)[number];

export const MAP_STYLES = ["streets", "outdoors", "satellite"] as const;
export type UserPreferenceMapStyle = (typeof MAP_STYLES)[number];

import { ROUTE_VISIBILITIES, type RouteVisibility } from "../types";

export { ROUTE_VISIBILITIES, type RouteVisibility };

export const OVERLAY_KEYS = ["heatmap", "contour", "bike", "surface", "wind", "hikingNodes", "cyclingNodes"] as const;
export type UserPreferenceOverlayKey = (typeof OVERLAY_KEYS)[number];

export type UserPreferenceOverlays = Record<UserPreferenceOverlayKey, boolean>;
export type UserPreferenceSportSpeeds = Partial<Record<UserPreferenceActivity, number>>;

export interface UserPreferences {
	units: UserPreferenceUnits;
	showPois: boolean;
	terrain3d: boolean;
	autoSnap: boolean;
	defaultActivity: string;
	selectedSports: UserPreferenceActivity[];
	sportSpeeds: UserPreferenceSportSpeeds;
	mapStyle: UserPreferenceMapStyle;
	overlays: UserPreferenceOverlays;
	defaultRouteVisibility: RouteVisibility;
	routingDefaults: RoutingDefaults;
	emailOnRouteShare: boolean;
}

export interface UserPreferencesUpdate
	extends Omit<Partial<UserPreferences>, "overlays" | "sportSpeeds" | "routingDefaults"> {
	overlays?: Partial<UserPreferenceOverlays>;
	sportSpeeds?: Partial<UserPreferenceSportSpeeds>;
	routingDefaults?: RoutingDefaultsUpdate;
}

const ACTIVITY_LABELS: Record<UserPreferenceActivity, string> = {
	run: "Running",
	cycle: "Cycling",
	walk: "Walking",
};

const LABEL_TO_ACTIVITY: Record<string, UserPreferenceActivity> = {
	Running: "run",
	Cycling: "cycle",
	Walking: "walk",
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
	units: "km",
	showPois: true,
	terrain3d: false,
	autoSnap: true,
	defaultActivity: "Cycling",
	selectedSports: [],
	sportSpeeds: {},
	mapStyle: "outdoors",
	overlays: {
		heatmap: true,
		contour: false,
		bike: true,
		surface: false,
		wind: false,
		hikingNodes: false,
		cyclingNodes: false,
	},
	defaultRouteVisibility: "private",
	routingDefaults: normalizeRoutingDefaults(null),
	emailOnRouteShare: true,
};

export function isActivity(value: unknown): value is UserPreferenceActivity {
	return ACTIVITIES.includes(value as UserPreferenceActivity);
}

export function isUnits(value: unknown): value is UserPreferenceUnits {
	return UNITS.includes(value as UserPreferenceUnits);
}

export function isMapStyle(value: unknown): value is UserPreferenceMapStyle {
	return MAP_STYLES.includes(value as UserPreferenceMapStyle);
}

export function isRouteVisibility(value: unknown): value is RouteVisibility {
	return ROUTE_VISIBILITIES.includes(value as RouteVisibility);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function normalizeSelectedSports(input: unknown): UserPreferenceActivity[] {
	if (!Array.isArray(input)) {
		return [...DEFAULT_USER_PREFERENCES.selectedSports];
	}

	const seen = new Set<UserPreferenceActivity>();
	return input.filter(isActivity).filter((sport) => {
		if (seen.has(sport)) {
			return false;
		}
		seen.add(sport);
		return true;
	});
}

function normalizeDefaultActivity(input: unknown, selectedSports: UserPreferenceActivity[]): string {
	if (typeof input === "string") {
		const mappedSport = LABEL_TO_ACTIVITY[input];
		if (!mappedSport) {
			return input;
		}
		if (selectedSports.length === 0 || selectedSports.includes(mappedSport)) {
			return input;
		}
	}

	if (selectedSports.length > 0) {
		return ACTIVITY_LABELS[selectedSports[0]];
	}

	return DEFAULT_USER_PREFERENCES.defaultActivity;
}

function normalizeSportSpeeds(input: unknown): UserPreferenceSportSpeeds {
	if (!input || typeof input !== "object") {
		return { ...DEFAULT_USER_PREFERENCES.sportSpeeds };
	}

	const source = input as Record<string, unknown>;
	const next: UserPreferenceSportSpeeds = {};

	for (const activity of ACTIVITIES) {
		const value = source[activity];
		if (isFiniteNumber(value) && value > 0) {
			next[activity] = value;
		}
	}

	return next;
}

function normalizeOverlays(input: unknown): UserPreferenceOverlays {
	const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
	const result = { ...DEFAULT_USER_PREFERENCES.overlays };

	for (const key of OVERLAY_KEYS) {
		const value = source[key];
		if (typeof value === "boolean") {
			result[key] = value;
		}
	}

	return result;
}

export function normalizeUserPreferences(input?: Partial<UserPreferences> | null): UserPreferences {
	const selectedSports = normalizeSelectedSports(input?.selectedSports);

	return {
		units: isUnits(input?.units) ? input.units : DEFAULT_USER_PREFERENCES.units,
		showPois: typeof input?.showPois === "boolean" ? input.showPois : DEFAULT_USER_PREFERENCES.showPois,
		terrain3d: typeof input?.terrain3d === "boolean" ? input.terrain3d : DEFAULT_USER_PREFERENCES.terrain3d,
		autoSnap: typeof input?.autoSnap === "boolean" ? input.autoSnap : DEFAULT_USER_PREFERENCES.autoSnap,
		defaultActivity: normalizeDefaultActivity(input?.defaultActivity, selectedSports),
		selectedSports,
		sportSpeeds: normalizeSportSpeeds(input?.sportSpeeds),
		mapStyle: isMapStyle(input?.mapStyle) ? input.mapStyle : DEFAULT_USER_PREFERENCES.mapStyle,
		overlays: normalizeOverlays(input?.overlays),
		defaultRouteVisibility: isRouteVisibility(input?.defaultRouteVisibility)
			? input.defaultRouteVisibility
			: DEFAULT_USER_PREFERENCES.defaultRouteVisibility,
		routingDefaults: normalizeRoutingDefaults(input?.routingDefaults),
		emailOnRouteShare:
			typeof input?.emailOnRouteShare === "boolean"
				? input.emailOnRouteShare
				: DEFAULT_USER_PREFERENCES.emailOnRouteShare,
	};
}

export function mergeUserPreferences(
	current: UserPreferences | null | undefined,
	update: UserPreferencesUpdate,
): UserPreferences {
	const base = normalizeUserPreferences(current);

	return normalizeUserPreferences({
		...base,
		...update,
		sportSpeeds: {
			...base.sportSpeeds,
			...(update.sportSpeeds ?? {}),
		},
		overlays: {
			...base.overlays,
			...(update.overlays ?? {}),
		},
		routingDefaults: mergeRoutingDefaults(base.routingDefaults, update.routingDefaults),
	});
}
