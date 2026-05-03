import type { Coordinate } from "@routess/core";
import { Logger } from "@/lib/logger";
import type { ElevationProvider } from "./types";

// Mapbox Tilequery against the public mapbox-terrain-v2 tileset returns
// nearby contour features. The contour layer's `ele` property is the
// elevation of the nearest contour line in meters. Accuracy is bounded by
// the contour interval (10 m at most zoom levels), which is fine for
// route-level gain after smoothing.
const TILEQUERY_BASE = "https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery";

interface TilequeryFeature {
	properties?: { ele?: number };
}

interface TilequeryResponse {
	features?: TilequeryFeature[];
}

export interface MapboxTilequeryProviderOptions {
	accessToken: string;
	// How many tilequery requests to run in parallel. Mapbox tolerates ~50
	// concurrent connections per token; we stay well below that.
	concurrency?: number;
	// Per-request timeout in ms. Tilequery is usually <500ms.
	timeoutMs?: number;
}

const sampleOne = async (
	point: Coordinate,
	accessToken: string,
	timeoutMs: number,
	signal?: AbortSignal,
): Promise<number | null> => {
	const [lon, lat] = point;
	const url = `${TILEQUERY_BASE}/${lon},${lat}.json?layers=contour&limit=1&access_token=${encodeURIComponent(accessToken)}`;

	const controller = new AbortController();
	const onParentAbort = () => controller.abort();
	if (signal) {
		if (signal.aborted) controller.abort();
		else signal.addEventListener("abort", onParentAbort, { once: true });
	}
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, { method: "GET", signal: controller.signal });
		if (!response.ok) return null;
		const data = (await response.json()) as TilequeryResponse;
		const ele = data.features?.[0]?.properties?.ele;
		return typeof ele === "number" ? ele : null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
		if (signal) signal.removeEventListener("abort", onParentAbort);
	}
};

export class MapboxTilequeryElevationProvider implements ElevationProvider {
	private readonly accessToken: string;
	private readonly concurrency: number;
	private readonly timeoutMs: number;

	constructor(opts: MapboxTilequeryProviderOptions) {
		this.accessToken = opts.accessToken;
		this.concurrency = Math.max(1, opts.concurrency ?? 12);
		this.timeoutMs = opts.timeoutMs ?? 8000;
	}

	async sample(points: Coordinate[], signal?: AbortSignal): Promise<(number | null)[]> {
		if (points.length === 0) return [];
		if (!this.accessToken) {
			Logger.warn("[Elevation] Missing Mapbox access token; skipping elevation sampling.");
			return points.map(() => null);
		}

		const results: (number | null)[] = new Array(points.length).fill(null);
		let cursor = 0;

		const runWorker = async () => {
			while (true) {
				if (signal?.aborted) return;
				const i = cursor++;
				if (i >= points.length) return;
				results[i] = await sampleOne(points[i], this.accessToken, this.timeoutMs, signal);
			}
		};

		const workers = Array.from({ length: Math.min(this.concurrency, points.length) }, runWorker);
		await Promise.all(workers);
		return results;
	}
}
