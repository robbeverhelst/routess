import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent } from "mapbox-gl";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";
import { onAppEvent } from "@/lib/app-events";
import { useT } from "@/lib/i18n";
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
	const t = useT();
	const viewRouteLabel = t("discover.viewRoute");
	const popupRef = useRef<mapboxgl.Popup | null>(null);

	// Popup lifecycle is deliberately separate from the markers effect: that
	// effect re-runs on every hover change and its cleanup would kill a popup
	// the moment a dot click sets hoveredRouteId.
	useEffect(() => {
		if (active) return;
		popupRef.current?.remove();
		popupRef.current = null;
	}, [active]);
	useEffect(
		() => () => {
			popupRef.current?.remove();
			popupRef.current = null;
		},
		[],
	);
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

	// Keep handler closures fresh without re-registering them: layer setup
	// and event handlers live in ONE effect keyed only on [active]; data
	// changes go through setData below. Re-creating layers on every hover
	// change would tear the layer out from under an in-flight click (the
	// mouseenter that precedes the click would destroy its own target).
	const viewRouteLabelRef = useRef(viewRouteLabel);
	viewRouteLabelRef.current = viewRouteLabel;

	// Layers + interaction handlers: stable per activation.
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !active) return;

		const ensureLayers = () => {
			if (map.getSource(STARTS_SOURCE_ID)) return;
			map.addSource(PATH_SOURCE_ID, { type: "geojson", data: pathFeature(null) });
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
			map.addSource(STARTS_SOURCE_ID, { type: "geojson", data: startsCollection(useDiscoverStore.getState().routes) });
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

		// Marker click: claim the event (preventDefault keeps the planner's
		// add-waypoint grammar away from Discover dots), highlight the path,
		// and open a popup with the route identity + link.
		const onCircleClick = (e: MapMouseEvent) => {
			e.preventDefault();
			const feature = map.queryRenderedFeatures(e.point, { layers: [STARTS_LAYER_ID] })[0];
			const routeId = feature?.properties?.routeId;
			if (typeof routeId !== "number") return;
			setHoveredRouteId(routeId);
			const route = useDiscoverStore.getState().routes.find((r) => r.id === routeId);
			if (!route) return;
			popupRef.current?.remove();
			const start = route.geometry?.[0];
			if (!start) return;
			const km = route.distance ? `${(route.distance / 1000).toFixed(1)} km · ` : "";
			const container = document.createElement("div");
			container.style.cssText = "font: 12.5px/1.45 system-ui, sans-serif; max-width: 220px;";
			const title = document.createElement("div");
			title.style.cssText = "font-weight: 600; margin-bottom: 2px;";
			title.textContent = route.name;
			const meta = document.createElement("div");
			meta.style.cssText = "opacity: .75; margin-bottom: 6px;";
			meta.textContent = `${km}${route.source?.name ?? route.user?.name ?? ""}`;
			const link = document.createElement("a");
			link.href = `/r/${route.slugId}`;
			link.textContent = viewRouteLabelRef.current;
			link.style.cssText = "color: #7d62ff; font-weight: 600; text-decoration: none;";
			container.append(title, meta, link);
			popupRef.current = new mapboxgl.Popup({ offset: 12, closeButton: false, maxWidth: "240px" })
				.setLngLat(start as [number, number])
				.setDOMContent(container)
				.addTo(map);
		};
		const onEnter = (e: MapMouseEvent) => {
			map.getCanvas().style.cursor = "pointer";
			const feature = map.queryRenderedFeatures(e.point, { layers: [STARTS_LAYER_ID] })[0];
			const routeId = feature?.properties?.routeId;
			// Cross-highlight: hovering a dot lights up its card and path.
			if (typeof routeId === "number") setHoveredRouteId(routeId);
		};
		const onLeave = () => {
			map.getCanvas().style.cursor = "";
		};

		if (map.isStyleLoaded()) ensureLayers();
		else map.once("idle", ensureLayers);
		// Style switches wipe custom layers; re-apply when the new style lands.
		map.on("style.load", ensureLayers);
		map.on("click", STARTS_LAYER_ID, onCircleClick);
		map.on("mouseenter", STARTS_LAYER_ID, onEnter);
		map.on("mouseleave", STARTS_LAYER_ID, onLeave);
		return () => {
			map.off("idle", ensureLayers);
			map.off("style.load", ensureLayers);
			map.off("click", STARTS_LAYER_ID, onCircleClick);
			map.off("mouseenter", STARTS_LAYER_ID, onEnter);
			map.off("mouseleave", STARTS_LAYER_ID, onLeave);
			if (map.isStyleLoaded()) removeLayers(map);
		};
	}, [active, mapRef, setHoveredRouteId]);

	// Data sync: markers follow the current results.
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !active) return;
		const source = map.getSource(STARTS_SOURCE_ID);
		if (source && source.type === "geojson") (source as GeoJSONSource).setData(startsCollection(routes));
	}, [active, routes, mapRef]);

	// Hover path follows the hovered card/dot.
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !active) return;
		const hovered = routes.find((r) => r.id === hoveredRouteId);
		const source = map.getSource(PATH_SOURCE_ID);
		if (source && source.type === "geojson") (source as GeoJSONSource).setData(pathFeature(hovered?.geometry ?? null));
	}, [active, routes, hoveredRouteId, mapRef]);

	return null;
}
