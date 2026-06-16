import type { Coordinate } from "@routess/core";
import { type GeoJSONSource, LngLatBounds, type Map as MapboxMap, Marker } from "mapbox-gl";
import { useCallback, useEffect, useRef } from "react";
import MapGL from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { getRuntimeConfig } from "@/lib/runtime-config";

const MAP_STYLE = "mapbox://styles/mapbox/standard";

const ROUTE_SOURCE = "nav-route";
const ROUTE_CASING_LAYER = "nav-route-casing";
const ROUTE_LINE_LAYER = "nav-route-line";
const REJOIN_SOURCE = "nav-rejoin";
const REJOIN_LAYER = "nav-rejoin-line";

const FOLLOW_ZOOM = 16.5;
const FOLLOW_PITCH = 48;

// Brand purple and a green that match the design reference. Mapbox paint and
// marker DOM both need concrete colours (CSS vars don't resolve in GL paint).
const ROUTE_PURPLE = "#7d62ff";
const FLAG_GREEN = "oklch(0.5 0.16 155)";

// Heading puck: accuracy halo + a forward cone + a dot, screen-aligned so the
// cone points up (in heading-up follow the map rotates under it, so up is the
// direction of travel). Mirrors the reference nav design.
const PUCK_SVG =
	`<svg width="76" height="76" viewBox="0 0 76 76" style="overflow:visible;display:block">` +
	`<circle cx="38" cy="38" r="34" fill="rgba(125,98,255,0.12)"></circle>` +
	`<path d="M38,16 l13,20 a15,15 0 0 1 -26,0 z" fill="rgba(125,98,255,0.32)"></path>` +
	`<circle cx="38" cy="38" r="12" fill="${ROUTE_PURPLE}" stroke="#ffffff" stroke-width="4"></circle>` +
	`</svg>`;

const FLAG_HTML =
	`<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-12px)">` +
	`<span style="width:34px;height:34px;border-radius:50% 50% 50% 0;background:${FLAG_GREEN};` +
	`transform:rotate(45deg);box-shadow:0 4px 10px -2px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center">` +
	`<span style="transform:rotate(-45deg);color:white;font-size:15px;line-height:1">⚑</span></span></div>`;

function lineFeature(coords: Coordinate[]) {
	return {
		type: "Feature" as const,
		properties: {},
		geometry: { type: "LineString" as const, coordinates: coords },
	};
}

function ensureLayers(map: MapboxMap, path: Coordinate[], rejoinPath: Coordinate[] | null) {
	if (!map.getSource(ROUTE_SOURCE)) {
		map.addSource(ROUTE_SOURCE, { type: "geojson", data: lineFeature(path) });
		map.addLayer({
			id: ROUTE_CASING_LAYER,
			type: "line",
			source: ROUTE_SOURCE,
			layout: { "line-cap": "round", "line-join": "round" },
			paint: { "line-color": "#ffffff", "line-width": 11, "line-opacity": 0.9 },
		});
		map.addLayer({
			id: ROUTE_LINE_LAYER,
			type: "line",
			source: ROUTE_SOURCE,
			layout: { "line-cap": "round", "line-join": "round" },
			paint: { "line-color": ROUTE_PURPLE, "line-width": 6, "line-opacity": 0.96 },
		});
	} else {
		(map.getSource(ROUTE_SOURCE) as GeoJSONSource).setData(lineFeature(path));
	}

	const rejoinData = lineFeature(rejoinPath ?? []);
	if (!map.getSource(REJOIN_SOURCE)) {
		map.addSource(REJOIN_SOURCE, { type: "geojson", data: rejoinData });
		map.addLayer({
			id: REJOIN_LAYER,
			type: "line",
			source: REJOIN_SOURCE,
			layout: { "line-cap": "round", "line-join": "round" },
			paint: { "line-color": "#f59e0b", "line-width": 5, "line-opacity": 0.95, "line-dasharray": [1.2, 1.2] },
		});
	} else {
		(map.getSource(REJOIN_SOURCE) as GeoJSONSource).setData(rejoinData);
	}
}

export function NavMap({
	path,
	rejoinPath,
	puck,
	headingDeg,
	follow,
	overviewNonce,
	onUserPan,
}: {
	path: Coordinate[];
	rejoinPath: Coordinate[] | null;
	puck: Coordinate | null;
	headingDeg: number | null;
	follow: boolean;
	// Bumping this fits the whole route into view (the Overview control).
	overviewNonce: number;
	onUserPan: () => void;
}) {
	const mapRef = useRef<MapboxMap | null>(null);
	const puckMarker = useRef<Marker | null>(null);
	const flagMarker = useRef<Marker | null>(null);
	const mapboxToken = getRuntimeConfig("VITE_MAPBOX_ACCESS_TOKEN") ?? "";

	const applyLayers = useCallback(() => {
		const map = mapRef.current;
		if (!map) return;
		ensureLayers(map, path, rejoinPath);
	}, [path, rejoinPath]);

	useEffect(() => {
		applyLayers();
	}, [applyLayers]);

	// Camera: heading-up follow with the puck low so the map shows what is
	// ahead. Manual pan breaks follow (ADR 0038 / ADR 0028: the map is read-only
	// during a session).
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !puck) return;
		puckMarker.current?.setLngLat(puck);
		if (!follow) return;
		map.easeTo({
			center: puck,
			bearing: headingDeg ?? map.getBearing(),
			zoom: FOLLOW_ZOOM,
			pitch: FOLLOW_PITCH,
			padding: { top: 0, bottom: Math.round(window.innerHeight * 0.42), left: 0, right: 0 },
			duration: 900,
			easing: (v) => v,
		});
	}, [puck, headingDeg, follow]);

	// Overview: fit the whole route, leaving room for the top bar and sheet.
	// biome-ignore lint/correctness/useExhaustiveDependencies: overviewNonce is a trigger, fit on each bump
	useEffect(() => {
		const map = mapRef.current;
		if (!map || path.length < 2) return;
		const bounds = path.reduce((b, c) => b.extend(c), new LngLatBounds(path[0], path[0]));
		map.easeTo({ bearing: 0, pitch: 0, duration: 500 });
		map.fitBounds(bounds, { padding: { top: 160, bottom: 220, left: 60, right: 60 }, duration: 600, maxZoom: 16 });
	}, [overviewNonce, path]);

	return (
		<MapGL
			mapboxAccessToken={mapboxToken}
			initialViewState={{ longitude: path[0]?.[0] ?? 4.35, latitude: path[0]?.[1] ?? 50.85, zoom: 13 }}
			style={{ width: "100%", height: "100%" }}
			mapStyle={MAP_STYLE}
			attributionControl={false}
			onLoad={(evt) => {
				const map = evt.target;
				mapRef.current = map;
				ensureLayers(map, path, rejoinPath);
				map.on("style.load", applyLayers);

				if (path.length >= 2) {
					const bounds = path.reduce((b, c) => b.extend(c), new LngLatBounds(path[0], path[0]));
					map.fitBounds(bounds, { padding: 80, duration: 0 });
				}

				const puckEl = document.createElement("div");
				puckEl.innerHTML = PUCK_SVG;
				puckMarker.current = new Marker({ element: puckEl }).setLngLat(puck ?? path[0] ?? [4.35, 50.85]).addTo(map);

				const end = path[path.length - 1];
				if (end) {
					const flagEl = document.createElement("div");
					flagEl.innerHTML = FLAG_HTML;
					flagMarker.current = new Marker({ element: flagEl, anchor: "bottom" }).setLngLat(end).addTo(map);
				}
			}}
			onDragStart={onUserPan}
			onRemove={() => {
				puckMarker.current?.remove();
				flagMarker.current?.remove();
				puckMarker.current = null;
				flagMarker.current = null;
				mapRef.current = null;
			}}
		/>
	);
}
