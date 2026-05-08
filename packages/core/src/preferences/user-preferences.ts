export const ACTIVITIES = ["run", "cycle", "walk"] as const;
export type UserPreferenceActivity = (typeof ACTIVITIES)[number];

export const UNITS = ["km", "mi"] as const;
export type UserPreferenceUnits = (typeof UNITS)[number];

export const MAP_STYLES = ["streets", "outdoors", "satellite"] as const;
export type UserPreferenceMapStyle = (typeof MAP_STYLES)[number];

export const LOCATION_PERMISSIONS = ["unknown", "granted", "denied", "skipped"] as const;
export type UserPreferenceLocationPermission = (typeof LOCATION_PERMISSIONS)[number];

export const OVERLAY_KEYS = ["heatmap", "contour", "bike", "surface", "wind"] as const;
export type UserPreferenceOverlayKey = (typeof OVERLAY_KEYS)[number];

export type UserPreferenceOverlays = Record<UserPreferenceOverlayKey, boolean>;
export type UserPreferenceSportSpeeds = Partial<Record<UserPreferenceActivity, number>>;

export interface UserPreferences {
	units: UserPreferenceUnits;
	showPois: boolean;
	terrain3d: boolean;
	autoSnap: boolean;
	publicProfile: boolean;
	hidePrivacy: boolean;
	defaultActivity: string;
	selectedSports: UserPreferenceActivity[];
	sportSpeeds: UserPreferenceSportSpeeds;
	mapStyle: UserPreferenceMapStyle;
	overlays: UserPreferenceOverlays;
	locationPermission: UserPreferenceLocationPermission;
}

export interface UserPreferencesUpdate extends Omit<Partial<UserPreferences>, "overlays" | "sportSpeeds"> {
	overlays?: Partial<UserPreferenceOverlays>;
	sportSpeeds?: Partial<UserPreferenceSportSpeeds>;
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
	publicProfile: false,
	hidePrivacy: true,
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
	},
	locationPermission: "unknown",
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

export function isLocationPermission(value: unknown): value is UserPreferenceLocationPermission {
	return LOCATION_PERMISSIONS.includes(value as UserPreferenceLocationPermission);
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
		publicProfile:
			typeof input?.publicProfile === "boolean" ? input.publicProfile : DEFAULT_USER_PREFERENCES.publicProfile,
		hidePrivacy: typeof input?.hidePrivacy === "boolean" ? input.hidePrivacy : DEFAULT_USER_PREFERENCES.hidePrivacy,
		defaultActivity: normalizeDefaultActivity(input?.defaultActivity, selectedSports),
		selectedSports,
		sportSpeeds: normalizeSportSpeeds(input?.sportSpeeds),
		mapStyle: isMapStyle(input?.mapStyle) ? input.mapStyle : DEFAULT_USER_PREFERENCES.mapStyle,
		overlays: normalizeOverlays(input?.overlays),
		locationPermission: isLocationPermission(input?.locationPermission)
			? input.locationPermission
			: DEFAULT_USER_PREFERENCES.locationPermission,
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
	});
}
