import { ApiHttpError, generateRequestId } from "@routess/api-client";
import type { Coordinate, RouteActivity } from "@routess/core";
import { valhallaCostingModelForActivity } from "@routess/core";
import { Logger } from "@/lib/logger";
import { getRuntimeConfig } from "@/lib/runtime-config";

// Surface breakdowns are served by the API, which proxies to the self-hosted
// Valhalla service (cluster-internal; never reachable from the browser).
const API_BASE_URL = getRuntimeConfig("VITE_API_URL") ?? "";
const TRACE_ATTRIBUTES_URL = `${API_BASE_URL.replace(/\/+$/, "")}/api/v1/routing/trace-attributes`;

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
	distanceStartMeters: number;
	distanceEndMeters: number;
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
	activity: RouteActivity,
	signal?: AbortSignal,
): Promise<SurfaceBreakdown | null> {
	if (coords.length < 2) return null;

	const shape = downsampleCoords(coords, MAX_SHAPE_POINTS).map(([lng, lat]) => ({ lat, lon: lng }));

	const body = { shape, costing: valhallaCostingModelForActivity(activity) };

	// Same correlation scheme as the api-client: the id lands on the API's
	// logs/traces, and the warn below carries it into GlitchTip.
	const requestId = generateRequestId();

	let response: Response;
	try {
		response = await fetch(TRACE_ATTRIBUTES_URL, {
			method: "POST",
			headers: requestId
				? { "Content-Type": "application/json", "X-Request-ID": requestId }
				: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal,
			credentials: "include",
		});
	} catch (err) {
		if ((err as Error).name === "AbortError") throw err;
		Logger.warn("[SurfaceService] trace-attributes request failed:", err);
		return null;
	}

	if (!response.ok) {
		Logger.warn(
			"[SurfaceService] trace-attributes failed:",
			new ApiHttpError(
				`trace-attributes returned ${response.status}`,
				response.status,
				response.headers.get("x-request-id") ?? requestId,
			),
		);
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
// Distance ranges are summed from edge.length (km) so the strip and chart-hover lookups
// agree with what Valhalla itself measured.
function buildSurfaceSegments(edges: ValhallaEdge[], shape: Coordinate[]): SurfaceSegment[] {
	if (shape.length < 2) return [];
	const segments: SurfaceSegment[] = [];
	let current: {
		bucket: SurfaceBucket;
		begin: number;
		end: number;
		distanceStartMeters: number;
		distanceEndMeters: number;
	} | null = null;
	let cumulativeMeters = 0;

	for (const edge of edges) {
		const begin = edge.begin_shape_index;
		const end = edge.end_shape_index;
		if (typeof begin !== "number" || typeof end !== "number" || end <= begin) continue;
		const bucket = SURFACE_BUCKETS[edge.surface ?? ""] ?? "unpaved";
		const edgeMeters = typeof edge.length === "number" ? edge.length * 1000 : 0;
		const edgeStart = cumulativeMeters;
		const edgeEnd = cumulativeMeters + edgeMeters;
		cumulativeMeters = edgeEnd;

		if (current && current.bucket === bucket && begin <= current.end) {
			current.end = Math.max(current.end, end);
			current.distanceEndMeters = edgeEnd;
		} else {
			if (current) segments.push(sliceSegment(current, shape));
			current = {
				bucket,
				begin,
				end,
				distanceStartMeters: edgeStart,
				distanceEndMeters: edgeEnd,
			};
		}
	}
	if (current) segments.push(sliceSegment(current, shape));
	return segments.filter((s) => s.coordinates.length >= 2);
}

function sliceSegment(
	current: {
		bucket: SurfaceBucket;
		begin: number;
		end: number;
		distanceStartMeters: number;
		distanceEndMeters: number;
	},
	shape: Coordinate[],
): SurfaceSegment {
	const lo = Math.max(0, Math.min(current.begin, shape.length - 1));
	const hi = Math.max(0, Math.min(current.end, shape.length - 1));
	return {
		surface: current.bucket,
		coordinates: shape.slice(lo, hi + 1),
		distanceStartMeters: current.distanceStartMeters,
		distanceEndMeters: current.distanceEndMeters,
	};
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
	// Reserve the last slot for the final coord so the result is always
	// exactly `max` points and never overshoots the API cap.
	const step = coords.length / (max - 1);
	const out: Coordinate[] = [];
	for (let i = 0; i < max - 1; i++) out.push(coords[Math.floor(i * step)]);
	out.push(coords[coords.length - 1]);
	return out;
}
