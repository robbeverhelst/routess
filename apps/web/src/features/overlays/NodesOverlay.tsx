import type { MapLayerMouseEvent } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import { Logger } from "@/lib/logger";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { nodeNetworkOverlaysEnabled } from "./nodeNetworkFeatureFlag";
import {
	bboxArea,
	bboxKey,
	fetchNodeNetwork,
	NODE_OVERLAY_MAX_BBOX_DEG,
	NODE_OVERLAY_MIN_ZOOM,
	type NodeFeatureCollection,
	type NodeNetworkBbox,
	type NodeNetworkKind,
} from "./services/OverpassNodesService";

const EMPTY_DATA: NodeFeatureCollection = { type: "FeatureCollection", features: [] };
const DEBOUNCE_MS = 450;
const BBOX_PADDING_RATIO = 0.35;

const HIKING_COLOR = "#dc2626";
const CYCLING_COLOR = "#1d4ed8";

type ActiveNode = {
	kind: NodeNetworkKind;
	ref: string;
};

type ActiveNodePair = {
	from: ActiveNode;
	to: ActiveNode;
};

const BASE_LINE_WIDTH = ["interpolate", ["linear"], ["zoom"], 11, 1.4, 14, 2.4, 17, 3.4];
const HIGHLIGHT_LINE_WIDTH = ["interpolate", ["linear"], ["zoom"], 11, 4, 14, 6, 17, 8];
const NODE_RADIUS = ["interpolate", ["linear"], ["zoom"], 11, 6.5, 14, 10, 17, 13];
const NODE_HALO_RADIUS = ["interpolate", ["linear"], ["zoom"], 11, 9, 14, 14, 17, 17];
const NODE_TEXT_SIZE = ["interpolate", ["linear"], ["zoom"], 11, 9, 14, 11, 17, 13];
const HIKING_TRANSLATE = [-5, -5];
const CYCLING_TRANSLATE = [5, 5];

function kindColor(kind: NodeNetworkKind): string {
	return kind === "hiking" ? HIKING_COLOR : CYCLING_COLOR;
}

function pointFilter(kind: NodeNetworkKind): unknown[] {
	return ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "kind"], kind]];
}

function lineFilter(kind: NodeNetworkKind): unknown[] {
	return ["all", ["==", ["geometry-type"], "LineString"], ["==", ["get", "kind"], kind]];
}

function activePointFilter(node: ActiveNode): unknown[] {
	return [
		"all",
		["==", ["geometry-type"], "Point"],
		["==", ["get", "kind"], node.kind],
		["==", ["get", "ref"], node.ref],
	];
}

function sameNode(a: ActiveNode | null, b: ActiveNode | null): boolean {
	return Boolean(a && b && a.kind === b.kind && a.ref === b.ref);
}

function connectedLineFilter(pair: ActiveNodePair): unknown[] {
	const { from, to } = pair;
	return [
		"all",
		["==", ["geometry-type"], "LineString"],
		["==", ["get", "kind"], to.kind],
		[
			"any",
			["all", ["==", ["get", "fromRef"], from.ref], ["==", ["get", "toRef"], to.ref]],
			["all", ["==", ["get", "fromRef"], to.ref], ["==", ["get", "toRef"], from.ref]],
			["==", ["get", "ref"], `${from.ref}-${to.ref}`],
			["==", ["get", "ref"], `${to.ref}-${from.ref}`],
		],
	];
}

function nodeFromEvent(event: MapLayerMouseEvent): ActiveNode | null {
	const props = event.features?.[0]?.properties as { kind?: unknown; ref?: unknown } | undefined;
	if ((props?.kind !== "hiking" && props?.kind !== "cycling") || typeof props.ref !== "string" || !props.ref) {
		return null;
	}
	return { kind: props.kind, ref: props.ref };
}

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

	if (!nodeNetworkOverlaysEnabled()) return null;
	if (!showHiking && !showCycling) return null;

	return <ActiveNodesOverlay showHiking={showHiking} showCycling={showCycling} />;
}

function ActiveNodesOverlay({ showHiking, showCycling }: { showHiking: boolean; showCycling: boolean }) {
	const { current: mapRef } = useMap();
	const [data, setData] = useState<NodeFeatureCollection>(EMPTY_DATA);
	const [hoveredNode, setHoveredNode] = useState<ActiveNode | null>(null);
	const [selectedNode, setSelectedNode] = useState<ActiveNode | null>(null);
	const [previousNode, setPreviousNode] = useState<ActiveNode | null>(null);
	const lastKeyRef = useRef<string | null>(null);
	const loadedBboxRef = useRef<NodeNetworkBbox | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const splitKinds = showHiking && showCycling;
	const activeNode = hoveredNode ?? selectedNode;
	const activePair =
		activeNode && selectedNode && activeNode.kind === selectedNode.kind && !sameNode(activeNode, selectedNode)
			? { from: selectedNode, to: activeNode }
			: selectedNode && previousNode && selectedNode.kind === previousNode.kind && !sameNode(selectedNode, previousNode)
				? { from: previousNode, to: selectedNode }
				: null;
	const activeNodeColor = activeNode ? kindColor(activeNode.kind) : HIKING_COLOR;
	const activeTranslate =
		activeNode && splitKinds ? (activeNode.kind === "hiking" ? HIKING_TRANSLATE : CYCLING_TRANSLATE) : [0, 0];
	const previousEndpoint = activePair?.from ?? null;
	const previousNodeColor = previousEndpoint ? kindColor(previousEndpoint.kind) : HIKING_COLOR;
	const previousTranslate =
		previousEndpoint && splitKinds
			? previousEndpoint.kind === "hiking"
				? HIKING_TRANSLATE
				: CYCLING_TRANSLATE
			: [0, 0];

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

	useEffect(() => {
		setHoveredNode((node) =>
			node && ((node.kind === "hiking" && showHiking) || (node.kind === "cycling" && showCycling)) ? node : null,
		);
		setSelectedNode((node) =>
			node && ((node.kind === "hiking" && showHiking) || (node.kind === "cycling" && showCycling)) ? node : null,
		);
		setPreviousNode((node) =>
			node && ((node.kind === "hiking" && showHiking) || (node.kind === "cycling" && showCycling)) ? node : null,
		);
	}, [showHiking, showCycling]);

	useEffect(() => {
		const map = mapRef?.getMap();
		if (!map) return;

		const layerIds = [
			showHiking ? "rds-nodes-point-hiking" : null,
			showHiking ? "rds-nodes-label-hiking" : null,
			showCycling ? "rds-nodes-point-cycling" : null,
			showCycling ? "rds-nodes-label-cycling" : null,
		].filter(Boolean) as string[];

		const handleMouseEnter = (event: MapLayerMouseEvent) => {
			const node = nodeFromEvent(event);
			if (!node) return;
			map.getCanvas().style.cursor = "pointer";
			setHoveredNode(node);
		};

		const handleMouseLeave = () => {
			map.getCanvas().style.cursor = "";
			setHoveredNode(null);
		};

		const handleClick = (event: MapLayerMouseEvent) => {
			const node = nodeFromEvent(event);
			if (!node) return;
			event.preventDefault();
			setSelectedNode((current) => {
				if (sameNode(current, node)) {
					setPreviousNode(null);
					return null;
				}
				setPreviousNode(current?.kind === node.kind ? current : null);
				return node;
			});
		};

		const attachedLayerIds = layerIds.filter((layerId) => map.getLayer(layerId));
		for (const layerId of attachedLayerIds) {
			map.on("mouseenter", layerId, handleMouseEnter);
			map.on("mouseleave", layerId, handleMouseLeave);
			map.on("click", layerId, handleClick);
		}

		return () => {
			map.getCanvas().style.cursor = "";
			for (const layerId of attachedLayerIds) {
				map.off("mouseenter", layerId, handleMouseEnter);
				map.off("mouseleave", layerId, handleMouseLeave);
				map.off("click", layerId, handleClick);
			}
		};
	}, [mapRef, showHiking, showCycling]);

	return (
		<Source id="rds-nodes" type="geojson" data={data}>
			{showHiking && (
				<Layer
					id="rds-nodes-line-hiking"
					type="line"
					filter={lineFilter("hiking")}
					layout={{ "line-join": "round", "line-cap": "round" }}
					paint={{
						"line-color": HIKING_COLOR,
						"line-width": BASE_LINE_WIDTH,
						"line-dasharray": [2, 1.5],
						"line-opacity": 0.85,
						"line-offset": splitKinds ? -1.3 : 0,
					}}
				/>
			)}
			{showCycling && (
				<Layer
					id="rds-nodes-line-cycling"
					type="line"
					filter={lineFilter("cycling")}
					layout={{ "line-join": "round", "line-cap": "round" }}
					paint={{
						"line-color": CYCLING_COLOR,
						"line-width": BASE_LINE_WIDTH,
						"line-dasharray": [4, 2],
						"line-opacity": 0.85,
						"line-offset": splitKinds ? 1.3 : 0,
					}}
				/>
			)}
			{activePair && (
				<Layer
					id="rds-nodes-line-active"
					type="line"
					filter={connectedLineFilter(activePair)}
					layout={{ "line-join": "round", "line-cap": "round" }}
					paint={{
						"line-color": activeNodeColor,
						"line-width": HIGHLIGHT_LINE_WIDTH,
						"line-opacity": 0.9,
						"line-blur": 0.5,
						"line-offset": splitKinds ? (activeNode.kind === "hiking" ? -1.3 : 1.3) : 0,
					}}
				/>
			)}
			{showHiking && (
				<Layer
					id="rds-nodes-point-hiking"
					type="circle"
					filter={pointFilter("hiking")}
					paint={{
						"circle-radius": NODE_RADIUS,
						"circle-color": "#ffffff",
						"circle-stroke-color": HIKING_COLOR,
						"circle-stroke-width": 1.5,
						"circle-opacity": 0.95,
						"circle-translate": splitKinds ? HIKING_TRANSLATE : [0, 0],
					}}
				/>
			)}
			{showCycling && (
				<Layer
					id="rds-nodes-point-cycling"
					type="circle"
					filter={pointFilter("cycling")}
					paint={{
						"circle-radius": NODE_RADIUS,
						"circle-color": "#ffffff",
						"circle-stroke-color": CYCLING_COLOR,
						"circle-stroke-width": 1.5,
						"circle-opacity": 0.95,
						"circle-translate": splitKinds ? CYCLING_TRANSLATE : [0, 0],
					}}
				/>
			)}
			{previousEndpoint && (
				<Layer
					id="rds-nodes-point-previous"
					type="circle"
					filter={activePointFilter(previousEndpoint)}
					paint={{
						"circle-radius": NODE_HALO_RADIUS,
						"circle-color": "rgba(255,255,255,0)",
						"circle-stroke-color": previousNodeColor,
						"circle-stroke-width": 2,
						"circle-opacity": 0.75,
						"circle-translate": previousTranslate,
					}}
				/>
			)}
			{activeNode && (
				<Layer
					id="rds-nodes-point-active"
					type="circle"
					filter={activePointFilter(activeNode)}
					paint={{
						"circle-radius": NODE_HALO_RADIUS,
						"circle-color": "rgba(255,255,255,0)",
						"circle-stroke-color": activeNodeColor,
						"circle-stroke-width": 3,
						"circle-opacity": 0.95,
						"circle-translate": activeTranslate,
					}}
				/>
			)}
			{showHiking && (
				<Layer
					id="rds-nodes-label-hiking"
					type="symbol"
					filter={pointFilter("hiking")}
					layout={{
						"text-field": ["coalesce", ["get", "ref"], ""],
						"text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
						"text-size": NODE_TEXT_SIZE,
						"text-allow-overlap": false,
						"text-ignore-placement": false,
						"text-padding": 2,
					}}
					paint={{
						"text-color": HIKING_COLOR,
						"text-halo-color": "#ffffff",
						"text-halo-width": 1.2,
						"text-translate": splitKinds ? HIKING_TRANSLATE : [0, 0],
					}}
				/>
			)}
			{showCycling && (
				<Layer
					id="rds-nodes-label-cycling"
					type="symbol"
					filter={pointFilter("cycling")}
					layout={{
						"text-field": ["coalesce", ["get", "ref"], ""],
						"text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
						"text-size": NODE_TEXT_SIZE,
						"text-allow-overlap": false,
						"text-ignore-placement": false,
						"text-padding": 2,
					}}
					paint={{
						"text-color": CYCLING_COLOR,
						"text-halo-color": "#ffffff",
						"text-halo-width": 1.2,
						"text-translate": splitKinds ? CYCLING_TRANSLATE : [0, 0],
					}}
				/>
			)}
		</Source>
	);
}
