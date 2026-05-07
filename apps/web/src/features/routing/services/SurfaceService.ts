import type { Coordinate } from "@routess/core";
import { Logger } from "@/lib/logger";
import { getRuntimeConfig } from "@/lib/runtime-config";
import type { ValhallaCosting } from "./routingMode";

// Prefer Stadia Maps when VITE_STADIA_API_KEY is set (reliable, free tier).
// Fall back to the public FOSSGIS Valhalla instance otherwise; fine for local
// hacking but frequently slow or unreachable.
const STADIA_API_KEY = getRuntimeConfig("VITE_STADIA_API_KEY")?.trim();
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

export interface SurfaceSegment {
	surface: SurfaceBucket;
	coordinates: Coordinate[];
}

export interface SurfaceBreakdown {
	meters: Record<SurfaceBucket, number>;
	total: number;
	segments: SurfaceSegment[];
}

interface ValhallaEdge {
	surface?: string;
	length?: number;
	begin_shape_index?: number;
	end_shape_index?: number;
}

interface ValhallaTraceAttributesResponse {
	edges?: ValhallaEdge[];
	shape?: string;
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
			attributes: ["edge.surface", "edge.length", "edge.begin_shape_index", "edge.end_shape_index", "shape"],
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

	const matchedShape = typeof data.shape === "string" ? decodePolyline6(data.shape) : null;
	const segments = matchedShape ? buildSurfaceSegments(edges, matchedShape) : [];

	return { meters, total, segments };
}

// Group consecutive edges sharing the same surface bucket into one polyline segment
// using each edge's [begin_shape_index, end_shape_index] range against the matched shape.
function buildSurfaceSegments(edges: ValhallaEdge[], shape: Coordinate[]): SurfaceSegment[] {
	if (shape.length < 2) return [];
	const segments: SurfaceSegment[] = [];
	let current: { bucket: SurfaceBucket; begin: number; end: number } | null = null;

	for (const edge of edges) {
		const begin = edge.begin_shape_index;
		const end = edge.end_shape_index;
		if (typeof begin !== "number" || typeof end !== "number" || end <= begin) continue;
		const bucket = SURFACE_BUCKETS[edge.surface ?? ""] ?? "unpaved";

		if (current && current.bucket === bucket && begin <= current.end) {
			current.end = Math.max(current.end, end);
		} else {
			if (current) segments.push(sliceSegment(current.bucket, current.begin, current.end, shape));
			current = { bucket, begin, end };
		}
	}
	if (current) segments.push(sliceSegment(current.bucket, current.begin, current.end, shape));
	return segments.filter((s) => s.coordinates.length >= 2);
}

function sliceSegment(bucket: SurfaceBucket, begin: number, end: number, shape: Coordinate[]): SurfaceSegment {
	const lo = Math.max(0, Math.min(begin, shape.length - 1));
	const hi = Math.max(0, Math.min(end, shape.length - 1));
	return { surface: bucket, coordinates: shape.slice(lo, hi + 1) };
}

// Valhalla returns shape as a polyline encoded with precision 1e6 (vs Google's 1e5).
function decodePolyline6(encoded: string): Coordinate[] {
	const factor = 1e6;
	const coords: Coordinate[] = [];
	let index = 0;
	let lat = 0;
	let lng = 0;
	while (index < encoded.length) {
		let result = 0;
		let shift = 0;
		let byte: number;
		do {
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);
		lat += result & 1 ? ~(result >> 1) : result >> 1;

		result = 0;
		shift = 0;
		do {
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);
		lng += result & 1 ? ~(result >> 1) : result >> 1;

		coords.push([lng / factor, lat / factor]);
	}
	return coords;
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
