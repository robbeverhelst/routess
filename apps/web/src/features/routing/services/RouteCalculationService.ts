import type { Coordinate, Waypoint } from "@routess/core";
import { formatDuration } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import { Logger } from "@/lib/logger";
import { formatDistance } from "@/lib/units";
import { activityKeyToLabel, getSpeedForActivity, useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { getRoutingPreferences } from "@/stores/routingPreferencesStore";
import { useRoutingStore } from "@/stores/routingStore";
import { useUiStore } from "@/stores/uiStore";
import { getDefaultElevationService } from "./elevation";
import { type ComputeRouteOptions, computeRoute, type DirectionsOptions } from "./RoutingEngine";
import { resolveMapboxProfile } from "./routingMode";

const sameCoord = (a: Coordinate, b: Coordinate) => a[0] === b[0] && a[1] === b[1];
const sameWaypoint = (a: Waypoint, b: Waypoint) => sameCoord(a.coord, b.coord) && a.type === b.type;

let elevationAbort: AbortController | null = null;

const computeElevationInBackground = (routePath: Coordinate[], waypoints: Waypoint[], accessToken: string): void => {
	if (!accessToken || routePath.length < 2) {
		useRoutingStore.getState().clearElevation();
		useRoutingStore.getState().setIsComputingElevation(false);
		return;
	}

	elevationAbort?.abort();
	const controller = new AbortController();
	elevationAbort = controller;

	useRoutingStore.getState().setIsComputingElevation(true);

	getDefaultElevationService(accessToken)
		.sampleAndCompute(routePath, { signal: controller.signal })
		.then((result) => {
			if (controller.signal.aborted) return;
			if (!routeInputsMatch(waypoints)) {
				Logger.info("[RCS/elevation] Inputs changed during sampling; discarding stale elevation.");
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

function buildComputeOptions(): ComputeRouteOptions {
	const prefs = getRoutingPreferences();
	const settings = useRedesignSettingsStore.getState();
	// Active sport in the planner UI drives routing + duration so switching the
	// activity tab actually re-routes and re-estimates. The persisted
	// defaultActivity only seeds the initial activityType on first load.
	const sportKey = useUiStore.getState().activityType;
	const profile = resolveMapboxProfile(activityKeyToLabel(sportKey), prefs.profile);
	const directions: DirectionsOptions = {
		profile,
		radius: 150,
		continueStraight: true,
	};
	// Mapbox only accepts `exclude=motorway` on the driving profile. Cycling
	// and walking return 422 InvalidInput if it's set, so the param is gated
	// on profile here even if the "avoid highways" preference is enabled.
	if (prefs.highways && profile === "mapbox/driving") {
		directions.exclude = ["motorway"];
	}
	const speedKmh = getSpeedForActivity(sportKey, settings.sportSpeeds);
	return { directions, snap: prefs.snap, speedKmh };
}

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
		store.setRouteDistance("");
		store.setRouteDuration("");
		store.setHasRoute(false);
		elevationAbort?.abort();
		store.clearElevation();
		store.setIsComputingElevation(false);
		return { success: true, waypointsSnapped: false };
	}

	const outcome = await computeRoute(waypoints, accessToken, buildComputeOptions());

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
		return { success: false, waypointsSnapped: false, error: outcome.error };
	}

	const after = useRoutingStore.getState();
	after.setRoutePath(outcome.routePath);

	const offlineSuffix = outcome.offline ? " (offline)" : "";
	const durationSuffix = outcome.offline ? " (estimated)" : "";
	const units = useRedesignSettingsStore.getState().units === "mi" ? "mi" : "km";
	after.setRouteDistance(formatDistance(outcome.distanceKm, units) + offlineSuffix);
	after.setRouteDuration(formatDuration(outcome.durationMinutes) + durationSuffix);
	after.setHasRoute(true);

	// Elevation runs async — distance/duration display immediately while we
	// sample terrain. Offline routes skip sampling since we can't reach the
	// terrain tileset anyway.
	if (outcome.offline) {
		useRoutingStore.getState().clearElevation();
		useRoutingStore.getState().setIsComputingElevation(false);
	} else {
		computeElevationInBackground(outcome.routePath, waypoints, accessToken);
	}

	if (!outcome.offline && "serviceWorker" in navigator) {
		try {
			navigator.serviceWorker.ready.then((registration) => {
				if (registration.active) {
					registration.active.postMessage({
						type: "PRECACHE_ROUTE",
						data: {
							routeData: {
								waypoints: waypoints.map((wp) => wp.coord),
								geometry: outcome.routePath,
								distance: outcome.distanceKm * 1000,
								duration: outcome.durationMinutes * 60,
								url: `directions_api_request_${Date.now()}`,
							},
						},
					});
				}
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
