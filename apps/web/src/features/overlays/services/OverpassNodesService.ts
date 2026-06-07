import { Logger } from "@/lib/logger";
import { getRuntimeConfig } from "@/lib/runtime-config";

// Node networks are served by the API, which quantizes requests to grid
// cells cached in Redis so one Overpass fetch serves every user (ADR 0031).
// The local memory/localStorage cache stays as a per-browser L1.
const API_BASE_URL = getRuntimeConfig("VITE_API_URL") ?? "";
const NODE_NETWORK_URL = `${API_BASE_URL.replace(/\/+$/, "")}/api/v1/overlays/node-network`;
const CACHE_VERSION = 4;
const CACHE_PREFIX = `routess.node-network.v${CACHE_VERSION}:`;
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_MEMORY_CACHE_ENTRIES = 80;

export type NodeNetworkKind = "hiking" | "cycling";

export interface NodeNetworkBbox {
	south: number;
	west: number;
	north: number;
	east: number;
}

export type NodeFeatureProps = {
	kind: NodeNetworkKind;
	ref?: string;
	fromRef?: string;
	toRef?: string;
	name?: string;
};

export type NodeFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point | GeoJSON.LineString, NodeFeatureProps>;

type CacheEntry = {
	createdAt: number;
	data: NodeFeatureCollection;
};

const memoryCache = new Map<string, CacheEntry>();
const inFlightFetches = new Map<string, Promise<NodeFeatureCollection>>();

export function clearNodeNetworkCacheForTests(): void {
	memoryCache.clear();
	inFlightFetches.clear();
	if (typeof window === "undefined") return;

	try {
		for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
			const key = window.localStorage.key(index);
			if (key?.startsWith(CACHE_PREFIX)) {
				window.localStorage.removeItem(key);
			}
		}
	} catch (err) {
		Logger.debug("[OverpassNodesService] node-network cache clear skipped", err);
	}
}

function isCacheFresh(entry: CacheEntry, now = Date.now()): boolean {
	return now - entry.createdAt < CACHE_TTL_MS;
}

function rememberInMemory(key: string, entry: CacheEntry): void {
	memoryCache.delete(key);
	memoryCache.set(key, entry);

	while (memoryCache.size > MAX_MEMORY_CACHE_ENTRIES) {
		const oldestKey = memoryCache.keys().next().value;
		if (!oldestKey) break;
		memoryCache.delete(oldestKey);
	}
}

function readStorageCache(key: string): CacheEntry | null {
	if (typeof window === "undefined") return null;

	try {
		const raw = window.localStorage.getItem(`${CACHE_PREFIX}${key}`);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<CacheEntry>;
		if (
			typeof parsed.createdAt !== "number" ||
			!parsed.data ||
			parsed.data.type !== "FeatureCollection" ||
			!Array.isArray(parsed.data.features)
		) {
			return null;
		}
		return parsed as CacheEntry;
	} catch {
		return null;
	}
}

function writeStorageCache(key: string, entry: CacheEntry): void {
	if (typeof window === "undefined") return;

	try {
		window.localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
	} catch (err) {
		Logger.debug("[OverpassNodesService] node-network cache write skipped", err);
	}
}

function getCachedEntry(key: string): CacheEntry | null {
	const memoryEntry = memoryCache.get(key);
	if (memoryEntry) return memoryEntry;

	const storageEntry = readStorageCache(key);
	if (storageEntry) {
		rememberInMemory(key, storageEntry);
		return storageEntry;
	}

	return null;
}

function storeCachedEntry(key: string, data: NodeFeatureCollection): NodeFeatureCollection {
	const entry: CacheEntry = { createdAt: Date.now(), data };
	rememberInMemory(key, entry);
	writeStorageCache(key, entry);
	return data;
}

export async function fetchNodeNetwork(bbox: NodeNetworkBbox, signal?: AbortSignal): Promise<NodeFeatureCollection> {
	const cacheKey = bboxKey(bbox);
	const cached = getCachedEntry(cacheKey);
	if (cached) {
		if (!isCacheFresh(cached)) {
			void refreshNodeNetworkCache(cacheKey, bbox, signal).catch((err) => {
				if ((err as { name?: string }).name !== "AbortError") {
					Logger.warn("[OverpassNodesService] background refresh failed", err);
				}
			});
		}
		return cached.data;
	}

	return refreshNodeNetworkCache(cacheKey, bbox, signal);
}

async function refreshNodeNetworkCache(
	cacheKey: string,
	bbox: NodeNetworkBbox,
	signal?: AbortSignal,
): Promise<NodeFeatureCollection> {
	const existingFetch = inFlightFetches.get(cacheKey);
	if (existingFetch) return existingFetch;

	const fetchPromise = fetchNodeNetworkFromOverpass(bbox, signal)
		.then((collection) => storeCachedEntry(cacheKey, collection))
		.finally(() => {
			inFlightFetches.delete(cacheKey);
		});
	inFlightFetches.set(cacheKey, fetchPromise);
	return fetchPromise;
}

async function fetchNodeNetworkFromOverpass(
	bbox: NodeNetworkBbox,
	signal?: AbortSignal,
): Promise<NodeFeatureCollection> {
	const params = new URLSearchParams({
		south: String(bbox.south),
		west: String(bbox.west),
		north: String(bbox.north),
		east: String(bbox.east),
	});
	const response = await fetch(`${NODE_NETWORK_URL}?${params}`, { signal });
	if (!response.ok) {
		throw new Error(`node-network ${response.status}`);
	}
	const data = (await response.json()) as NodeFeatureCollection;
	if (data?.type !== "FeatureCollection" || !Array.isArray(data.features)) {
		throw new Error("node-network returned an unexpected payload");
	}
	return data;
}

export const NODE_OVERLAY_MIN_ZOOM = 9;
// Aligned with the API's grid-cell cap (ADR 0031): the proxy serves up to 36
// cells of 0.1deg, i.e. ~0.6deg per axis. Requesting a larger viewport would
// just 400, so the client waits for zoom-in (the overlay is styled from
// zoom 11 anyway) instead of firing a doomed fetch.
export const NODE_OVERLAY_MAX_BBOX_DEG = 0.6;

export function bboxArea(bbox: NodeNetworkBbox): number {
	return Math.max(0, bbox.north - bbox.south) * Math.max(0, bbox.east - bbox.west);
}

export function bboxKey(bbox: NodeNetworkBbox): string {
	const r = (n: number) => Math.round(n * 100) / 100;
	return `${r(bbox.south)},${r(bbox.west)},${r(bbox.north)},${r(bbox.east)}`;
}
