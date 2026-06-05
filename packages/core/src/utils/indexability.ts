import type { RouteVisibility } from "../types";

export const INDEXABLE_MIN_DISTANCE_METERS = 1000;

export interface RouteIndexabilityInput {
	visibility: RouteVisibility;
	name: string;
	distance?: number | null;
	description?: string | null;
	tags?: readonly string[] | null;
}

/**
 * Whether a Route clears the quality gate for search indexing (sitemap +
 * index,follow). Public-but-below-the-bar routes still render with noindex;
 * unlisted/private are never indexable. The gate may loosen over time but
 * must not tighten after launch (see docs/agents/seo.md).
 */
export function isRouteIndexable(route: RouteIndexabilityInput): boolean {
	if (route.visibility !== "public") return false;
	const name = route.name.trim();
	if (name.length < 3 || /^untitled/i.test(name) || /^naamloos/i.test(name)) return false;
	if ((route.distance ?? 0) < INDEXABLE_MIN_DISTANCE_METERS) return false;
	const hasDescription = (route.description ?? "").trim().length >= 20;
	const hasTags = (route.tags ?? []).length > 0;
	return hasDescription || hasTags;
}
