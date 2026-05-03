import type { Coordinate, Waypoint } from "@routess/core";
import { estimateWalkingDuration, formatDistance, formatDuration, haversineDistance } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Dispatch, SetStateAction } from "react";
import {
	clearKilometerMarkersLayer,
	updateKilometerMarkersLayer,
	updateRouteLayer,
} from "@/features/routing/managers/MapLayerManager";
import { Logger } from "@/lib/logger";
import { getDirections } from "@/lib/utils/mapbox-api";
import { useRoutingStore } from "@/stores/routingStore";

let currentRoutePathCoordinates: Coordinate[] = [];

const setCurrentRoutePathCoordinates = (newCoordinates: Coordinate[]) => {
	currentRoutePathCoordinates = newCoordinates;
	useRoutingStore.getState().setRoutePath(newCoordinates);
};

const reinitializeRouteCalcState = () => {
	const storedRoutePath = useRoutingStore.getState().routePath;
	if (storedRoutePath && storedRoutePath.length > 0) {
		currentRoutePathCoordinates = storedRoutePath;
	} else {
		setCurrentRoutePathCoordinates([]);
	}
};

reinitializeRouteCalcState();

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

try {
	const importMeta = (globalThis as unknown as Record<string, Record<string, unknown>>).import?.meta as
		| Record<string, unknown>
		| undefined;
	const hot = importMeta?.hot as { dispose: (cb: () => void) => void; accept: (cb: () => void) => void } | undefined;
	if (hot) {
		hot.dispose(() => {
			// HMR cleanup
		});
		hot.accept(() => {
			reinitializeRouteCalcState();
		});
	}
} catch {
	// HMR not available (test/production environment)
}

const addKilometerMarkers = (map: MapboxMap, coordinates: Coordinate[]) => {
	if (!map || coordinates.length < 2) {
		Logger.warn("[RCS/addKilometerMarkers] Map not available or not enough coords. Aborting.");
		return;
	}
	Logger.info("[RCS/addKilometerMarkers] Calculating kilometer markers...");
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
	Logger.info(`[RCS/addKilometerMarkers] Updated ${kmMarkerFeatures.length} kilometer markers via MapLayerManager`);
};

const clearKilometerMarkers = (map: MapboxMap) => {
	clearKilometerMarkersLayer(map);
};

async function buildMixedRoute(accessToken: string): Promise<{
	coordsAccum: Coordinate[];
	totalDist: number;
	waypointsUpdated: boolean;
	snappedWaypoints: Waypoint[] | null;
}> {
	const original = useRoutingStore.getState().waypoints;
	const working: Waypoint[] = original.map((wp) => ({ coord: [...wp.coord] as Coordinate, type: wp.type }));

	const coordsAccum: Coordinate[] = [];
	let totalDist = 0;
	let modified = false;

	for (let i = 0; i < working.length - 1; i++) {
		const from = working[i].coord;
		const to = working[i + 1].coord;

		if (working[i + 1].type === "direct") {
			if (
				coordsAccum.length === 0 ||
				coordsAccum[coordsAccum.length - 1][0] !== from[0] ||
				coordsAccum[coordsAccum.length - 1][1] !== from[1]
			) {
				coordsAccum.push(from);
			}
			coordsAccum.push(to);
			totalDist += haversineDistance(from, to);
			continue;
		}

		const result = await getDirections([from, to], accessToken, { radius: 150, continueStraight: true });

		if (result.success && result.data?.routes?.[0]) {
			const json = result.data;
			const geom = json.routes[0].geometry.coordinates;
			const distKm = json.routes[0].distance / 1000;

			if (
				coordsAccum.length === 0 ||
				coordsAccum[coordsAccum.length - 1][0] !== geom[0][0] ||
				coordsAccum[coordsAccum.length - 1][1] !== geom[0][1]
			) {
				if (coordsAccum.length === 0 && geom.length > 0) coordsAccum.push(...geom);
				else if (geom.length > 0) coordsAccum.push(...geom.slice(1));
			} else if (geom.length > 1) {
				coordsAccum.push(...geom.slice(1));
			}

			totalDist += distKm;

			if (json.waypoints && json.waypoints.length === 2) {
				const newCoord0 = json.waypoints[0].location as Coordinate;
				const newCoord1 = json.waypoints[1].location as Coordinate;
				if (working[i].type !== "direct" && !sameCoord(working[i].coord, newCoord0)) {
					Logger.info(`[RCS/buildMixedRoute] Snapping waypoint ${i} from ${working[i].coord} to ${newCoord0}`);
					working[i] = { ...working[i], coord: newCoord0 };
					modified = true;
				}
				if (working[i + 1].type !== "direct" && !sameCoord(working[i + 1].coord, newCoord1)) {
					Logger.info(`[RCS/buildMixedRoute] Snapping waypoint ${i + 1} from ${working[i + 1].coord} to ${newCoord1}`);
					working[i + 1] = { ...working[i + 1], coord: newCoord1 };
					modified = true;
				}
			}
		} else {
			Logger.warn(
				`[RCS/buildMixedRoute] No route found or API error for segment ${i}-${i + 1}: ${result.error || "Unknown error"}. Falling back to direct.`,
			);
			if (working[i + 1].type !== "direct") {
				working[i + 1] = { ...working[i + 1], type: "direct" };
				modified = true;
			}
			if (
				coordsAccum.length === 0 ||
				coordsAccum[coordsAccum.length - 1][0] !== from[0] ||
				coordsAccum[coordsAccum.length - 1][1] !== from[1]
			) {
				coordsAccum.push(from);
			}
			coordsAccum.push(to);
			totalDist += haversineDistance(from, to);
		}
	}

	if (modified) {
		Logger.info("[RCS/buildMixedRoute] Waypoints were modified during mixed route calculation.");
		return { coordsAccum, totalDist, waypointsUpdated: true, snappedWaypoints: working };
	}
	return { coordsAccum, totalDist, waypointsUpdated: false, snappedWaypoints: null };
}

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

	clearKilometerMarkers(map);

	const waypoints = useRoutingStore.getState().waypoints;
	let waypointsUpdatedBySnapping = false;
	let finalSnappedWaypoints: Waypoint[] | null = null;

	if (waypoints.length < 2) {
		updateRouteLayer(map, []);
		setCurrentRoutePathCoordinates([]);
		setRouteDistance("");
		setRouteDuration("");
		setHasRoute(false);
		Logger.info("[RCS/getRoute] Not enough waypoints for a route.");
		return { success: true, waypointsSnapped: false };
	}

	const isSegmentDirect = (i: number) => i > 0 && i < waypoints.length && waypoints[i].type === "direct";
	let allSegmentsDirect = true;
	let allSegmentsRouted = true;
	for (let i = 1; i < waypoints.length; i++) {
		if (isSegmentDirect(i)) allSegmentsRouted = false;
		else allSegmentsDirect = false;
	}
	const mixedSegments = !allSegmentsDirect && !allSegmentsRouted;

	if (allSegmentsDirect) {
		Logger.info("[RCS/getRoute] All segments are direct. Calculating straight lines.");
		const routeCoordinates: Coordinate[] = [];
		let cumulativeDistance = 0;
		for (let i = 0; i < waypoints.length - 1; i++) {
			if (i === 0) routeCoordinates.push(waypoints[i].coord);
			routeCoordinates.push(waypoints[i + 1].coord);
			cumulativeDistance += haversineDistance(waypoints[i].coord, waypoints[i + 1].coord);
		}
		setCurrentRoutePathCoordinates(routeCoordinates);
		updateRouteLayer(map, routeCoordinates);
		const duration = estimateWalkingDuration(cumulativeDistance);
		setRouteDistance(formatDistance(cumulativeDistance));
		setRouteDuration(formatDuration(duration));
		setHasRoute(true);
		addKilometerMarkers(map, routeCoordinates);
		return { success: true, waypointsSnapped: false };
	}

	if (mixedSegments) {
		Logger.info("[RCS/getRoute] Calculating mixed route (direct and routed segments).");
		const { coordsAccum, totalDist, waypointsUpdated, snappedWaypoints } = await buildMixedRoute(accessToken);
		if (!routeInputsMatch(waypoints)) {
			Logger.info("[RCS/getRoute] Route inputs changed during mixed route calculation. Discarding stale result.");
			return staleRouteResult();
		}
		updateRouteLayer(map, coordsAccum);
		setCurrentRoutePathCoordinates(coordsAccum);

		if (waypointsUpdated && snappedWaypoints) {
			waypointsUpdatedBySnapping = true;
			finalSnappedWaypoints = snappedWaypoints;
		}
		const duration = estimateWalkingDuration(totalDist);
		setRouteDistance(formatDistance(totalDist));
		setRouteDuration(formatDuration(duration));
		setHasRoute(true);
		addKilometerMarkers(map, coordsAccum);
		return {
			success: true,
			waypointsSnapped: waypointsUpdatedBySnapping,
			snappedWaypoints: finalSnappedWaypoints ?? undefined,
		};
	}

	if (allSegmentsRouted) {
		try {
			Logger.info("[RCS/getRoute] Calculating route using Mapbox Directions API for all segments.");
			const apiInputCoords = waypoints.map((wp) => wp.coord);
			const result = await getDirections(apiInputCoords, accessToken, { radius: 150, continueStraight: true });
			if (!routeInputsMatch(waypoints)) {
				Logger.info("[RCS/getRoute] Route inputs changed during Directions request. Discarding stale result.");
				return staleRouteResult();
			}

			if (!result.success || !result.data?.routes || result.data.routes.length === 0) {
				Logger.error("[RCS/getRoute] API request failed or no routes found:", result.error);
				setHasRoute(false);
				updateRouteLayer(map, []);
				setCurrentRoutePathCoordinates([]);
				return { success: false, waypointsSnapped: false, error: result.error };
			}

			const json = result.data;
			const isOfflineRoute = false;
			const data = json.routes[0];
			setCurrentRoutePathCoordinates(data.geometry.coordinates);
			updateRouteLayer(map, data.geometry.coordinates);

			if (json.waypoints && Array.isArray(json.waypoints)) {
				const apiSnapped = json.waypoints.map((wp: { location: Coordinate }) => wp.location);
				if (apiSnapped.length === waypoints.length) {
					const currentGlobal = useRoutingStore.getState().waypoints;
					const isContextStillValid =
						currentGlobal.length === waypoints.length &&
						currentGlobal.every((gwp, i) => sameWaypoint(gwp, waypoints[i]));

					if (!isContextStillValid) {
						Logger.info("[RCS/getRoute] Global waypoints changed during API call. Discarding API snapping.");
					} else {
						let actualChange = false;
						const next: Waypoint[] = currentGlobal.map((wp) => ({ ...wp }));
						for (let i = 0; i < currentGlobal.length; i++) {
							if (currentGlobal[i].type !== "direct" && !sameCoord(currentGlobal[i].coord, apiSnapped[i])) {
								Logger.info(
									`[RCS/getRoute] API Snapping waypoint ${i} from ${currentGlobal[i].coord} to ${apiSnapped[i]}`,
								);
								next[i] = { ...next[i], coord: apiSnapped[i] };
								actualChange = true;
							}
						}
						if (actualChange) {
							waypointsUpdatedBySnapping = true;
							finalSnappedWaypoints = next;
						}
					}
				}
			}

			const distance = data.distance / 1000;
			const duration = Math.round(data.duration / 60);
			const offlineIndicator = isOfflineRoute ? " (offline)" : "";
			setRouteDistance(formatDistance(distance) + offlineIndicator);
			setRouteDuration(formatDuration(duration) + (isOfflineRoute ? " (estimated)" : ""));
			setHasRoute(true);
			addKilometerMarkers(map, currentRoutePathCoordinates);

			if (!isOfflineRoute && "serviceWorker" in navigator) {
				try {
					navigator.serviceWorker.ready.then((registration) => {
						if (registration.active) {
							registration.active.postMessage({
								type: "PRECACHE_ROUTE",
								data: {
									routeData: {
										waypoints: apiInputCoords,
										geometry: currentRoutePathCoordinates,
										distance: data.distance,
										duration: data.duration,
										url: `directions_api_request_${Date.now()}`,
									},
								},
							});
							Logger.info("[RCS/getRoute] Route data sent to service worker for enhanced caching");
						}
					});
				} catch (error) {
					Logger.warn("[RCS/getRoute] Failed to precache route:", error);
				}
			}

			return {
				success: true,
				waypointsSnapped: waypointsUpdatedBySnapping,
				snappedWaypoints: finalSnappedWaypoints ?? undefined,
			};
		} catch (error) {
			if (!routeInputsMatch(waypoints)) {
				Logger.info("[RCS/getRoute] Route inputs changed during failed Directions request. Discarding stale fallback.");
				return staleRouteResult();
			}
			Logger.warn("[RCS/getRoute] Network error fetching route, falling back to direct routes:", error);

			const offlineRouteCoordinates: Coordinate[] = [];
			let cumulativeDistance = 0;
			for (let i = 0; i < waypoints.length - 1; i++) {
				if (i === 0) offlineRouteCoordinates.push(waypoints[i].coord);
				offlineRouteCoordinates.push(waypoints[i + 1].coord);
				cumulativeDistance += haversineDistance(waypoints[i].coord, waypoints[i + 1].coord);
			}

			setCurrentRoutePathCoordinates(offlineRouteCoordinates);
			updateRouteLayer(map, offlineRouteCoordinates);
			const duration = estimateWalkingDuration(cumulativeDistance);
			setRouteDistance(`${formatDistance(cumulativeDistance)} (offline)`);
			setRouteDuration(`${formatDuration(duration)} (estimated)`);
			setHasRoute(true);
			addKilometerMarkers(map, offlineRouteCoordinates);

			return { success: true, waypointsSnapped: false, error: "Using offline direct routes" };
		}
	}

	Logger.warn("[RCS/getRoute] Unhandled routing condition. Waypoint count:", waypoints.length);
	updateRouteLayer(map, []);
	setCurrentRoutePathCoordinates([]);
	setRouteDistance("");
	setRouteDuration("");
	setHasRoute(false);
	return { success: false, waypointsSnapped: false, error: "Unhandled routing condition" };
};

export const getCurrentRoutePath = (): Coordinate[] => [...currentRoutePathCoordinates];

export const clearCurrentRoutePath = (): void => {
	setCurrentRoutePathCoordinates([]);
	Logger.info("[RouteCalculationService] Cleared currentRoutePathCoordinates.");
};

export const setCurrentRoutePath = (coordinates: Coordinate[]): void => {
	setCurrentRoutePathCoordinates([...coordinates]);
	Logger.info(`[RouteCalculationService] Set currentRoutePathCoordinates with ${coordinates.length} coordinates.`);
};
