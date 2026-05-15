import type { Coordinate, RouteActivity, RoutingPreferences, Waypoint } from "@routess/core";
import { defaultPreferencesForActivity } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import { Logger } from "@/lib/logger";
import serviceWorkerManager from "@/lib/serviceWorker";
import { getSpeedForActivity, useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { useRoutingStore } from "@/stores/routingStore";
import { useUiStore } from "@/stores/uiStore";
import { getDefaultElevationService } from "./elevation";
import { type ComputeRouteOptions, computeRoute } from "./valhallaClient";

const sameCoord = (a: Coordinate, b: Coordinate) => a[0] === b[0] && a[1] === b[1];

let elevationAbort: AbortController | null = null;

const samePath = (a: Coordinate[], b: Coordinate[]): boolean => {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (!sameCoord(a[i], b[i])) return false;
	}
	return true;
};

const computeElevationInBackground = (routePath: Coordinate[], accessToken: string): void => {
	if (!accessToken || routePath.length < 2) {
		useRoutingStore.getState().clearElevation();
		useRoutingStore.getState().setIsComputingElevation(false);
		return;
	}

	elevationAbort?.abort();
	const controller = new AbortController();
	elevationAbort = controller;

	useRoutingStore.getState().setIsComputingElevation(true);

	// Elevation is computed for a specific RoutePath. The staleness check
	// compares against routePath in the store, not waypoints — waypoints
	// can mutate via snap-writeback after computeRoute returns without
	// invalidating the elevation result we computed for this exact path.
	getDefaultElevationService(accessToken)
		.sampleAndCompute(routePath, { signal: controller.signal })
		.then((result) => {
			if (controller.signal.aborted) return;
			if (!samePath(useRoutingStore.getState().routePath, routePath)) {
				Logger.info("[RCS/elevation] RoutePath changed during sampling; discarding stale elevation.");
				return;
			}
			useRoutingStore.getState().setElevation(result);
		})
		.catch((err) => {
			if (controller.signal.aborted) return;
			Logger.warn("[RCS/elevation] Failed to sample elevation:", err);
			useRoutingStore.getState().clearElevation();
		})
		.finally(() => {
			if (elevationAbort === controller) elevationAbort = null;
			if (!controller.signal.aborted) useRoutingStore.getState().setIsComputingElevation(false);
		});
};

// Reads the prefs that should drive this route's computation: prefer the
// draft's own routingPreferences (per ADR-0023); fall back to the user's
// per-Activity defaults; final fallback is the activity's built-in default.
function resolvePreferencesForDraft(activity: RouteActivity): RoutingPreferences {
	const draftPrefs = useRoutingStore.getState().routingPreferences;
	if (draftPrefs) return draftPrefs;
	const userDefaults = useRedesignSettingsStore.getState().routingDefaults;
	return userDefaults?.[activity] ?? defaultPreferencesForActivity(activity);
}

function buildComputeOptions(activity: RouteActivity): {
	prefs: RoutingPreferences;
	options: ComputeRouteOptions;
} {
	const settings = useRedesignSettingsStore.getState();
	const speedKmh = getSpeedForActivity(activity, settings.sportSpeeds);
	const prefs = resolvePreferencesForDraft(activity);
	// Walking speed for Valhalla pedestrian costing is in m/s; the user
	// configures km/h, so convert.
	const walkingSpeedMps = activity !== "cycle" ? speedKmh / 3.6 : undefined;
	return {
		prefs,
		options: {
			snap: settings.autoSnap,
			speedKmh,
			walkingSpeedMps,
		},
	};
}

const sameWaypoint = (a: Waypoint, b: Waypoint) => sameCoord(a.coord, b.coord) && a.type === b.type;

const routeInputsMatch = (waypoints: Waypoint[]): boolean => {
	const state = useRoutingStore.getState();
	return (
		state.waypoints.length === waypoints.length && state.waypoints.every((wp, i) => sameWaypoint(wp, waypoints[i]))
	);
};

const staleRouteResult = (): RouteResult => ({
	success: true,
	waypointsSnapped: false,
	error: "Route inputs changed during calculation.",
});

export interface RouteResult {
	success: boolean;
	waypointsSnapped: boolean;
	snappedWaypoints?: Waypoint[];
	error?: string;
	failedSegment?: { from: number; to: number };
}

export const getRoute = async (map: MapboxMap, accessToken: string): Promise<RouteResult> => {
	if (!map) {
		Logger.warn("[RCS/getRoute] Map is not available. Aborting.");
		return { success: false, waypointsSnapped: false };
	}

	const store = useRoutingStore.getState();
	const waypoints = store.waypoints;
	if (waypoints.length < 2) {
		store.setRoutePath([]);
		store.clearRouteMetrics();
		store.setHasRoute(false);
		elevationAbort?.abort();
		store.clearElevation();
		store.setIsComputingElevation(false);
		return { success: true, waypointsSnapped: false };
	}

	const activity = store.activity ?? useUiStore.getState().activityType;
	const { prefs, options } = buildComputeOptions(activity);
	const outcome = await computeRoute(waypoints, activity, prefs, options);

	if (!routeInputsMatch(waypoints)) {
		Logger.info("[RCS/getRoute] Route inputs changed during calculation. Discarding stale result.");
		return staleRouteResult();
	}

	if (!outcome.ok) {
		const after = useRoutingStore.getState();
		after.setHasRoute(false);
		after.setRoutePath([]);
		elevationAbort?.abort();
		after.clearElevation();
		after.setIsComputingElevation(false);
		return {
			success: false,
			waypointsSnapped: false,
			error: outcome.error,
			failedSegment: outcome.failedSegment,
		};
	}

	const after = useRoutingStore.getState();
	after.setRoutePath(outcome.routePath);

	after.setRouteMetrics({
		distanceMeters: outcome.distanceKm * 1000,
		durationSeconds: outcome.durationMinutes * 60,
		isOffline: !!outcome.offline,
	});
	after.setHasRoute(true);

	// First successful computation on this draft commits the prefs that
	// produced it (per ADR-0023). Subsequent recalcs respect whatever's
	// currently in the draft (e.g. user changed prefs via the modal).
	if (!after.routingPreferences) {
		after.setRoutingPreferences(prefs);
	}

	// Elevation runs async — distance/duration display immediately while we
	// sample terrain. Offline routes skip sampling since we can't reach the
	// terrain tileset anyway.
	if (outcome.offline) {
		useRoutingStore.getState().clearElevation();
		useRoutingStore.getState().setIsComputingElevation(false);
	} else {
		computeElevationInBackground(outcome.routePath, accessToken);
	}

	if (!outcome.offline && "serviceWorker" in navigator) {
		try {
			void serviceWorkerManager.precacheRoute({
				waypoints: waypoints.map((wp) => wp.coord),
				geometry: outcome.routePath,
				distance: outcome.distanceKm * 1000,
				duration: outcome.durationMinutes * 60,
				url: `valhalla_request_${Date.now()}`,
			});
		} catch (error) {
			Logger.warn("[RCS/getRoute] Failed to precache route:", error);
		}
	}

	return {
		success: true,
		waypointsSnapped: !!outcome.snappedWaypoints,
		snappedWaypoints: outcome.snappedWaypoints,
	};
};

// Route-path getters / setters: thin proxies to the Zustand store, which
// is the single source of truth for the active RoutePath. The MapViewAdapter
// observes routePath and reconciles route + km-marker layers automatically.
export const getCurrentRoutePath = (): Coordinate[] => [...useRoutingStore.getState().routePath];

export const clearCurrentRoutePath = (): void => {
	useRoutingStore.getState().clearRoutePath();
};

export const setCurrentRoutePath = (coordinates: Coordinate[]): void => {
	useRoutingStore.getState().setRoutePath([...coordinates]);
};
