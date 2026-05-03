import type { Coordinate, Waypoint } from "@routess/core";
import { formatDistance, formatDuration, haversineDistance } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import {
	clearKilometerMarkersLayer,
	updateKilometerMarkersLayer,
	updateRouteLayer,
} from "@/features/routing/managers/MapLayerManager";
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

const addKilometerMarkers = (map: MapboxMap, coordinates: Coordinate[]) => {
	if (!map || coordinates.length < 2) return;
	const kmMarkerFeatures: GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>[] = [];
	let distanceCovered = 0;
	let nextKmMarker = 1;

	for (let i = 0; i < coordinates.length - 1; i++) {
		const start = coordinates[i];
		const end = coordinates[i + 1];
		const segmentDistance = haversineDistance(start, end);
		while (distanceCovered + segmentDistance >= nextKmMarker && segmentDistance > 0) {
			const segmentFraction = (nextKmMarker - distanceCovered) / segmentDistance;
			const markerLng = start[0] + segmentFraction * (end[0] - start[0]);
			const markerLat = start[1] + segmentFraction * (end[1] - start[1]);

			let markerType: "major" | "medium" | "minor";
			if (nextKmMarker % 10 === 0) markerType = "major";
			else if (nextKmMarker % 5 === 0) markerType = "medium";
			else markerType = "minor";

			kmMarkerFeatures.push({
				type: "Feature" as const,
				geometry: { type: "Point" as const, coordinates: [markerLng, markerLat] },
				properties: { km: `${nextKmMarker} km`, markerType },
			});
			nextKmMarker++;
		}
		distanceCovered += segmentDistance;
	}
	updateKilometerMarkersLayer(map, kmMarkerFeatures);
};

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

	clearKilometerMarkersLayer(map);

	const waypoints = useRoutingStore.getState().waypoints;
	if (waypoints.length < 2) {
		updateRouteLayer(map, []);
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
		updateRouteLayer(map, []);
		useRoutingStore.getState().setRoutePath([]);
		return { success: false, waypointsSnapped: false, error: outcome.error };
	}

	updateRouteLayer(map, outcome.routePath);
	useRoutingStore.getState().setRoutePath(outcome.routePath);
	addKilometerMarkers(map, outcome.routePath);

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

// Route-path getters / setters now thin proxies to the Zustand store, since the
// store is the single source of truth for the active RoutePath.
export const getCurrentRoutePath = (): Coordinate[] => [...useRoutingStore.getState().routePath];

export const clearCurrentRoutePath = (): void => {
	useRoutingStore.getState().clearRoutePath();
	Logger.info("[RouteCalculationService] Cleared route path.");
};

export const setCurrentRoutePath = (coordinates: Coordinate[]): void => {
	useRoutingStore.getState().setRoutePath([...coordinates]);
	Logger.info(`[RouteCalculationService] Set route path with ${coordinates.length} coordinates.`);
};
