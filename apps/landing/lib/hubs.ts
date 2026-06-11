import { REGIONAL_HUB_MIN_INDEXABLE_ROUTES } from "@routess/core";
import type { Locale } from "@/lib/i18n";

// Activities with a RegionalHub surface. Adding one means a prefix pair here,
// a dict entry under hub.activities, and a pair of page directories.
export const HUB_ACTIVITIES = ["cycle"] as const;
export type HubActivity = (typeof HUB_ACTIVITIES)[number];

// Keyword-in-URL localized per ccTLD (docs/agents/seo.md): the segment is the
// host language's search term; the place slug stays the local place name.
export const HUB_PATH_PREFIXES: Record<HubActivity, Record<Locale, string>> = {
	cycle: { en: "cycling-routes", nl: "fietsroutes" },
};

export function hubPath(activity: HubActivity, slug: string, locale: Locale): string {
	return `/${HUB_PATH_PREFIXES[activity][locale]}/${slug}`;
}

// Thin-content rule (CONTEXT.md "RegionalHub"): below the threshold the hub
// page must 404 and stay out of sitemaps. The API applies the same gate; this
// re-check keeps a stale cache from serving a dead hub.
export function isLiveHub(indexableCount: number): boolean {
	return indexableCount >= REGIONAL_HUB_MIN_INDEXABLE_ROUTES;
}
