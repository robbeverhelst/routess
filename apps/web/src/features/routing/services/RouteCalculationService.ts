import type { Coordinate, Waypoint } from "@routess/core";
import { formatDistance, formatDuration } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import { Logger } from "@/lib/logger";
import { getRoutingPreferences, type RoutingPreferences } from "@/redesign/stores/routingPreferencesStore";
import { useRedesignSettingsStore } from "@/redesign/stores/settingsStore";
import { useRoutingStore } from "@/stores/routingStore";
import { type ComputeRouteOptions, computeRoute, type DirectionsOptions } from "./RoutingEngine";

const sameCoord = (a: Coordinate, b: Coordinate) => a[0] === b[0] && a[1] === b[1];
const sameWaypoint = (a: Waypoint, b: Waypoint) => sameCoord(a.coord, b.coord) && a.type === b.type;

// Map the user's "default activity" + routing profile choice onto a Mapbox profile.
// Cycling-first today: routing prefs lean toward bike infra unless the user picked
// running/walking. "Flat" prefers driving for gentler grade routing.
function resolveMapboxProfile(prefs: RoutingPreferences): string {
	const activity = useRedesignSettingsStore.getState().defaultActivity;
	if (activity === "Running" || activity === "Walking") return "mapbox/walking";
	if (prefs.profile === "flat") return "mapbox/driving";
	return "mapbox/cycling";
}

function buildComputeOptions(): ComputeRouteOptions {
	const prefs = getRoutingPreferences();
	const directions: DirectionsOptions = {
		profile: resolveMapboxProfile(prefs),
		radius: 150,
		continueStraight: true,
	};
	if (prefs.highways) directions.exclude = ["motorway"];
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
		return { success: false, waypointsSnapped: false, error: outcome.error };
	}

	useRoutingStore.getState().setRoutePath(outcome.routePath);

	const offlineSuffix = outcome.offline ? " (offline)" : "";
	const durationSuffix = outcome.offline ? " (estimated)" : "";
	setRouteDistance(formatDistance(outcome.distanceKm) + offlineSuffix);
	setRouteDuration(formatDuration(outcome.durationMinutes) + durationSuffix);
	setHasRoute(true);

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
