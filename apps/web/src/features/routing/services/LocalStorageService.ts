import type { Waypoint } from "@routess/core";
import type { TimeOfDay } from "@/components/ui/route-controls";
import type { SupportedLanguage } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { isDev } from "@/lib/utils/env";
import type { Coordinate } from "@/types/map";

const WAYPOINTS_STORAGE_KEY = "mapWaypoints";

interface StoredRouteData {
	waypoints: Waypoint[];
}

// Legacy storage shape (Coordinate[] + boolean[]); read for backward compatibility.
interface LegacyStoredRouteData {
	waypoints: Coordinate[];
	directFlags: boolean[];
}

export const saveWaypointsToLocalStorage = (waypoints: Waypoint[]): void => {
	try {
		const data: StoredRouteData = { waypoints };
		localStorage.setItem(WAYPOINTS_STORAGE_KEY, JSON.stringify(data));
		Logger.info("[LocalStorageService] Saved waypoints to local storage");
	} catch (error) {
		Logger.error("[LocalStorageService] Error saving waypoints to local storage:", error);
	}
};

const isCoordinate = (value: unknown): value is Coordinate =>
	Array.isArray(value) && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number";

const isWaypoint = (value: unknown): value is Waypoint => {
	if (!value || typeof value !== "object") return false;
	const candidate = value as { coord?: unknown; type?: unknown };
	return isCoordinate(candidate.coord) && (candidate.type === "routed" || candidate.type === "direct");
};

export const loadWaypointsFromLocalStorage = (): Waypoint[] | null => {
	try {
		const data = localStorage.getItem(WAYPOINTS_STORAGE_KEY);
		if (!data) return null;
		const parsed = JSON.parse(data) as Partial<StoredRouteData & LegacyStoredRouteData>;

		if (parsed && Array.isArray(parsed.waypoints) && parsed.waypoints.every(isWaypoint)) {
			Logger.info("[LocalStorageService] Loaded waypoints from local storage:", parsed.waypoints.length);
			return parsed.waypoints;
		}

		// Legacy migration: parallel arrays.
		if (parsed && Array.isArray(parsed.waypoints) && Array.isArray(parsed.directFlags)) {
			const coords = parsed.waypoints as unknown[];
			const flags = parsed.directFlags as unknown[];
			if (coords.every(isCoordinate) && flags.every((f) => typeof f === "boolean")) {
				const migrated: Waypoint[] = (coords as Coordinate[]).map((coord, i) => ({
					coord,
					type: (flags[i] as boolean) ? "direct" : "routed",
				}));
				Logger.info("[LocalStorageService] Migrated legacy waypoints from local storage:", migrated.length);
				return migrated;
			}
		}

		Logger.warn("[LocalStorageService] Stored waypoint data has unexpected shape:", parsed);
		return null;
	} catch (error) {
		Logger.error("[LocalStorageService] Error loading waypoints from local storage:", error);
		return null;
	}
};

const MAP_LOCK_STATE_KEY = "routingAppMapLockState";

export const saveMapLockStateToLocalStorage = (isLocked: boolean): void => {
	try {
		localStorage.setItem(MAP_LOCK_STATE_KEY, JSON.stringify(isLocked));
		if (isDev()) {
			Logger.info(`[LocalStorageService] Saved map lock state: ${isLocked}`);
		}
	} catch (error) {
		Logger.error("[LocalStorageService] Error saving map lock state:", error);
	}
};

export const loadMapLockStateFromLocalStorage = (): boolean => {
	try {
		const storedState = localStorage.getItem(MAP_LOCK_STATE_KEY);
		if (storedState === null) {
			Logger.info("[LocalStorageService] No map lock state found, defaulting to false (unlocked).");
			return false;
		}
		const isLocked = JSON.parse(storedState);
		if (isDev()) {
			Logger.info(`[LocalStorageService] Loaded map lock state: ${isLocked}`);
		}
		return typeof isLocked === "boolean" ? isLocked : false;
	} catch (error) {
		Logger.error("[LocalStorageService] Error loading map lock state:", error);
		return false;
	}
};

const LIGHT_PRESET_KEY = "mapLightPreset";

export function loadLightPresetFromLocalStorage(): TimeOfDay | null {
	try {
		const storedPreset = localStorage.getItem(LIGHT_PRESET_KEY);
		if (storedPreset) {
			const knownPresets: TimeOfDay[] = ["dawn", "day", "dusk", "night"];
			if (knownPresets.includes(storedPreset as TimeOfDay)) {
				return storedPreset as TimeOfDay;
			}
			Logger.warn("[LocalStorageService] Invalid light preset found in localStorage:", storedPreset);
			localStorage.removeItem(LIGHT_PRESET_KEY);
		}
		return null;
	} catch (error) {
		Logger.error("[LocalStorageService] Error loading light preset from localStorage:", error);
		return null;
	}
}

export function saveLightPresetToLocalStorage(preset: TimeOfDay): void {
	try {
		localStorage.setItem(LIGHT_PRESET_KEY, preset);
	} catch (error) {
		Logger.error("[LocalStorageService] Error saving light preset to localStorage:", error);
	}
}

const LAST_MAP_VIEW_KEY = "mapLastView";

export interface MapViewState {
	longitude: number;
	latitude: number;
	zoom: number;
	bearing: number;
	pitch: number;
}

export function loadLastMapViewFromLocalStorage(): MapViewState | null {
	try {
		const storedView = localStorage.getItem(LAST_MAP_VIEW_KEY);
		if (storedView) {
			const parsedView = JSON.parse(storedView) as MapViewState;
			if (
				parsedView &&
				typeof parsedView.longitude === "number" &&
				typeof parsedView.latitude === "number" &&
				typeof parsedView.zoom === "number" &&
				typeof parsedView.bearing === "number" &&
				typeof parsedView.pitch === "number"
			) {
				return parsedView;
			}
			Logger.warn("[LocalStorageService] Invalid map view state found in localStorage:", parsedView);
			localStorage.removeItem(LAST_MAP_VIEW_KEY);
		}
		return null;
	} catch (error) {
		Logger.error("[LocalStorageService] Error loading map view state from localStorage:", error);
		return null;
	}
}

export function saveLastMapViewToLocalStorage(viewState: MapViewState): void {
	try {
		localStorage.setItem(LAST_MAP_VIEW_KEY, JSON.stringify(viewState));
	} catch (error) {
		Logger.error("[LocalStorageService] Error saving map view state to localStorage:", error);
	}
}

const LANGUAGE_STORAGE_KEY = "routingAppLanguage";

export function loadLanguageFromLocalStorage(): SupportedLanguage {
	try {
		const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
		if (storedLanguage) {
			const knownLanguages: SupportedLanguage[] = ["en", "nl", "fr", "de"];
			if (knownLanguages.includes(storedLanguage as SupportedLanguage)) {
				Logger.info(`[LocalStorageService] Loaded language from localStorage: ${storedLanguage}`);
				return storedLanguage as SupportedLanguage;
			}
			Logger.warn(
				`[LocalStorageService] Invalid language '${storedLanguage}' found in localStorage. Will try browser language or default.`,
			);
		}
	} catch (error) {
		Logger.error("[LocalStorageService] Error loading language from localStorage:", error);
	}

	let languageToSet: SupportedLanguage = "en";

	if (typeof navigator !== "undefined" && navigator.language) {
		const browserLangPrimary = navigator.language.split("-")[0].toLowerCase();
		const knownLanguages: SupportedLanguage[] = ["en", "nl", "fr", "de"];
		if (knownLanguages.includes(browserLangPrimary as SupportedLanguage)) {
			languageToSet = browserLangPrimary as SupportedLanguage;
			Logger.info(`[LocalStorageService] Using browser language: ${languageToSet}.`);
		} else {
			Logger.info(
				`[LocalStorageService] Browser language '${browserLangPrimary}' (from '${navigator.language}') is not directly supported. Defaulting to '${languageToSet}'.`,
			);
		}
	} else {
		Logger.info(`[LocalStorageService] Browser language not available. Defaulting to '${languageToSet}'.`);
	}

	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, languageToSet);
		Logger.info(`[LocalStorageService] Saved language '${languageToSet}' to localStorage.`);
	} catch (error) {
		Logger.error(`[LocalStorageService] Error saving determined language '${languageToSet}' to localStorage:`, error);
	}

	return languageToSet;
}

export function saveLanguageToLocalStorage(language: SupportedLanguage): void {
	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
		if (isDev()) {
			Logger.info(`[LocalStorageService] Saved language: ${language}`);
		}
	} catch (error) {
		Logger.error("[LocalStorageService] Error saving language to localStorage:", error);
	}
}

const MAP_STYLE_KEY = "mapStyle";

export type MapStyle = "standard" | "satellite";

export function loadMapStyleFromLocalStorage(): MapStyle {
	try {
		const storedStyle = localStorage.getItem(MAP_STYLE_KEY);
		if (storedStyle) {
			const knownStyles: MapStyle[] = ["standard", "satellite"];
			if (knownStyles.includes(storedStyle as MapStyle)) {
				Logger.info(`[LocalStorageService] Loaded map style from localStorage: ${storedStyle}`);
				return storedStyle as MapStyle;
			}
			Logger.warn(
				`[LocalStorageService] Invalid map style '${storedStyle}' found in localStorage. Defaulting to 'standard'.`,
			);
			localStorage.removeItem(MAP_STYLE_KEY);
		}
		return "standard";
	} catch (error) {
		Logger.error("[LocalStorageService] Error loading map style from localStorage:", error);
		return "standard";
	}
}

export function saveMapStyleToLocalStorage(style: MapStyle): void {
	try {
		localStorage.setItem(MAP_STYLE_KEY, style);
	} catch (error) {
		Logger.error("[LocalStorageService] Error saving map style to localStorage:", error);
	}
}

const SUN_DIRECTION_STORAGE_KEY = "routingAppShowSunDirection";

export function loadSunDirectionSettingFromLocalStorage(): boolean {
	try {
		const storedSetting = localStorage.getItem(SUN_DIRECTION_STORAGE_KEY);
		if (storedSetting !== null) {
			const isEnabled = JSON.parse(storedSetting);
			return typeof isEnabled === "boolean" ? isEnabled : false;
		}
		return false;
	} catch (error) {
		Logger.error("[LocalStorageService] Error loading sun direction setting from localStorage:", error);
		return false;
	}
}

export function saveSunDirectionSettingToLocalStorage(enabled: boolean): void {
	try {
		localStorage.setItem(SUN_DIRECTION_STORAGE_KEY, JSON.stringify(enabled));
	} catch (error) {
		Logger.error("[LocalStorageService] Error saving sun direction setting to localStorage:", error);
	}
}
