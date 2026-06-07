import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { CacheService } from "../cache/cache.service";
import { MetricsService } from "../telemetry/metrics.service";
import {
	buildNodeNetworkQuery,
	type NodeFeature,
	type NodeFeatureCollection,
	type NodeNetworkBbox,
	nodeFeaturesFromOverpass,
	type OverpassResponse,
} from "./overpass";

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const OVERPASS_FALLBACK = "https://overpass.kumi.systems/api/interpreter";
const OVERPASS_TIMEOUT_MS = 25_000;

// Requests are quantized to fixed grid cells so every viewport over the same
// area shares cache entries (raw bboxes almost never align across users).
// Cells are small (0.1 deg) on purpose: in dense node-network regions
// (Belgium/NL) a 0.5 deg cell is ~9MB and ~16s from Overpass, which both
// overflows a small Redis and makes a tiny viewport pay for a huge area.
// 0.1 deg cells are ~hundreds of KB each. The cap matches the zoom levels
// where the overlay is actually styled (>= 11); larger viewports are
// rejected so the client waits for zoom-in rather than fanning out into
// dozens of Overpass calls. Node networks change slowly; 14d TTL.
const CELL_SIZE_DEG = 0.1;
const MAX_CELLS_PER_REQUEST = 36;
const MAX_OVERPASS_CONCURRENCY = 4;
const CELL_CACHE_TTL_S = 14 * 24 * 60 * 60;

@Injectable()
export class OverlaysService {
	private readonly logger = new Logger(OverlaysService.name);
	private readonly inFlightCells = new Map<string, Promise<NodeFeature[]>>();

	constructor(
		private readonly cache: CacheService,
		private readonly metrics: MetricsService,
	) {}

	async nodeNetwork(bbox: NodeNetworkBbox): Promise<NodeFeatureCollection> {
		const cells = this.cellsCovering(bbox);
		// Bound fan-out so a cold viewport doesn't fire dozens of parallel
		// Overpass requests (which the public endpoints rate-limit). Warm cells
		// resolve from Redis instantly; only cold ones actually hit Overpass.
		const featureLists = await this.mapWithConcurrency(cells, MAX_OVERPASS_CONCURRENCY, (cell) =>
			this.cellFeatures(cell),
		);

		// Cells overlap at borders (Overpass returns geometries crossing the
		// bbox), so dedupe by feature id.
		const seen = new Set<string>();
		const features: NodeFeature[] = [];
		for (const list of featureLists) {
			for (const feature of list) {
				const id = String(feature.id);
				if (seen.has(id)) continue;
				seen.add(id);
				features.push(feature);
			}
		}
		return { type: "FeatureCollection", features };
	}

	private async mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
		const results: R[] = new Array(items.length);
		let next = 0;
		const worker = async () => {
			while (next < items.length) {
				const i = next++;
				results[i] = await fn(items[i]);
			}
		};
		await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
		return results;
	}

	// Float-safe cell index: 4.0 / 0.1 is 39.9999… in IEEE-754, which would
	// floor to the wrong cell. The epsilon nudges exact boundaries up.
	private cellIndex(coord: number): number {
		return Math.floor(coord / CELL_SIZE_DEG + 1e-9);
	}

	private cellsCovering(bbox: NodeNetworkBbox): { x: number; y: number }[] {
		const minX = this.cellIndex(bbox.west);
		const maxX = this.cellIndex(bbox.east);
		const minY = this.cellIndex(bbox.south);
		const maxY = this.cellIndex(bbox.north);
		const cells: { x: number; y: number }[] = [];
		for (let x = minX; x <= maxX; x++) {
			for (let y = minY; y <= maxY; y++) {
				cells.push({ x, y });
			}
		}
		if (cells.length === 0 || cells.length > MAX_CELLS_PER_REQUEST) {
			throw new BadRequestException(`Bbox must cover between 1 and ${MAX_CELLS_PER_REQUEST} grid cells`);
		}
		return cells;
	}

	private async cellFeatures(cell: { x: number; y: number }): Promise<NodeFeature[]> {
		const key = `${cell.x}:${cell.y}`;
		const cached = await this.cache.get<NodeFeature[]>("overpass-nodes", key);
		if (cached) return cached;

		// Concurrent viewports racing on the same cold cell collapse to one
		// upstream fetch per replica.
		const existing = this.inFlightCells.get(key);
		if (existing) return existing;

		const fetchPromise = this.fetchCellFromOverpass(cell)
			.then(async (features) => {
				await this.cache.set("overpass-nodes", key, features, CELL_CACHE_TTL_S);
				return features;
			})
			.finally(() => {
				this.inFlightCells.delete(key);
			});
		this.inFlightCells.set(key, fetchPromise);
		return fetchPromise;
	}

	private async fetchCellFromOverpass(cell: { x: number; y: number }): Promise<NodeFeature[]> {
		const bbox: NodeNetworkBbox = {
			west: cell.x * CELL_SIZE_DEG,
			east: (cell.x + 1) * CELL_SIZE_DEG,
			south: cell.y * CELL_SIZE_DEG,
			north: (cell.y + 1) * CELL_SIZE_DEG,
		};
		const query = buildNodeNetworkQuery(bbox);
		let data: OverpassResponse;
		try {
			data = await this.postOverpass(query, OVERPASS_ENDPOINT);
		} catch (err) {
			this.logger.warn(`Overpass primary endpoint failed, falling back: ${(err as Error).message}`);
			try {
				data = await this.postOverpass(query, OVERPASS_FALLBACK);
			} catch (fallbackErr) {
				this.logger.warn(`Overpass fallback endpoint failed: ${(fallbackErr as Error).message}`);
				throw new ServiceUnavailableException("Node network data is temporarily unavailable");
			}
		}
		return nodeFeaturesFromOverpass(data);
	}

	private async postOverpass(query: string, endpoint: string): Promise<OverpassResponse> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
		const start = Date.now();
		try {
			const response = await fetch(endpoint, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: `data=${encodeURIComponent(query)}`,
				signal: controller.signal,
			});
			this.metrics.recordExternalRequest("overpass", response.ok ? "success" : "error", Date.now() - start);
			this.metrics.recordProviderCall("overpass", "/api/interpreter", "overlays", response.ok ? "success" : "error");
			if (!response.ok) {
				throw new Error(`Overpass ${response.status}`);
			}
			return (await response.json()) as OverpassResponse;
		} catch (err) {
			if ((err as Error).name === "AbortError" || !(err as Error).message.startsWith("Overpass ")) {
				this.metrics.recordExternalRequest("overpass", "error", Date.now() - start);
				this.metrics.recordProviderCall("overpass", "/api/interpreter", "overlays", "error");
			}
			throw err;
		} finally {
			clearTimeout(timeout);
		}
	}
}
