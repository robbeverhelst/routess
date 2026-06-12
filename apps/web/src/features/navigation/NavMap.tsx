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

const FOLLOW_ZOOM = 16;
const FOLLOW_PITCH = 45;

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
			paint: { "line-color": "#ffffff", "line-width": 10, "line-opacity": 0.85 },
		});
		map.addLayer({
			id: ROUTE_LINE_LAYER,
			type: "line",
			source: ROUTE_SOURCE,
			layout: { "line-cap": "round", "line-join": "round" },
			paint: { "line-color": "#7d62ff", "line-width": 5, "line-opacity": 0.95 },
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
	onUserPan,
}: {
	path: Coordinate[];
	rejoinPath: Coordinate[] | null;
	puck: Coordinate | null;
	headingDeg: number | null;
	follow: boolean;
	onUserPan: () => void;
}) {
	const mapRef = useRef<MapboxMap | null>(null);
	const puckEl = useRef<HTMLDivElement | null>(null);
	const markerRef = useRef<Marker | null>(null);
	const mapboxToken = getRuntimeConfig("VITE_MAPBOX_ACCESS_TOKEN") ?? "";

	const applyLayers = useCallback(() => {
		const map = mapRef.current;
		if (!map) return;
		ensureLayers(map, path, rejoinPath);
	}, [path, rejoinPath]);

	useEffect(() => {
		applyLayers();
	}, [applyLayers]);

	// Camera: bearing-up follow with the puck in the lower third, so the map
	// shows what is ahead. Manual pan breaks follow (ADR 0038 / ADR 0028: the
	// map is read-only during a session).
	useEffect(() => {
		const map = mapRef.current;
		if (!map || !puck) return;
		if (markerRef.current) markerRef.current.setLngLat(puck);
		if (puckEl.current) puckEl.current.style.transform = `rotate(${headingDeg ?? 0}deg)`;
		if (!follow) return;
		map.easeTo({
			center: puck,
			bearing: headingDeg ?? map.getBearing(),
			zoom: FOLLOW_ZOOM,
			pitch: FOLLOW_PITCH,
			padding: { top: window.innerHeight * 0.35, bottom: 0, left: 0, right: 0 },
			duration: 900,
			easing: (v) => v,
		});
	}, [puck, headingDeg, follow]);

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

				const el = document.createElement("div");
				el.style.cssText =
					"width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-bottom:26px solid #7d62ff;filter:drop-shadow(0 1px 4px rgba(0,0,0,0.45));";
				const wrapper = document.createElement("div");
				wrapper.appendChild(el);
				puckEl.current = wrapper;
				markerRef.current = new Marker({ element: wrapper, rotationAlignment: "map" })
					.setLngLat(puck ?? path[0] ?? [4.35, 50.85])
					.addTo(map);
			}}
			onDragStart={onUserPan}
			onRemove={() => {
				markerRef.current?.remove();
				markerRef.current = null;
				mapRef.current = null;
			}}
		/>
	);
}
