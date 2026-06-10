import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent } from "mapbox-gl";
import { useEffect } from "react";
import { onAppEvent } from "@/lib/app-events";
import { useDiscoverStore } from "@/stores/discoverStore";
import { useUiStore } from "@/stores/uiStore";

const STARTS_SOURCE_ID = "discover-route-starts";
const STARTS_LAYER_ID = "discover-route-starts-circles";
const PATH_SOURCE_ID = "discover-route-path";
const PATH_CASING_LAYER_ID = "discover-route-path-casing";
const PATH_LINE_LAYER_ID = "discover-route-path-line";

const VIEWPORT_DEBOUNCE_MS = 500;

function currentBbox(map: MapboxMap): string {
	const b = map.getBounds();
	if (!b) return "";
	const f = (n: number) => n.toFixed(5);
	return `${f(b.getWest())},${f(b.getSouth())},${f(b.getEast())},${f(b.getNorth())}`;
}

function removeLayers(map: MapboxMap) {
	for (const id of [PATH_LINE_LAYER_ID, PATH_CASING_LAYER_ID, STARTS_LAYER_ID]) {
		if (map.getLayer(id)) map.removeLayer(id);
	}
	for (const id of [PATH_SOURCE_ID, STARTS_SOURCE_ID]) {
		if (map.getSource(id)) map.removeSource(id);
	}
}

function startsCollection(routes: { id: number; geometry?: [number, number][] | null }[]) {
	return {
		type: "FeatureCollection" as const,
		features: routes
			.filter((r) => r.geometry && r.geometry.length > 0)
			.map((r) => ({
				type: "Feature" as const,
				properties: { routeId: r.id },
				geometry: { type: "Point" as const, coordinates: (r.geometry as [number, number][])[0] },
			})),
	};
}

function pathFeature(coords: [number, number][] | null) {
	return {
		type: "Feature" as const,
		properties: {},
		geometry: { type: "LineString" as const, coordinates: coords ?? [] },
	};
}

// Map side of the Discover surface: reports the viewport bbox to the
// discover store (debounced) and renders the results as start markers, with
// the hovered card's path highlighted. Same imperative source/layer pattern
// as LibraryRoutePreview.
export function DiscoverMapBindings({ mapRef }: { mapRef: React.RefObject<MapboxMap | null> }) {
	const active = useUiStore((s) => s.context === "discover");
	const routes = useDiscoverStore((s) => s.routes);
	const hoveredRouteId = useDiscoverStore((s) => s.hoveredRouteId);
	const setViewportBbox = useDiscoverStore((s) => s.setViewportBbox);
	const setHoveredRouteId = useDiscoverStore((s) => s.setHoveredRouteId);

	// Viewport sync: the map is the filter. The map can be a beat behind the
	// panel (refs don't re-render), so acquisition polls until it exists;
	// without this the panel would wait for a bbox that never comes.
	useEffect(() => {
		if (!active) return;

		let timer: ReturnType<typeof setTimeout> | null = null;
		let poll: ReturnType<typeof setInterval> | null = null;
		let bound: MapboxMap | null = null;

		const report = () => {
			if (!bound) return;
			const bbox = currentBbox(bound);
			if (bbox) setViewportBbox(bbox);
		};
		const schedule = () => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(report, VIEWPORT_DEBOUNCE_MS);
		};
		const bind = (map: MapboxMap) => {
			bound = map;
			report();
			map.on("moveend", schedule);
			map.on("zoomend", schedule);
		};

		if (mapRef.current) bind(mapRef.current);
		else {
			poll = setInterval(() => {
				if (!mapRef.current) return;
				if (poll) clearInterval(poll);
				poll = null;
				bind(mapRef.current);
			}, 200);
		}

		const offSearch = onAppEvent("routess:discover-search-area", report);
		return () => {
			if (timer) clearTimeout(timer);
			if (poll) clearInterval(poll);
			offSearch();
			if (bound) {
				bound.off("moveend", schedule);
				bound.off("zoomend", schedule);
			}
		};
	}, [active, mapRef, setViewportBbox]);

	// Markers + hovered path.
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		const hovered = routes.find((r) => r.id === hoveredRouteId);
		const starts = startsCollection(routes);
		const path = pathFeature(hovered?.geometry ?? null);

		const draw = () => {
			if (!active) {
				removeLayers(map);
				return;
			}
			const startsSource = map.getSource(STARTS_SOURCE_ID);
			if (startsSource && startsSource.type === "geojson") {
				(startsSource as GeoJSONSource).setData(starts);
				(map.getSource(PATH_SOURCE_ID) as GeoJSONSource).setData(path);
				return;
			}
			map.addSource(PATH_SOURCE_ID, { type: "geojson", data: path });
			map.addLayer({
				id: PATH_CASING_LAYER_ID,
				type: "line",
				source: PATH_SOURCE_ID,
				layout: { "line-cap": "round", "line-join": "round" },
				paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.85 },
			});
			map.addLayer({
				id: PATH_LINE_LAYER_ID,
				type: "line",
				source: PATH_SOURCE_ID,
				layout: { "line-cap": "round", "line-join": "round" },
				paint: { "line-color": "#7d62ff", "line-width": 3.5, "line-opacity": 0.95 },
			});
			map.addSource(STARTS_SOURCE_ID, { type: "geojson", data: starts });
			map.addLayer({
				id: STARTS_LAYER_ID,
				type: "circle",
				source: STARTS_SOURCE_ID,
				paint: {
					"circle-radius": 6,
					"circle-color": "#7d62ff",
					"circle-stroke-color": "#ffffff",
					"circle-stroke-width": 2,
					"circle-opacity": 0.9,
				},
			});
		};

		// Marker tap/click highlights the path (the card is the way in).
		const onCircleClick = (e: MapMouseEvent) => {
			const feature = map.queryRenderedFeatures(e.point, { layers: [STARTS_LAYER_ID] })[0];
			const routeId = feature?.properties?.routeId;
			if (typeof routeId === "number") setHoveredRouteId(routeId);
		};
		const onEnter = () => {
			map.getCanvas().style.cursor = "pointer";
		};
		const onLeave = () => {
			map.getCanvas().style.cursor = "";
		};

		if (map.isStyleLoaded()) {
			draw();
		} else {
			map.once("idle", draw);
		}
		// Style switches wipe custom layers; re-apply when the new style lands.
		map.on("style.load", draw);
		map.on("click", STARTS_LAYER_ID, onCircleClick);
		map.on("mouseenter", STARTS_LAYER_ID, onEnter);
		map.on("mouseleave", STARTS_LAYER_ID, onLeave);
		return () => {
			map.off("idle", draw);
			map.off("style.load", draw);
			map.off("click", STARTS_LAYER_ID, onCircleClick);
			map.off("mouseenter", STARTS_LAYER_ID, onEnter);
			map.off("mouseleave", STARTS_LAYER_ID, onLeave);
			if (map.isStyleLoaded()) removeLayers(map);
		};
	}, [active, routes, hoveredRouteId, mapRef, setHoveredRouteId]);

	return null;
}
