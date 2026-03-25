import { loadLastMapViewFromLocalStorage } from "@/features/routing/services/LocalStorageService";
import { Logger } from "@/lib/logger";

interface LocalStorageInitData {
	detectedRouteInLocalStorageOnInit: boolean;
	lastKnownLocationFromStorage: [number, number] | null;
	lastSavedMapView: unknown;
}

export const useLocalStorageInit = (): LocalStorageInitData => {
	// Check for initial route in localStorage
	let detectedRouteInLocalStorageOnInit = false;
	let lastKnownLocationFromStorage: [number, number] | null = null;
	let lastSavedMapView: unknown = null;

	try {
		const storedData = localStorage.getItem("mapWaypoints");
		if (storedData) {
			const parsed = JSON.parse(storedData);
			if (parsed?.waypoints && parsed.waypoints.length > 0) {
				detectedRouteInLocalStorageOnInit = true;
				Logger.info("[useLocalStorageInit] Detected route in localStorage on component initialization.");
			}
		}

		const lastKnownStr = localStorage.getItem("lastKnownLocation");
		if (lastKnownStr) {
			const parsed = JSON.parse(lastKnownStr);
			if (
				Array.isArray(parsed) &&
				parsed.length === 2 &&
				typeof parsed[0] === "number" &&
				typeof parsed[1] === "number"
			) {
				lastKnownLocationFromStorage = parsed as [number, number];
				Logger.info("[useLocalStorageInit] Detected last known location in localStorage.");
			}
		}

		lastSavedMapView = loadLastMapViewFromLocalStorage();
	} catch (e) {
		Logger.error("[useLocalStorageInit] Error reading from localStorage:", e);
	}

	return {
		detectedRouteInLocalStorageOnInit,
		lastKnownLocationFromStorage,
		lastSavedMapView,
	};
};
