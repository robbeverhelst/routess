import { supportedLanguages } from "@routess/i18n";
import type { SupportedLanguage } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { isDev } from "@/lib/utils/env";

type TimeOfDay = "dawn" | "day" | "dusk" | "night";

// UI preferences not owned by the routing store. The routing store
// (waypoints, routePath, isMapLocked, etc.) is persisted via Zustand
// persist under the "routing-store" key — those concerns no longer live
// here.

const LIGHT_PRESET_KEY = "mapLightPreset";
const LAST_MAP_VIEW_KEY = "mapLastView";
const LANGUAGE_STORAGE_KEY = "routingAppLanguage";
const SUN_DIRECTION_STORAGE_KEY = "routingAppShowSunDirection";

const KNOWN_TIME_OF_DAY: TimeOfDay[] = ["dawn", "day", "dusk", "night"];

export type MapStyle = "standard" | "satellite";

export interface MapViewState {
	longitude: number;
	latitude: number;
	zoom: number;
	bearing: number;
	pitch: number;
}

function readJson<T>(key: string, validate: (value: unknown) => value is T): T | null {
	try {
		const raw = localStorage.getItem(key);
		if (raw === null) return null;
		const parsed = JSON.parse(raw) as unknown;
		return validate(parsed) ? parsed : null;
	} catch (error) {
		Logger.error(`[LocalStorageService] Error reading ${key}:`, error);
		return null;
	}
}

function writeJson(key: string, value: unknown): void {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch (error) {
		Logger.error(`[LocalStorageService] Error writing ${key}:`, error);
	}
}

function readEnum<T extends string>(key: string, allowed: readonly T[], fallback?: T): T | null {
	try {
		const raw = localStorage.getItem(key);
		if (raw === null) return fallback ?? null;
		if ((allowed as readonly string[]).includes(raw)) return raw as T;
		Logger.warn(`[LocalStorageService] Invalid value for ${key}:`, raw);
		localStorage.removeItem(key);
		return fallback ?? null;
	} catch (error) {
		Logger.error(`[LocalStorageService] Error reading ${key}:`, error);
		return fallback ?? null;
	}
}

// --- Light preset (time of day) ---

export function loadLightPresetFromLocalStorage(): TimeOfDay | null {
	return readEnum(LIGHT_PRESET_KEY, KNOWN_TIME_OF_DAY);
}

export function saveLightPresetToLocalStorage(preset: TimeOfDay): void {
	try {
		localStorage.setItem(LIGHT_PRESET_KEY, preset);
	} catch (error) {
		Logger.error("[LocalStorageService] Error saving light preset:", error);
	}
}

// --- Map view (camera position) ---

const isMapViewState = (value: unknown): value is MapViewState => {
	if (!value || typeof value !== "object") return false;
	const v = value as Partial<MapViewState>;
	return (
		typeof v.longitude === "number" &&
		typeof v.latitude === "number" &&
		typeof v.zoom === "number" &&
		typeof v.bearing === "number" &&
		typeof v.pitch === "number"
	);
};

export function loadLastMapViewFromLocalStorage(): MapViewState | null {
	return readJson(LAST_MAP_VIEW_KEY, isMapViewState);
}

export function saveLastMapViewToLocalStorage(viewState: MapViewState): void {
	writeJson(LAST_MAP_VIEW_KEY, viewState);
}

// --- Language ---

export function loadLanguageFromLocalStorage(): SupportedLanguage {
	const stored = readEnum(LANGUAGE_STORAGE_KEY, supportedLanguages);
	if (stored) {
		Logger.info(`[LocalStorageService] Loaded language from localStorage: ${stored}`);
		return stored;
	}

	let languageToSet: SupportedLanguage = "en";
	if (typeof navigator !== "undefined" && navigator.language) {
		const browserLang = navigator.language.split("-")[0].toLowerCase();
		if ((supportedLanguages as readonly string[]).includes(browserLang)) {
			languageToSet = browserLang as SupportedLanguage;
			Logger.info(`[LocalStorageService] Using browser language: ${languageToSet}`);
		}
	}

	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, languageToSet);
	} catch (error) {
		Logger.error(`[LocalStorageService] Error saving determined language:`, error);
	}
	return languageToSet;
}

export function saveLanguageToLocalStorage(language: SupportedLanguage): void {
	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
		if (isDev()) Logger.info(`[LocalStorageService] Saved language: ${language}`);
	} catch (error) {
		Logger.error("[LocalStorageService] Error saving language:", error);
	}
}

// --- Sun direction ---

export function loadSunDirectionSettingFromLocalStorage(): boolean {
	return readJson(SUN_DIRECTION_STORAGE_KEY, (value): value is boolean => typeof value === "boolean") ?? false;
}

export function saveSunDirectionSettingToLocalStorage(enabled: boolean): void {
	writeJson(SUN_DIRECTION_STORAGE_KEY, enabled);
}
