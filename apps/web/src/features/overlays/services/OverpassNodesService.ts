import { Logger } from "@/lib/logger";

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const OVERPASS_FALLBACK = "https://overpass.kumi.systems/api/interpreter";
const CACHE_VERSION = 3;
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

interface OverpassNodeElement {
	type: "node";
	id: number;
	lat: number;
	lon: number;
	tags?: Record<string, string>;
}

interface OverpassWayElement {
	type: "way";
	id: number;
	geometry?: { lat: number; lon: number }[];
	tags?: Record<string, string>;
}

interface OverpassRelationElement {
	type: "relation";
	id: number;
	members?: {
		type: string;
		ref: number;
		role?: string;
		geometry?: { lat: number; lon: number }[];
	}[];
	tags?: Record<string, string>;
}

interface OverpassResponse {
	elements: (OverpassNodeElement | OverpassWayElement | OverpassRelationElement)[];
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

function classify(network: string | undefined): NodeNetworkKind | null {
	if (!network) return null;
	if (network === "rwn" || network === "lwn") return "hiking";
	if (network === "rcn" || network === "lcn") return "cycling";
	return null;
}

function classifyNode(tags: Record<string, string>): NodeNetworkKind | null {
	if (tags.rwn_ref || tags.lwn_ref) return "hiking";
	if (tags.rcn_ref || tags.lcn_ref) return "cycling";
	return classify(tags.network);
}

function pickRef(tags: Record<string, string>): string | undefined {
	return tags.rwn_ref ?? tags.lwn_ref ?? tags.rcn_ref ?? tags.lcn_ref ?? tags.ref;
}

function parseConnectionRef(ref: string | undefined): Pick<NodeFeatureProps, "fromRef" | "toRef"> {
	if (!ref) return {};
	const parts = ref
		.split(/[-–—>/]/)
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.length < 2) return {};
	return { fromRef: parts[0], toRef: parts[parts.length - 1] };
}

function buildQuery(bbox: NodeNetworkBbox): string {
	const { south, west, north, east } = bbox;
	const bboxStr = `${south},${west},${north},${east}`;
	return `[out:json][timeout:30];
(
  node["rwn_ref"](${bboxStr});
  node["lwn_ref"](${bboxStr});
  node["rcn_ref"](${bboxStr});
  node["lcn_ref"](${bboxStr});
  node["network:type"="node_network"]["ref"](${bboxStr});
  relation["type"="route"]["network:type"="node_network"]["network"~"^[lr][wc]n$"](${bboxStr});
);
out geom;`;
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

async function postOverpass(
	query: string,
	signal: AbortSignal | undefined,
	endpoint: string,
): Promise<OverpassResponse> {
	const response = await fetch(endpoint, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: `data=${encodeURIComponent(query)}`,
		signal,
	});
	if (!response.ok) {
		throw new Error(`Overpass ${response.status}`);
	}
	return (await response.json()) as OverpassResponse;
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
	const query = buildQuery(bbox);
	let data: OverpassResponse;
	try {
		data = await postOverpass(query, signal, OVERPASS_ENDPOINT);
	} catch (err) {
		if ((err as { name?: string }).name === "AbortError") throw err;
		Logger.warn("[OverpassNodesService] primary endpoint failed, falling back", err);
		data = await postOverpass(query, signal, OVERPASS_FALLBACK);
	}

	const features: GeoJSON.Feature<GeoJSON.Point | GeoJSON.LineString, NodeFeatureProps>[] = [];

	for (const el of data.elements) {
		if (el.type === "node") {
			const tags = el.tags ?? {};
			const kind = classifyNode(tags);
			if (!kind) continue;
			const ref = pickRef(tags);
			if (!ref) continue;
			features.push({
				type: "Feature",
				id: `n${el.id}`,
				geometry: { type: "Point", coordinates: [el.lon, el.lat] },
				properties: { kind, ref, name: tags.name },
			});
		} else if (el.type === "way") {
			const tags = el.tags ?? {};
			const kind = classify(tags.network);
			if (!kind) continue;
			if (!el.geometry || el.geometry.length < 2) continue;
			features.push({
				type: "Feature",
				id: `w${el.id}`,
				geometry: {
					type: "LineString",
					coordinates: el.geometry.map((p) => [p.lon, p.lat]),
				},
				properties: { kind, name: tags.name },
			});
		} else if (el.type === "relation") {
			const tags = el.tags ?? {};
			const kind = classify(tags.network);
			if (!kind) continue;

			for (const [index, member] of (el.members ?? []).entries()) {
				if (member.type !== "way" || !member.geometry || member.geometry.length < 2) continue;
				features.push({
					type: "Feature",
					id: `r${el.id}-w${member.ref}-${index}`,
					geometry: {
						type: "LineString",
						coordinates: member.geometry.map((p) => [p.lon, p.lat]),
					},
					properties: { kind, ref: tags.ref, ...parseConnectionRef(tags.ref), name: tags.name },
				});
			}
		}
	}

	return { type: "FeatureCollection", features };
}

export const NODE_OVERLAY_MIN_ZOOM = 9;
export const NODE_OVERLAY_MAX_BBOX_DEG = 1.5;

export function bboxArea(bbox: NodeNetworkBbox): number {
	return Math.max(0, bbox.north - bbox.south) * Math.max(0, bbox.east - bbox.west);
}

export function bboxKey(bbox: NodeNetworkBbox): string {
	const r = (n: number) => Math.round(n * 100) / 100;
	return `${r(bbox.south)},${r(bbox.west)},${r(bbox.north)},${r(bbox.east)}`;
}
