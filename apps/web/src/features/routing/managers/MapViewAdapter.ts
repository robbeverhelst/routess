import type { Coordinate, Waypoint } from "@routess/core";
import { haversineDistance } from "@routess/core";
import type { Map as MapboxMap } from "mapbox-gl";
import { useRoutingStore } from "@/stores/routingStore";
import {
	clearKilometerMarkersLayer,
	clearRouteLayer,
	updateKilometerMarkersLayer,
	updateRouteLayer,
	updateWaypointsLayer,
} from "./MapLayerManager";

// Subscribes to the routing store and reconciles map layers automatically.
// Callers mutate the store; layers update themselves. Replaces the previous
// imperative pattern where every store mutation site had to remember to
// call updateWaypointsLayer / updateRouteLayer / addKilometerMarkers /
// clearRouteLayer in the right combinations.

function buildKmMarkerFeatures(routePath: Coordinate[]): GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>[] {
	if (routePath.length < 2) return [];
	const features: GeoJSON.Feature<GeoJSON.Point, GeoJSON.GeoJsonProperties>[] = [];
	let distanceCovered = 0;
	let nextKmMarker = 1;
	for (let i = 0; i < routePath.length - 1; i++) {
		const start = routePath[i];
		const end = routePath[i + 1];
		const segmentDistance = haversineDistance(start, end);
		while (distanceCovered + segmentDistance >= nextKmMarker && segmentDistance > 0) {
			const fraction = (nextKmMarker - distanceCovered) / segmentDistance;
			const lng = start[0] + fraction * (end[0] - start[0]);
			const lat = start[1] + fraction * (end[1] - start[1]);
			const markerType: "major" | "medium" | "minor" =
				nextKmMarker % 10 === 0 ? "major" : nextKmMarker % 5 === 0 ? "medium" : "minor";
			features.push({
				type: "Feature",
				geometry: { type: "Point", coordinates: [lng, lat] },
				properties: { km: `${nextKmMarker} km`, markerType },
			});
			nextKmMarker++;
		}
		distanceCovered += segmentDistance;
	}
	return features;
}

const renderWaypoints = (map: MapboxMap, waypoints: Waypoint[], isMapLocked: boolean) => {
	updateWaypointsLayer(map, waypoints, isMapLocked);
};

const renderRoute = (map: MapboxMap, routePath: Coordinate[]) => {
	if (routePath.length === 0) {
		clearRouteLayer(map);
		clearKilometerMarkersLayer(map);
		return;
	}
	updateRouteLayer(map, routePath);
	updateKilometerMarkersLayer(map, buildKmMarkerFeatures(routePath));
};

// Attach the adapter to a map instance. Returns a disposer that detaches
// the subscriptions; call it on map teardown.
export function attachMapViewAdapter(map: MapboxMap): () => void {
	const initial = useRoutingStore.getState();
	renderWaypoints(map, initial.waypoints, initial.isMapLocked);
	renderRoute(map, initial.routePath);

	const unsubWaypoints = useRoutingStore.subscribe((state, prev) => {
		if (state.waypoints !== prev.waypoints || state.isMapLocked !== prev.isMapLocked) {
			renderWaypoints(map, state.waypoints, state.isMapLocked);
		}
		if (state.routePath !== prev.routePath) {
			renderRoute(map, state.routePath);
		}
	});

	return () => {
		unsubWaypoints();
	};
}

// Manual re-sync — used after the map style is swapped and the adapter
// needs to repaint everything against the freshly initialised layers.
export function syncMapView(map: MapboxMap): void {
	const state = useRoutingStore.getState();
	renderWaypoints(map, state.waypoints, state.isMapLocked);
	renderRoute(map, state.routePath);
}
