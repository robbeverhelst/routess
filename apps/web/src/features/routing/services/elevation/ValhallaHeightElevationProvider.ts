import type { Coordinate } from "@routess/core";
import { getRuntimeConfig } from "@/lib/runtime-config";
import type { ElevationProvider } from "./types";

const API_BASE_URL = getRuntimeConfig("VITE_API_URL") ?? "";
const HEIGHT_URL = `${API_BASE_URL.replace(/\/+$/, "")}/api/v1/routing/height`;

// API cap on points per request; ElevationService samples at most 256, but
// chunk defensively so arbitrary callers stay valid.
const MAX_POINTS_PER_REQUEST = 512;

// Samples elevation through the API's Valhalla /height proxy (ADR 0031): one
// batched request per geometry instead of per-tile Mapbox queries, cached
// server-side and shared across users.
export class ValhallaHeightElevationProvider implements ElevationProvider {
	async sample(points: Coordinate[], signal?: AbortSignal): Promise<(number | null)[]> {
		if (points.length === 0) return [];
		const results: (number | null)[] = [];
		for (let offset = 0; offset < points.length; offset += MAX_POINTS_PER_REQUEST) {
			const chunk = points.slice(offset, offset + MAX_POINTS_PER_REQUEST);
			results.push(...(await this.sampleChunk(chunk, signal)));
		}
		return results;
	}

	private async sampleChunk(points: Coordinate[], signal?: AbortSignal): Promise<(number | null)[]> {
		const response = await fetch(HEIGHT_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ shape: points.map(([lng, lat]) => ({ lat, lon: lng })) }),
			signal,
			credentials: "include",
		});
		if (!response.ok) {
			throw new Error(`height returned ${response.status}`);
		}
		const data = (await response.json()) as { heights?: (number | null)[] };
		const heights = data.heights ?? [];
		// Preserve the one-value-per-input contract even on a short response.
		return points.map((_, i) => (typeof heights[i] === "number" ? heights[i] : null));
	}
}
