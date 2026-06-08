// Server-side profile fetches for the /u/{handle} pages and the sitemap.
// Mirrors lib/route-api.ts conventions.
const API_URL = process.env.API_URL ?? "https://api.routess.com";

export interface PublicProfileRoute {
	id: number;
	// Canonical /r/{slugId} path segment, server-computed.
	slugId: string;
	name: string;
	activity?: "run" | "cycle" | "walk" | null;
	distance?: number | null;
	elevationGain?: number | null;
	publishedAt?: string | null;
	tags: string[];
}

export interface PublicProfile {
	handle: string;
	name: string;
	avatar?: string | null;
	stats: {
		publicRoutes: number;
		totalDistance: number;
		totalElevationGain: number;
		followers: number;
		following: number;
	};
	isIndexable: boolean;
	routes: PublicProfileRoute[];
}

// Revalidate within the VisibilityPropagation bound (CONTEXT.md, ADR 0032):
// a Route flipped back to private must drop off the profile page within 60s.
export async function fetchPublicProfile(handle: string): Promise<PublicProfile | null> {
	const res = await fetch(`${API_URL}/api/v1/profiles/${encodeURIComponent(handle)}`, { next: { revalidate: 60 } });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`Profile fetch failed with ${res.status}`);
	return (await res.json()) as PublicProfile;
}

export interface IndexableProfile {
	handle: string;
	updatedAt: string;
}

// Indexable Profiles for the sitemap (the API applies the >= 3 Indexable
// routes gate).
export async function fetchIndexableProfiles(): Promise<IndexableProfile[]> {
	const res = await fetch(`${API_URL}/api/v1/profiles`, { next: { revalidate: 3600 } });
	if (!res.ok) return [];
	return (await res.json()) as IndexableProfile[];
}
