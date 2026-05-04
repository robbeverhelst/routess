import type { Coordinate } from "@routess/core";
import { Logger } from "@/lib/logger";
import type { ValhallaCosting } from "./routingMode";

// Prefer Stadia Maps when VITE_STADIA_API_KEY is set (reliable, free tier).
// Fall back to the public FOSSGIS Valhalla instance otherwise; fine for local
// hacking but frequently slow or unreachable.
const STADIA_API_KEY = (import.meta.env.VITE_STADIA_API_KEY as string | undefined)?.trim();
const VALHALLA_TRACE_ATTRIBUTES_URL = STADIA_API_KEY
	? `https://api.stadiamaps.com/trace_attributes/v1?api_key=${encodeURIComponent(STADIA_API_KEY)}`
	: "https://valhalla1.openstreetmap.de/trace_attributes";

const MAX_SHAPE_POINTS = 1500;

export type SurfaceBucket = "paved" | "compacted" | "unpaved" | "path";

const SURFACE_BUCKETS: Record<string, SurfaceBucket> = {
	paved_smooth: "paved",
	paved: "paved",
	paved_rough: "paved",
	compacted: "compacted",
	dirt: "unpaved",
	gravel: "unpaved",
	sand: "unpaved",
	path: "path",
	impassable: "path",
};

export interface SurfaceBreakdown {
	meters: Record<SurfaceBucket, number>;
	total: number;
}

interface ValhallaEdge {
	surface?: string;
	length?: number;
}

interface ValhallaTraceAttributesResponse {
	edges?: ValhallaEdge[];
}

export async function fetchSurfaceBreakdown(
	coords: Coordinate[],
	costing: ValhallaCosting,
	signal?: AbortSignal,
): Promise<SurfaceBreakdown | null> {
	if (coords.length < 2) return null;

	const shape = downsampleCoords(coords, MAX_SHAPE_POINTS).map(([lng, lat]) => ({ lat, lon: lng }));

	const body = {
		shape,
		shape_match: "map_snap",
		costing,
		filters: {
			attributes: ["edge.surface", "edge.length"],
			action: "include",
		},
	};

	let response: Response;
	try {
		response = await fetch(VALHALLA_TRACE_ATTRIBUTES_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal,
		});
	} catch (err) {
		if ((err as Error).name === "AbortError") throw err;
		Logger.warn("[SurfaceService] Valhalla request failed:", err);
		return null;
	}

	if (!response.ok) {
		Logger.warn(`[SurfaceService] Valhalla returned ${response.status}`);
		return null;
	}

	const data = (await response.json()) as ValhallaTraceAttributesResponse;
	const edges = data.edges ?? [];
	if (edges.length === 0) return null;

	const meters: Record<SurfaceBucket, number> = { paved: 0, compacted: 0, unpaved: 0, path: 0 };
	let total = 0;
	for (const edge of edges) {
		if (typeof edge.length !== "number") continue;
		const lengthMeters = edge.length * 1000;
		const bucket = SURFACE_BUCKETS[edge.surface ?? ""] ?? "unpaved";
		meters[bucket] += lengthMeters;
		total += lengthMeters;
	}

	if (total <= 0) return null;
	return { meters, total };
}

function downsampleCoords(coords: Coordinate[], max: number): Coordinate[] {
	if (coords.length <= max) return coords;
	const step = coords.length / max;
	const out: Coordinate[] = [];
	for (let i = 0; i < max; i++) out.push(coords[Math.floor(i * step)]);
	const last = coords[coords.length - 1];
	if (out[out.length - 1] !== last) out.push(last);
	return out;
}
