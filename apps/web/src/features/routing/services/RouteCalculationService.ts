import type { Coordinate, Waypoint } from "@routess/core";
import { formatDistance, formatDuration } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import { Logger } from "@/lib/logger";
import { useRoutingStore } from "@/stores/routingStore";
import { computeRoute } from "./RoutingEngine";

const sameCoord = (a: Coordinate, b: Coordinate) => a[0] === b[0] && a[1] === b[1];
const sameWaypoint = (a: Waypoint, b: Waypoint) => sameCoord(a.coord, b.coord) && a.type === b.type;

const routeInputsMatch = (waypoints: Waypoint[]): boolean => {
	const state = useRoutingStore.getState();
	return state.waypoints.length === waypoints.length && state.waypoints.every((wp, i) => sameWaypoint(wp, waypoints[i]));
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

	const outcome = await computeRoute(waypoints, accessToken);

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
