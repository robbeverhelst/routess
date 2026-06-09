import type { MapLayerMouseEvent } from "mapbox-gl";
import { useEffect, useState } from "react";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import { getRuntimeConfig } from "@/lib/runtime-config";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { NODE_NETWORK_COLORS } from "./nodeNetworkColors";
import { resolveNodeTilesUrl } from "./nodeTilesUrl";

// Node networks are pre-extracted from OSM into a self-hosted PMTiles file
// (ADR 0033), served as standard vector tiles via a TileJSON endpoint
// (go-pmtiles). VITE_NODE_TILES_URL is that TileJSON URL, not the raw .pmtiles:
// mapbox-gl's native pmtiles provider crashes under terrain. A plain vector
// source renders like the basemap, so Mapbox owns culling, caching, and LOD.
export type NodeNetworkKind = "hiking" | "cycling";

const SOURCE_ID = "rds-nodes";
const SOURCE_LAYER = "node_network";
const NODE_TILES_URL = resolveNodeTilesUrl(getRuntimeConfig("VITE_NODE_TILES_URL"));

const HIKING_COLOR = NODE_NETWORK_COLORS.hiking;
const CYCLING_COLOR = NODE_NETWORK_COLORS.cycling;
const ODBL_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL)';

// Lines render from a low zoom (clean network shape). The numbered nodes are
// all-or-nothing: hidden while zoomed out, then every dot + number shows at
// once from NODE_MIN_ZOOM (labels allow overlap, so none are collision-hidden).
// A partial collision reveal reads as "numbers missing", so we wait until the
// zoom where nodes are spaced enough to show the whole set.
const LINE_MIN_ZOOM = 8;
const NODE_MIN_ZOOM = 12;

const LINE_WIDTH = ["interpolate", ["linear"], ["zoom"], 9, 1.2, 12, 2, 14, 2.6, 17, 3.6];
const HIGHLIGHT_LINE_WIDTH = ["interpolate", ["linear"], ["zoom"], 12, 4, 14, 6, 17, 8];
const NODE_RADIUS = ["interpolate", ["linear"], ["zoom"], 12, 8, 14, 10, 17, 13];
const NODE_HALO_RADIUS = ["interpolate", ["linear"], ["zoom"], 12, 11, 14, 14, 17, 17];
const NODE_TEXT_SIZE = ["interpolate", ["linear"], ["zoom"], 12, 10.5, 14, 11.5, 17, 13];

type ActiveNode = {
	kind: NodeNetworkKind;
	ref: string;
};

type ActiveNodePair = {
	from: ActiveNode;
	to: ActiveNode;
};

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

export function NodesOverlay() {
	const showNodeNetworkOverlays = useRedesignSettingsStore((s) => s.showNodeNetworkOverlays);
	const showHiking = useRedesignSettingsStore((s) => s.overlays?.hikingNodes ?? false);
	const showCycling = useRedesignSettingsStore((s) => s.overlays?.cyclingNodes ?? false);

	if (!NODE_TILES_URL) return null;
	if (!showNodeNetworkOverlays) return null;
	if (!showHiking && !showCycling) return null;

	return <ActiveNodesOverlay tilesUrl={NODE_TILES_URL} showHiking={showHiking} showCycling={showCycling} />;
}

// ODbL credit for the self-hosted node-network data (ADR 0033). The map's
// global attribution control is disabled, so we surface a scoped credit only
// while the overlay is visible. Mount this as a sibling of the map canvas.
export function NodeNetworkAttribution() {
	const showNodeNetworkOverlays = useRedesignSettingsStore((s) => s.showNodeNetworkOverlays);
	const showHiking = useRedesignSettingsStore((s) => s.overlays?.hikingNodes ?? false);
	const showCycling = useRedesignSettingsStore((s) => s.overlays?.cyclingNodes ?? false);

	if (!NODE_TILES_URL) return null;
	if (!showNodeNetworkOverlays) return null;
	if (!showHiking && !showCycling) return null;

	return (
		<div className="pointer-events-none absolute bottom-1 left-1 z-10 rounded bg-white/70 px-1.5 py-0.5 text-[10px] leading-none text-gray-600 dark:bg-black/50 dark:text-gray-300">
			<a
				className="pointer-events-auto hover:underline"
				href="https://www.openstreetmap.org/copyright"
				target="_blank"
				rel="noreferrer"
			>
				© OpenStreetMap (ODbL)
			</a>
		</div>
	);
}

function ActiveNodesOverlay({
	tilesUrl,
	showHiking,
	showCycling,
}: {
	tilesUrl: string;
	showHiking: boolean;
	showCycling: boolean;
}) {
	const { current: mapRef } = useMap();
	const [hoveredNode, setHoveredNode] = useState<ActiveNode | null>(null);
	const [selectedNode, setSelectedNode] = useState<ActiveNode | null>(null);
	const [previousNode, setPreviousNode] = useState<ActiveNode | null>(null);
	const activeNode = hoveredNode ?? selectedNode;
	const activePair =
		activeNode && selectedNode && activeNode.kind === selectedNode.kind && !sameNode(activeNode, selectedNode)
			? { from: selectedNode, to: activeNode }
			: selectedNode && previousNode && selectedNode.kind === previousNode.kind && !sameNode(selectedNode, previousNode)
				? { from: previousNode, to: selectedNode }
				: null;
	const activeNodeColor = activeNode ? kindColor(activeNode.kind) : HIKING_COLOR;
	const previousEndpoint = activePair?.from ?? null;
	const previousNodeColor = previousEndpoint ? kindColor(previousEndpoint.kind) : HIKING_COLOR;

	// Drop any selection whose kind was just toggled off.
	useEffect(() => {
		const keep = (node: ActiveNode | null) =>
			node && ((node.kind === "hiking" && showHiking) || (node.kind === "cycling" && showCycling)) ? node : null;
		setHoveredNode(keep);
		setSelectedNode(keep);
		setPreviousNode(keep);
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
		<Source id={SOURCE_ID} type="vector" url={tilesUrl} attribution={ODBL_ATTRIBUTION}>
			{showHiking && (
				<Layer
					id="rds-nodes-line-hiking"
					type="line"
					source-layer={SOURCE_LAYER}
					minzoom={LINE_MIN_ZOOM}
					filter={lineFilter("hiking")}
					layout={{ "line-join": "round", "line-cap": "round" }}
					paint={{ "line-color": HIKING_COLOR, "line-width": LINE_WIDTH, "line-opacity": 0.9 }}
				/>
			)}
			{showCycling && (
				<Layer
					id="rds-nodes-line-cycling"
					type="line"
					source-layer={SOURCE_LAYER}
					minzoom={LINE_MIN_ZOOM}
					filter={lineFilter("cycling")}
					layout={{ "line-join": "round", "line-cap": "round" }}
					paint={{ "line-color": CYCLING_COLOR, "line-width": LINE_WIDTH, "line-opacity": 0.9 }}
				/>
			)}
			{activePair && (
				<Layer
					id="rds-nodes-line-active"
					type="line"
					source-layer={SOURCE_LAYER}
					minzoom={LINE_MIN_ZOOM}
					filter={connectedLineFilter(activePair)}
					layout={{ "line-join": "round", "line-cap": "round" }}
					paint={{
						"line-color": activeNodeColor,
						"line-width": HIGHLIGHT_LINE_WIDTH,
						"line-opacity": 0.9,
						"line-blur": 0.5,
					}}
				/>
			)}
			{showHiking && (
				<Layer
					id="rds-nodes-point-hiking"
					type="circle"
					source-layer={SOURCE_LAYER}
					minzoom={NODE_MIN_ZOOM}
					filter={pointFilter("hiking")}
					paint={{
						"circle-radius": NODE_RADIUS,
						"circle-color": "#ffffff",
						"circle-stroke-color": HIKING_COLOR,
						"circle-stroke-width": 2,
						"circle-opacity": 1,
					}}
				/>
			)}
			{showCycling && (
				<Layer
					id="rds-nodes-point-cycling"
					type="circle"
					source-layer={SOURCE_LAYER}
					minzoom={NODE_MIN_ZOOM}
					filter={pointFilter("cycling")}
					paint={{
						"circle-radius": NODE_RADIUS,
						"circle-color": "#ffffff",
						"circle-stroke-color": CYCLING_COLOR,
						"circle-stroke-width": 2,
						"circle-opacity": 1,
					}}
				/>
			)}
			{previousEndpoint && (
				<Layer
					id="rds-nodes-point-previous"
					type="circle"
					source-layer={SOURCE_LAYER}
					minzoom={NODE_MIN_ZOOM}
					filter={activePointFilter(previousEndpoint)}
					paint={{
						"circle-radius": NODE_HALO_RADIUS,
						"circle-color": "rgba(255,255,255,0)",
						"circle-stroke-color": previousNodeColor,
						"circle-stroke-width": 2,
						"circle-opacity": 0.75,
					}}
				/>
			)}
			{activeNode && (
				<Layer
					id="rds-nodes-point-active"
					type="circle"
					source-layer={SOURCE_LAYER}
					minzoom={NODE_MIN_ZOOM}
					filter={activePointFilter(activeNode)}
					paint={{
						"circle-radius": NODE_HALO_RADIUS,
						"circle-color": "rgba(255,255,255,0)",
						"circle-stroke-color": activeNodeColor,
						"circle-stroke-width": 3,
						"circle-opacity": 0.95,
					}}
				/>
			)}
			{showHiking && (
				<Layer
					id="rds-nodes-label-hiking"
					type="symbol"
					source-layer={SOURCE_LAYER}
					minzoom={NODE_MIN_ZOOM}
					filter={pointFilter("hiking")}
					layout={{
						"text-field": ["coalesce", ["get", "ref"], ""],
						"text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
						"text-size": NODE_TEXT_SIZE,
						"text-allow-overlap": true,
						"text-ignore-placement": true,
						"text-padding": 2,
					}}
					paint={{ "text-color": HIKING_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.4 }}
				/>
			)}
			{showCycling && (
				<Layer
					id="rds-nodes-label-cycling"
					type="symbol"
					source-layer={SOURCE_LAYER}
					minzoom={NODE_MIN_ZOOM}
					filter={pointFilter("cycling")}
					layout={{
						"text-field": ["coalesce", ["get", "ref"], ""],
						"text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
						"text-size": NODE_TEXT_SIZE,
						"text-allow-overlap": true,
						"text-ignore-placement": true,
						"text-padding": 2,
					}}
					paint={{ "text-color": CYCLING_COLOR, "text-halo-color": "#ffffff", "text-halo-width": 1.4 }}
				/>
			)}
		</Source>
	);
}
