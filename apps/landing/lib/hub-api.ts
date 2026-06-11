import type { HubActivity } from "@/lib/hubs";

const API_URL = process.env.API_URL ?? "https://api.routess.com";

export interface RegionalHub {
	slug: string;
	city: string;
	region?: string;
	countryCode?: string;
	activity: HubActivity;
	indexableCount: number;
	lastModified: string;
}

export interface HubRouteSummary {
	id: number;
	name: string;
	distance?: number;
	elevationGain?: number;
	updatedAt: string;
	slugId: string;
	tags?: string[];
	source?: { key: string; name: string; attribution: string };
	user?: { name: string; handle: string };
}

// Places clearing the RegionalHub threshold (the API applies the gate). One
// fetch serves the hub pages and the hub sitemap segment via Next's cache.
export async function fetchHubs(activity: HubActivity): Promise<RegionalHub[]> {
	const res = await fetch(`${API_URL}/api/v1/places/hubs?activity=${activity}`, { next: { revalidate: 300 } });
	if (!res.ok) return [];
	return (await res.json()) as RegionalHub[];
}

export async function fetchHub(activity: HubActivity, slug: string): Promise<RegionalHub | null> {
	const hubs = await fetchHubs(activity);
	return hubs.find((hub) => hub.slug === slug) ?? null;
}

// The hub's Indexable Routes: Route + ExternalRoute, unioned by the API at
// read time (ADR 0035), each carrying its canonical slugId.
export async function fetchHubRoutes(city: string, activity: HubActivity): Promise<HubRouteSummary[]> {
	const query = new URLSearchParams({ gate: "indexable", activity, placeCity: city, limit: "100" });
	const res = await fetch(`${API_URL}/api/v1/routes/public?${query.toString()}`, { next: { revalidate: 300 } });
	if (!res.ok) return [];
	return (await res.json()) as HubRouteSummary[];
}
