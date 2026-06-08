import { ApiHttpError, generateRequestId } from "@routess/api-client";
import type { Coordinate, RouteActivity, SurfaceBucket, SurfaceComposition } from "@routess/core";
import { decodePolyline6, surfaceCompositionFromEdges, valhallaCostingModelForActivity } from "@routess/core";
import { Logger } from "@/lib/logger";
import { getRuntimeConfig } from "@/lib/runtime-config";

// Surface breakdowns are served by the API, which proxies to the self-hosted
// Valhalla service (cluster-internal; never reachable from the browser).
const API_BASE_URL = getRuntimeConfig("VITE_API_URL") ?? "";
const TRACE_ATTRIBUTES_URL = `${API_BASE_URL.replace(/\/+$/, "")}/api/v1/routing/trace-attributes`;

const MAX_SHAPE_POINTS = 1500;

export type { SurfaceBucket } from "@routess/core";

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
	const composition = surfaceCompositionFromEdges(data.edges ?? [], data.shape);
	return composition ? breakdownFromComposition(composition) : null;
}

// Expands a (persisted or freshly computed) SurfaceComposition into the
// render shape: segment indices are sliced against the decoded matched shape.
// Shared by the live trace path and routes that carry surfaceComposition from
// the API, so both render identically.
export function breakdownFromComposition(composition: SurfaceComposition): SurfaceBreakdown | null {
	if (composition.total <= 0) return null;
	const shape = composition.shape ? decodePolyline6(composition.shape) : null;
	const segments: SurfaceSegment[] =
		shape && shape.length >= 2
			? composition.segments
					.map((segment) => {
						const lo = Math.max(0, Math.min(segment.begin, shape.length - 1));
						const hi = Math.max(0, Math.min(segment.end, shape.length - 1));
						return {
							surface: segment.surface,
							coordinates: shape.slice(lo, hi + 1),
							distanceStartMeters: segment.distanceStartMeters,
							distanceEndMeters: segment.distanceEndMeters,
						};
					})
					.filter((segment) => segment.coordinates.length >= 2)
			: [];
	return { meters: composition.meters, total: composition.total, segments };
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
