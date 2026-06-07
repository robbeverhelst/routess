import { type GeoJSONSource, LngLatBounds, type Map as MapboxMap, type MapMouseEvent } from "mapbox-gl";
import { useEffect } from "react";
import { type GenerationCandidateView, useGenerationStore } from "@/stores/generationStore";

const SOURCE_ID = "generation-candidates";
const CASING_LAYER_ID = "generation-candidates-casing";
const DIM_LAYER_ID = "generation-candidates-dim";
const SELECTED_LAYER_ID = "generation-candidates-selected";

function removeLayers(map: MapboxMap) {
	for (const id of [SELECTED_LAYER_ID, DIM_LAYER_ID, CASING_LAYER_ID]) {
		if (map.getLayer(id)) map.removeLayer(id);
	}
	if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

function toFeatureCollection(candidates: GenerationCandidateView[], selectedIndex: number) {
	return {
		type: "FeatureCollection" as const,
		features: candidates.map((candidate, index) => ({
			type: "Feature" as const,
			properties: { index, selected: index === selectedIndex },
			geometry: { type: "LineString" as const, coordinates: candidate.geometry },
		})),
	};
}

function draw(map: MapboxMap, candidates: GenerationCandidateView[], selectedIndex: number) {
	const data = toFeatureCollection(candidates, selectedIndex);
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
		filter: ["==", ["get", "selected"], true],
		layout: { "line-cap": "round", "line-join": "round" },
		paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.85 },
	});
	map.addLayer({
		id: DIM_LAYER_ID,
		type: "line",
		source: SOURCE_ID,
		filter: ["==", ["get", "selected"], false],
		layout: { "line-cap": "round", "line-join": "round" },
		paint: { "line-color": "#7d62ff", "line-width": 3, "line-opacity": 0.35 },
	});
	map.addLayer({
		id: SELECTED_LAYER_ID,
		type: "line",
		source: SOURCE_ID,
		filter: ["==", ["get", "selected"], true],
		layout: { "line-cap": "round", "line-join": "round" },
		paint: { "line-color": "#7d62ff", "line-width": 4.5, "line-opacity": 0.95 },
	});
}

function fitToCandidates(map: MapboxMap, candidates: GenerationCandidateView[]) {
	const all = candidates.flatMap((c) => c.geometry);
	if (all.length === 0) return;
	const bounds = all.reduce((b, c) => b.extend(c), new LngLatBounds(all[0], all[0]));
	const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
	map.fitBounds(bounds, {
		// Clear of the plan panel on desktop and the candidate cards at the bottom.
		padding: isMobile ? { top: 80, bottom: 280, left: 40, right: 40 } : { top: 80, bottom: 220, left: 460, right: 80 },
		duration: 650,
		maxZoom: 13.5,
	});
}

// Overlays the GenerationCandidates on the map: selected loop bold, others
// dimmed; clicking a dimmed loop selects it. Non-destructive like the library
// preview — never touches the routing store until the user confirms.
export function GenerationPreview({ mapRef }: { mapRef: React.RefObject<MapboxMap | null> }) {
	const status = useGenerationStore((s) => s.status);
	const candidates = useGenerationStore((s) => s.candidates);
	const selectedIndex = useGenerationStore((s) => s.selectedIndex);

	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;
		const visible = status === "ready" && candidates.length > 0;

		const apply = () => {
			removeLayers(map);
			if (!visible) return;
			draw(map, candidates, selectedIndex);
		};

		// Style switches wipe custom layers; re-apply when the new style lands.
		const reapply = () => {
			if (visible) draw(map, candidates, selectedIndex);
		};

		const onClick = (e: MapMouseEvent) => {
			const features = map.queryRenderedFeatures(e.point, { layers: [DIM_LAYER_ID] });
			const index = features[0]?.properties?.index;
			if (typeof index === "number") useGenerationStore.getState().select(index);
		};

		if (map.isStyleLoaded()) apply();
		else map.once("idle", apply);
		map.on("style.load", reapply);
		if (visible) map.on("click", onClick);
		return () => {
			map.off("idle", apply);
			map.off("style.load", reapply);
			map.off("click", onClick);
			if (map.isStyleLoaded()) removeLayers(map);
		};
	}, [status, candidates, selectedIndex, mapRef]);

	// Fit once per candidate set, not on every selection change.
	useEffect(() => {
		const map = mapRef.current;
		if (!map || status !== "ready" || candidates.length === 0) return;
		fitToCandidates(map, candidates);
	}, [status, candidates, mapRef]);

	return null;
}
