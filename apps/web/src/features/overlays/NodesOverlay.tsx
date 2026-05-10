import { useEffect, useRef, useState } from "react";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import { Logger } from "@/lib/logger";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import {
	bboxArea,
	bboxKey,
	fetchNodeNetwork,
	NODE_OVERLAY_MAX_BBOX_DEG,
	NODE_OVERLAY_MIN_ZOOM,
	type NodeFeatureCollection,
	type NodeNetworkBbox,
} from "./services/OverpassNodesService";

const EMPTY_DATA: NodeFeatureCollection = { type: "FeatureCollection", features: [] };
const DEBOUNCE_MS = 450;
const BBOX_PADDING_RATIO = 0.35;

const HIKING_COLOR = "#dc2626";
const CYCLING_COLOR = "#1d4ed8";

function padBbox(bbox: NodeNetworkBbox): NodeNetworkBbox {
	const latPadding = (bbox.north - bbox.south) * BBOX_PADDING_RATIO;
	const lngPadding = (bbox.east - bbox.west) * BBOX_PADDING_RATIO;

	return {
		south: Math.max(-85, bbox.south - latPadding),
		west: Math.max(-180, bbox.west - lngPadding),
		north: Math.min(85, bbox.north + latPadding),
		east: Math.min(180, bbox.east + lngPadding),
	};
}

function containsBbox(outer: NodeNetworkBbox, inner: NodeNetworkBbox): boolean {
	return (
		outer.south <= inner.south && outer.west <= inner.west && outer.north >= inner.north && outer.east >= inner.east
	);
}

export function NodesOverlay() {
	const showHiking = useRedesignSettingsStore((s) => s.overlays?.hikingNodes ?? false);
	const showCycling = useRedesignSettingsStore((s) => s.overlays?.cyclingNodes ?? false);

	if (!showHiking && !showCycling) return null;

	return <ActiveNodesOverlay showHiking={showHiking} showCycling={showCycling} />;
}

function ActiveNodesOverlay({ showHiking, showCycling }: { showHiking: boolean; showCycling: boolean }) {
	const { current: mapRef } = useMap();
	const [data, setData] = useState<NodeFeatureCollection>(EMPTY_DATA);
	const lastKeyRef = useRef<string | null>(null);
	const loadedBboxRef = useRef<NodeNetworkBbox | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	useEffect(() => {
		const map = mapRef?.getMap();
		if (!map) {
			Logger.warn("[NodesOverlay] map ref not ready");
			return;
		}

		Logger.warn("[NodesOverlay] enabled, attaching listeners");
		let timer: number | null = null;

		const refresh = () => {
			const zoom = map.getZoom();
			if (zoom < NODE_OVERLAY_MIN_ZOOM) {
				Logger.warn(`[NodesOverlay] zoom ${zoom.toFixed(1)} below min ${NODE_OVERLAY_MIN_ZOOM}, zoom in`);
				if (lastKeyRef.current !== "below-zoom") {
					lastKeyRef.current = "below-zoom";
					loadedBboxRef.current = null;
					setData(EMPTY_DATA);
				}
				return;
			}
			const b = map.getBounds();
			if (!b) return;
			const bbox: NodeNetworkBbox = {
				south: b.getSouth(),
				west: b.getWest(),
				north: b.getNorth(),
				east: b.getEast(),
			};
			const loadedBbox = loadedBboxRef.current;
			if (loadedBbox && containsBbox(loadedBbox, bbox)) {
				return;
			}

			const fetchBbox = padBbox(bbox);
			if (bboxArea(fetchBbox) > NODE_OVERLAY_MAX_BBOX_DEG * NODE_OVERLAY_MAX_BBOX_DEG) {
				Logger.warn("[NodesOverlay] bbox too large, zoom in further");
				if (lastKeyRef.current !== "too-large") {
					lastKeyRef.current = "too-large";
					loadedBboxRef.current = null;
					setData(EMPTY_DATA);
				}
				return;
			}
			const key = bboxKey(fetchBbox);
			if (key === lastKeyRef.current) return;
			lastKeyRef.current = key;

			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;

			Logger.warn(`[NodesOverlay] fetching zoom=${zoom.toFixed(1)} bbox=${key}`);
			fetchNodeNetwork(fetchBbox, controller.signal)
				.then((collection) => {
					if (controller.signal.aborted) return;
					Logger.warn(`[NodesOverlay] received ${collection.features.length} features`);
					loadedBboxRef.current = fetchBbox;
					setData(collection);
				})
				.catch((err) => {
					if ((err as { name?: string }).name === "AbortError") return;
					Logger.warn("[NodesOverlay] fetch failed", err);
				});
		};

		const schedule = () => {
			if (timer !== null) window.clearTimeout(timer);
			timer = window.setTimeout(refresh, DEBOUNCE_MS);
		};

		schedule();
		map.on("moveend", schedule);
		map.on("zoomend", schedule);

		return () => {
			if (timer !== null) window.clearTimeout(timer);
			map.off("moveend", schedule);
			map.off("zoomend", schedule);
			abortRef.current?.abort();
			abortRef.current = null;
		};
	}, [mapRef]);

	return (
		<Source id="rds-nodes" type="geojson" data={data}>
			{showHiking && (
				<Layer
					id="rds-nodes-line-hiking"
					type="line"
					filter={["all", ["==", ["geometry-type"], "LineString"], ["==", ["get", "kind"], "hiking"]]}
					layout={{ "line-join": "round", "line-cap": "round" }}
					paint={{
						"line-color": HIKING_COLOR,
						"line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.4, 14, 2.4, 17, 3.4],
						"line-dasharray": [2, 1.5],
						"line-opacity": 0.85,
					}}
				/>
			)}
			{showHiking && (
				<Layer
					id="rds-nodes-point-hiking"
					type="circle"
					filter={["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "kind"], "hiking"]]}
					paint={{
						"circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 7, 14, 11, 17, 14],
						"circle-color": "#ffffff",
						"circle-stroke-color": HIKING_COLOR,
						"circle-stroke-width": 1.5,
						"circle-opacity": 0.95,
					}}
				/>
			)}
			{showHiking && (
				<Layer
					id="rds-nodes-label-hiking"
					type="symbol"
					filter={["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "kind"], "hiking"]]}
					layout={{
						"text-field": ["coalesce", ["get", "ref"], ""],
						"text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
						"text-size": ["interpolate", ["linear"], ["zoom"], 11, 9, 14, 11, 17, 13],
						"text-allow-overlap": true,
						"text-ignore-placement": true,
					}}
					paint={{ "text-color": HIKING_COLOR }}
				/>
			)}
			{showCycling && (
				<Layer
					id="rds-nodes-line-cycling"
					type="line"
					filter={["all", ["==", ["geometry-type"], "LineString"], ["==", ["get", "kind"], "cycling"]]}
					layout={{ "line-join": "round", "line-cap": "round" }}
					paint={{
						"line-color": CYCLING_COLOR,
						"line-width": ["interpolate", ["linear"], ["zoom"], 11, 1.4, 14, 2.4, 17, 3.4],
						"line-dasharray": [4, 2],
						"line-opacity": 0.85,
					}}
				/>
			)}
			{showCycling && (
				<Layer
					id="rds-nodes-point-cycling"
					type="circle"
					filter={["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "kind"], "cycling"]]}
					paint={{
						"circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 7, 14, 11, 17, 14],
						"circle-color": "#ffffff",
						"circle-stroke-color": CYCLING_COLOR,
						"circle-stroke-width": 1.5,
						"circle-opacity": 0.95,
					}}
				/>
			)}
			{showCycling && (
				<Layer
					id="rds-nodes-label-cycling"
					type="symbol"
					filter={["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "kind"], "cycling"]]}
					layout={{
						"text-field": ["coalesce", ["get", "ref"], ""],
						"text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
						"text-size": ["interpolate", ["linear"], ["zoom"], 11, 9, 14, 11, 17, 13],
						"text-allow-overlap": true,
						"text-ignore-placement": true,
					}}
					paint={{ "text-color": CYCLING_COLOR }}
				/>
			)}
		</Source>
	);
}
