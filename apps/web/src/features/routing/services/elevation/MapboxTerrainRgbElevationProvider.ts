import type { Coordinate } from "@routess/core";
import { Logger } from "@/lib/logger";
import type { ElevationProvider } from "./types";

// Mapbox Terrain-RGB encodes elevation in PNG raster tiles:
//   elevation_m = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
// Fetching the tile once gives us elevation for every point inside it,
// which is dramatically cheaper than per-point Tilequery requests.
//
// Docs: https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/

const DEFAULT_ZOOM = 14;
const TILE_URL = (z: number, x: number, y: number, token: string): string =>
	`https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}@2x.pngraw?access_token=${encodeURIComponent(token)}`;

interface TilePixel {
	tileX: number;
	tileY: number;
	pixelXFrac: number;
	pixelYFrac: number;
}

interface TileImage {
	data: Uint8ClampedArray;
	width: number;
	height: number;
}

const lonLatToTilePixel = (lon: number, lat: number, zoom: number): TilePixel => {
	const n = 2 ** zoom;
	const xTile = ((lon + 180) / 360) * n;
	const sinLat = Math.sin((lat * Math.PI) / 180);
	const yTile = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * n;
	const tileX = Math.floor(xTile);
	const tileY = Math.floor(yTile);
	return {
		tileX,
		tileY,
		pixelXFrac: xTile - tileX,
		pixelYFrac: yTile - tileY,
	};
};

const decodeElevation = (r: number, g: number, b: number): number => -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;

const sampleTile = (tile: TileImage, xFrac: number, yFrac: number): number => {
	const px = Math.min(tile.width - 1, Math.max(0, Math.floor(xFrac * tile.width)));
	const py = Math.min(tile.height - 1, Math.max(0, Math.floor(yFrac * tile.height)));
	const idx = (py * tile.width + px) * 4;
	return decodeElevation(tile.data[idx], tile.data[idx + 1], tile.data[idx + 2]);
};

const fetchTile = async (
	z: number,
	x: number,
	y: number,
	accessToken: string,
	signal?: AbortSignal,
): Promise<TileImage | null> => {
	const url = TILE_URL(z, x, y, accessToken);
	try {
		const response = await fetch(url, { signal });
		if (!response.ok) {
			Logger.warn(`[Elevation] Terrain-RGB tile ${z}/${x}/${y} returned ${response.status}`);
			return null;
		}
		const blob = await response.blob();
		const bitmap = await createImageBitmap(blob);
		const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
		const ctx = canvas.getContext("2d");
		if (!ctx) return null;
		ctx.drawImage(bitmap, 0, 0);
		const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
		return { data: imageData.data, width: bitmap.width, height: bitmap.height };
	} catch (err) {
		if ((err as Error)?.name === "AbortError") return null;
		Logger.warn(`[Elevation] Failed to fetch terrain tile ${z}/${x}/${y}:`, err);
		return null;
	}
};

export interface MapboxTerrainRgbProviderOptions {
	accessToken: string;
	zoom?: number;
	// How many tile fetches to run in parallel.
	concurrency?: number;
}

export class MapboxTerrainRgbElevationProvider implements ElevationProvider {
	private readonly accessToken: string;
	private readonly zoom: number;
	private readonly concurrency: number;
	// Tiles are immutable — cache by `${z}/${x}/${y}` across route edits so
	// nudging a waypoint within an already-fetched tile costs zero requests.
	private readonly tileCache = new Map<string, TileImage | null>();

	constructor(opts: MapboxTerrainRgbProviderOptions) {
		this.accessToken = opts.accessToken;
		this.zoom = opts.zoom ?? DEFAULT_ZOOM;
		this.concurrency = Math.max(1, opts.concurrency ?? 6);
	}

	async sample(points: Coordinate[], signal?: AbortSignal): Promise<(number | null)[]> {
		if (points.length === 0) return [];
		if (!this.accessToken) {
			Logger.warn("[Elevation] Missing Mapbox access token; skipping elevation sampling.");
			return points.map(() => null);
		}

		const tilePixels: TilePixel[] = points.map(([lon, lat]) => lonLatToTilePixel(lon, lat, this.zoom));
		const uniqueKeys: string[] = [];
		const seen = new Set<string>();
		for (const { tileX, tileY } of tilePixels) {
			const key = `${this.zoom}/${tileX}/${tileY}`;
			if (!seen.has(key) && !this.tileCache.has(key)) {
				seen.add(key);
				uniqueKeys.push(key);
			}
		}

		// Fetch all needed tiles with bounded concurrency.
		let cursor = 0;
		const runWorker = async () => {
			while (true) {
				if (signal?.aborted) return;
				const i = cursor++;
				if (i >= uniqueKeys.length) return;
				const key = uniqueKeys[i];
				const [zStr, xStr, yStr] = key.split("/");
				const tile = await fetchTile(Number(zStr), Number(xStr), Number(yStr), this.accessToken, signal);
				this.tileCache.set(key, tile);
			}
		};
		const workers = Array.from({ length: Math.min(this.concurrency, uniqueKeys.length) }, runWorker);
		await Promise.all(workers);

		return tilePixels.map(({ tileX, tileY, pixelXFrac, pixelYFrac }) => {
			const tile = this.tileCache.get(`${this.zoom}/${tileX}/${tileY}`);
			if (!tile) return null;
			return sampleTile(tile, pixelXFrac, pixelYFrac);
		});
	}
}
