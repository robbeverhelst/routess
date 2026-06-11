import { VectorTile } from "@mapbox/vector-tile";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { GenerationAnchor, RouteActivity } from "@routess/core";
import { PbfReader } from "pbf";
import { CacheService } from "../cache/cache.service";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";

// Knooppunt anchor pool for RouteGeneration (ADR-0037): nodes come from the
// same self-hosted vector tiles the map overlay renders (ADR-0033), fetched
// from go-pmtiles and decoded here. Strictly fail-open: any miss, timeout, or
// out-of-coverage bbox yields an empty pool and generation proceeds without
// knooppunt mode — the toggle can never fail a generation.

const TILE_FETCH_TIMEOUT_MS = 3000;

// Node networks rebuild monthly; a week-long TTL still refreshes well within
// two builds. TileJSON refreshes hourly so a tiles-URL change rolls out fast.
const TILE_CACHE_TTL_S = 7 * 24 * 60 * 60;
const TILEJSON_CACHE_TTL_S = 60 * 60;

// Pick the deepest zoom whose bbox coverage stays within this many tiles
// (every node is present at every zoom, so deeper just means smaller tiles
// and smaller cache entries). MIN/MAX mirror the tile build's zoom range.
const MAX_TILES_PER_POOL = 8;
const MIN_TILE_ZOOM = 8;
const MAX_TILE_ZOOM = 11;

/** [kind, ref, lon, lat] — compact cache representation of one Node. */
type CachedNode = [string, string, number, number];

export interface NodeBbox {
	minLon: number;
	minLat: number;
	maxLon: number;
	maxLat: number;
}

interface TileJson {
	tiles?: string[];
}

const lonToTileX = (lon: number, z: number): number => Math.floor(((lon + 180) / 360) * 2 ** z);
const latToTileY = (lat: number, z: number): number => {
	const rad = (lat * Math.PI) / 180;
	return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
};

export function nodeKindForActivity(activity: RouteActivity): "cycling" | "hiking" {
	return activity === "cycle" ? "cycling" : "hiking";
}

@Injectable()
export class NodeNetworksService {
	private readonly logger = new Logger(NodeNetworksService.name);

	constructor(
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
		private readonly cache: CacheService,
	) {}

	get enabled(): boolean {
		return this.config.routing.nodeTilesUrl.length > 0;
	}

	/** All Nodes of one kind inside the bbox; empty on any failure. */
	async anchorsForBbox(bbox: NodeBbox, kind: "cycling" | "hiking"): Promise<GenerationAnchor[]> {
		if (!this.enabled) return [];
		try {
			const template = await this.tileTemplate();
			if (!template) return [];

			const z = this.zoomForBbox(bbox);
			const tiles: { x: number; y: number }[] = [];
			for (let x = lonToTileX(bbox.minLon, z); x <= lonToTileX(bbox.maxLon, z); x++) {
				for (let y = latToTileY(bbox.maxLat, z); y <= latToTileY(bbox.minLat, z); y++) {
					tiles.push({ x, y });
				}
			}
			if (tiles.length === 0 || tiles.length > MAX_TILES_PER_POOL) return [];

			const perTile = await Promise.all(tiles.map(({ x, y }) => this.tileNodes(template, z, x, y)));
			return perTile
				.flat()
				.filter(
					([nodeKind, , lon, lat]) =>
						nodeKind === kind && lon >= bbox.minLon && lon <= bbox.maxLon && lat >= bbox.minLat && lat <= bbox.maxLat,
				)
				.map(([, ref, lon, lat]) => ({ coordinate: [lon, lat] as [number, number], ref }));
		} catch (err) {
			this.logger.warn(`Node pool unavailable: ${(err as Error).message}`);
			return [];
		}
	}

	private zoomForBbox(bbox: NodeBbox): number {
		for (let z = MAX_TILE_ZOOM; z > MIN_TILE_ZOOM; z--) {
			const cols = lonToTileX(bbox.maxLon, z) - lonToTileX(bbox.minLon, z) + 1;
			const rows = latToTileY(bbox.minLat, z) - latToTileY(bbox.maxLat, z) + 1;
			if (cols * rows <= MAX_TILES_PER_POOL) return z;
		}
		return MIN_TILE_ZOOM;
	}

	/** The {z}/{x}/{y} URL template from the go-pmtiles TileJSON. */
	private async tileTemplate(): Promise<string | null> {
		const url = this.config.routing.nodeTilesUrl;
		const cached = await this.cache.getOrSet<string | null>(
			"node-tilejson",
			this.cache.hashKey(url),
			TILEJSON_CACHE_TTL_S,
			async () => {
				const data = await this.fetchJson<TileJson>(url);
				return data.tiles?.[0] ?? null;
			},
		);
		return cached;
	}

	private async tileNodes(template: string, z: number, x: number, y: number): Promise<CachedNode[]> {
		const key = `${z}/${x}/${y}`;
		return this.cache.getOrSet<CachedNode[]>("node-tiles", key, TILE_CACHE_TTL_S, async () => {
			const url = template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
			const buffer = await this.fetchBuffer(url);
			// A tile outside coverage 404s/204s; treat as empty, cache the emptiness.
			if (!buffer) return [];

			const layer = new VectorTile(new PbfReader(buffer)).layers.node_network;
			if (!layer) return [];
			const nodes: CachedNode[] = [];
			for (let i = 0; i < layer.length; i++) {
				const feature = layer.feature(i);
				if (feature.type !== 1) continue;
				const kind = feature.properties.kind;
				const ref = feature.properties.ref;
				if (typeof kind !== "string" || (typeof ref !== "string" && typeof ref !== "number")) continue;
				const geometry = feature.toGeoJSON(x, y, z).geometry;
				if (geometry.type !== "Point") continue;
				const [lon, lat] = geometry.coordinates as [number, number];
				nodes.push([kind, String(ref), lon, lat]);
			}
			return nodes;
		});
	}

	private async fetchJson<T>(url: string): Promise<T> {
		const response = await this.fetchWithTimeout(url);
		if (!response.ok) throw new Error(`TileJSON returned ${response.status}`);
		return (await response.json()) as T;
	}

	private async fetchBuffer(url: string): Promise<Uint8Array | null> {
		const response = await this.fetchWithTimeout(url);
		if (response.status === 404 || response.status === 204) return null;
		if (!response.ok) throw new Error(`Tile returned ${response.status}`);
		return new Uint8Array(await response.arrayBuffer());
	}

	private async fetchWithTimeout(url: string): Promise<Response> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), TILE_FETCH_TIMEOUT_MS);
		try {
			return await fetch(url, { signal: controller.signal });
		} finally {
			clearTimeout(timeout);
		}
	}
}
