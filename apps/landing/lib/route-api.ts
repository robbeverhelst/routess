import type { RouteVisibility } from "@routess/core";

// Server-side base (in-cluster service URL via Helm); the browser-facing API
// host for hrefs rendered into HTML is PUBLIC_API_URL.
const API_URL = process.env.API_URL ?? "https://api.routess.com";
export const PUBLIC_API_URL = process.env.PUBLIC_API_URL ?? "https://api.routess.com";

export interface PublicRoute {
	id: number;
	name: string;
	description?: string;
	activity?: "run" | "cycle" | "walk";
	visibility: RouteVisibility;
	tags: string[];
	waypoints: Array<{ coord: [number, number] }>;
	geometry?: [number, number][];
	distance?: number;
	duration?: number;
	elevationGain?: number;
	updatedAt: string;
	// Unguessable handle for share links; unlisted routes are only reachable
	// anonymously via this token (numeric ids are public-only).
	shareToken: string;
	user?: { name: string; handle: string };
}

export interface PublicRouteSummary {
	id: number;
	name: string;
	distance?: number;
	updatedAt: string;
	// Canonical public-page slug: '{slug}-{id}' for user Routes, '{slug}-x{id}'
	// for ExternalRoutes (ADR 0025 amendment).
	slugId: string;
}

// `ref` is a numeric route id (public routes) or a 32-hex share token (unlisted).
// Revalidate within the VisibilityPropagation bound (CONTEXT.md, ADR 0032):
// a route flipped back to private must drop off the public page within 60s.
export async function fetchPublicRoute(ref: number | string): Promise<PublicRoute | null> {
	const res = await fetch(`${API_URL}/api/v1/routes/${encodeURIComponent(String(ref))}`, { next: { revalidate: 60 } });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Route fetch failed with ${res.status}`);
	return (await res.json()) as PublicRoute;
}

export interface PublicExternalRoute {
	id: number;
	slugId: string;
	name: string;
	description?: string;
	activity?: "run" | "cycle" | "walk";
	tags: string[];
	geometry: [number, number][];
	distance?: number;
	duration?: number;
	elevationGain?: number;
	source: { key: string; name: string; license: string; attribution: string; url: string };
	kind: "external";
	updatedAt: string;
}

// ExternalRoutes are immutable between weekly seed refreshes (ADR 0035), so a
// longer revalidation window than user routes is safe.
export async function fetchExternalRoute(externalId: number): Promise<PublicExternalRoute | null> {
	const res = await fetch(`${API_URL}/api/v1/external-routes/${externalId}`, { next: { revalidate: 3600 } });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`External route fetch failed with ${res.status}`);
	return (await res.json()) as PublicExternalRoute;
}

// Full Indexable corpus for the sitemap, paged through X-Total-Count.
// Every page is cached for an hour, so a crawl costs the API one pass per hour
// per replica rather than one per request.
//
// Fails loudly instead of returning what it managed to collect: a short sitemap
// tells search engines the missing routes are gone, which is far worse than a
// 5xx they will simply retry (docs/agents/seo.md).
const SITEMAP_PAGE_LIMIT = 200;
// Ceiling so a mis-reported X-Total-Count can never spin. Far above the real
// corpus; reaching it is a bug, not a big sitemap.
const SITEMAP_MAX_PAGES = 500;

export async function fetchIndexablePublicRoutes(): Promise<PublicRouteSummary[]> {
	const out: PublicRouteSummary[] = [];
	for (let page = 0; page < SITEMAP_MAX_PAGES; page++) {
		const offset = page * SITEMAP_PAGE_LIMIT;
		const res = await fetch(`${API_URL}/api/v1/routes/public?limit=${SITEMAP_PAGE_LIMIT}&offset=${offset}`, {
			next: { revalidate: 3600 },
		});
		if (!res.ok) {
			throw new Error(`Indexable route page at offset ${offset} failed with ${res.status}`);
		}
		const items = (await res.json()) as PublicRouteSummary[];
		out.push(...items);
		const total = Number(res.headers.get("x-total-count") ?? out.length);
		if (items.length === 0 || out.length >= total) return out;
	}
	throw new Error(`Indexable route sitemap exceeded ${SITEMAP_MAX_PAGES} pages; refusing to serve a truncated sitemap`);
}
