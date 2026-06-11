import type { ApiRoute } from "@routess/api-client";
import { type GeoJSONSource, LngLatBounds, type Map as MapboxMap } from "mapbox-gl";
import { useEffect } from "react";
import { ROUTE_PREVIEW_COLOR } from "@/components/map/colors";
import { useLibraryStore } from "@/stores/libraryStore";

const SOURCE_ID = "library-route-preview";
const CASING_LAYER_ID = "library-route-preview-casing";
const LINE_LAYER_ID = "library-route-preview-line";

function previewCoords(route: ApiRoute | null): [number, number][] | null {
	if (!route) return null;
	const coords = route.geometry && route.geometry.length >= 2 ? route.geometry : route.waypoints.map((w) => w.coord);
	return coords.length >= 2 ? coords : null;
}

function removePreview(map: MapboxMap) {
	if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
	if (map.getLayer(CASING_LAYER_ID)) map.removeLayer(CASING_LAYER_ID);
	if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

function drawPreview(map: MapboxMap, coords: [number, number][]) {
	const data = {
		type: "Feature" as const,
		properties: {},
		geometry: { type: "LineString" as const, coordinates: coords },
	};
	const source = map.getSource(SOURCE_ID);
	if (source && source.type === "geojson") {
		(source as GeoJSONSource).setData(data);
		return;
	}
	map.addSource(SOURCE_ID, { type: "geojson", data });
	map.addLayer({
		id: CASING_LAYER_ID,
		type: "line",
		source: SOURCE_ID,
		layout: { "line-cap": "round", "line-join": "round" },
		paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.85 },
	});
	map.addLayer({
		id: LINE_LAYER_ID,
		type: "line",
		source: SOURCE_ID,
		layout: { "line-cap": "round", "line-join": "round" },
		paint: { "line-color": ROUTE_PREVIEW_COLOR, "line-width": 4, "line-opacity": 0.95 },
	});
}

function fitToPreview(map: MapboxMap, coords: [number, number][]) {
	const bounds = coords.reduce((b, c) => b.extend(c), new LngLatBounds(coords[0], coords[0]));
	const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
	map.fitBounds(bounds, {
		// Keep the route clear of the library sidebar on desktop and the
		// bottom drawer on mobile.
		padding: isMobile ? { top: 80, bottom: 320, left: 40, right: 40 } : { top: 80, bottom: 80, left: 460, right: 80 },
		duration: 650,
		maxZoom: 14.5,
	});
}

// Ghost preview of the route selected in the library panel. Non-destructive:
// it never touches the routing store or the draft editor.
export function LibraryRoutePreview({ mapRef }: { mapRef: React.RefObject<MapboxMap | null> }) {
	const selectedRoute = useLibraryStore((s) => s.selectedRoute);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		const coords = previewCoords(selectedRoute);

		const apply = () => {
			removePreview(map);
			if (!coords) return;
			drawPreview(map, coords);
			fitToPreview(map, coords);
		};

		// Style switches wipe custom layers; re-apply when the new style lands.
		const reapply = () => {
			if (coords) drawPreview(map, coords);
		};

		if (map.isStyleLoaded()) {
			apply();
		} else {
			// "load" only fires once per map lifetime; "idle" also fires while
			// other layers are still settling, so a deferred apply always runs.
			map.once("idle", apply);
		}
		map.on("style.load", reapply);
		return () => {
			map.off("idle", apply);
			map.off("style.load", reapply);
			if (map.isStyleLoaded()) removePreview(map);
		};
	}, [selectedRoute, mapRef]);

	return null;
}
