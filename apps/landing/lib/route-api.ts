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
}

export interface PublicRouteSummary {
	id: number;
	name: string;
	distance?: number;
	updatedAt: string;
}

export async function fetchPublicRoute(id: number): Promise<PublicRoute | null> {
	const res = await fetch(`${API_URL}/api/v1/routes/${id}`, { next: { revalidate: 300 } });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Route fetch failed with ${res.status}`);
	return (await res.json()) as PublicRoute;
}

// Full Indexable corpus for the sitemap, paged through X-Total-Count.
export async function fetchIndexablePublicRoutes(): Promise<PublicRouteSummary[]> {
	const out: PublicRouteSummary[] = [];
	const limit = 200;
	for (let offset = 0; ; offset += limit) {
		const res = await fetch(`${API_URL}/api/v1/routes/public?limit=${limit}&offset=${offset}`, {
			next: { revalidate: 3600 },
		});
		if (!res.ok) return out;
		const items = (await res.json()) as PublicRouteSummary[];
		out.push(...items);
		const total = Number(res.headers.get("x-total-count") ?? out.length);
		if (items.length === 0 || out.length >= total) return out;
	}
}
