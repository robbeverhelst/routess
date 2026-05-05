import type { Coordinate, Waypoint } from "@routess/core";
import { formatDuration } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import { Logger } from "@/lib/logger";
import { formatDistance } from "@/lib/units";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { getRoutingPreferences } from "@/stores/routingPreferencesStore";
import { useRoutingStore } from "@/stores/routingStore";
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
	const defaultActivity = useRedesignSettingsStore.getState().defaultActivity;
	const profile = resolveMapboxProfile(defaultActivity, prefs.profile);
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
	return { directions, snap: prefs.snap };
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

export const getRoute = async (
	map: MapboxMap,
	accessToken: string,
	setRouteDistance: Dispatch<SetStateAction<string>>,
	setRouteDuration: Dispatch<SetStateAction<string>>,
	setHasRoute: Dispatch<SetStateAction<boolean>>,
): Promise<RouteResult> => {
	if (!map) {
		Logger.warn("[RCS/getRoute] Map is not available. Aborting.");
		return { success: false, waypointsSnapped: false };
	}

	const waypoints = useRoutingStore.getState().waypoints;
	if (waypoints.length < 2) {
		useRoutingStore.getState().setRoutePath([]);
		setRouteDistance("");
		setRouteDuration("");
		setHasRoute(false);
		elevationAbort?.abort();
		useRoutingStore.getState().clearElevation();
		useRoutingStore.getState().setIsComputingElevation(false);
		return { success: true, waypointsSnapped: false };
	}

	const outcome = await computeRoute(waypoints, accessToken, buildComputeOptions());

	if (!routeInputsMatch(waypoints)) {
		Logger.info("[RCS/getRoute] Route inputs changed during calculation. Discarding stale result.");
		return staleRouteResult();
	}

	if (!outcome.ok) {
		setHasRoute(false);
		useRoutingStore.getState().setRoutePath([]);
		elevationAbort?.abort();
		useRoutingStore.getState().clearElevation();
		useRoutingStore.getState().setIsComputingElevation(false);
		return { success: false, waypointsSnapped: false, error: outcome.error };
	}

	useRoutingStore.getState().setRoutePath(outcome.routePath);

	const offlineSuffix = outcome.offline ? " (offline)" : "";
	const durationSuffix = outcome.offline ? " (estimated)" : "";
	const units = useRedesignSettingsStore.getState().units === "mi" ? "mi" : "km";
	setRouteDistance(formatDistance(outcome.distanceKm, units) + offlineSuffix);
	setRouteDuration(formatDuration(outcome.durationMinutes) + durationSuffix);
	setHasRoute(true);

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
