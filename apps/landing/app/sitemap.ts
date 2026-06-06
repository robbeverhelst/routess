import { buildRouteSlugId } from "@routess/core";
import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { ARTICLES, articlePath, SECTION_PATHS } from "@/lib/articles";
import type { ArticleSection } from "@/lib/articles/types";
import { HTML_LANG, localeFromHost, SELF_HOST } from "@/lib/i18n";
import { fetchIndexableProfiles } from "@/lib/profile-api";
import { fetchIndexablePublicRoutes } from "@/lib/route-api";

const LAST_MODIFIED = "2026-06-02";

const alternates = (path: string) => ({
	languages: {
		[HTML_LANG.en]: `https://${SELF_HOST.en}${path}`,
		[HTML_LANG.nl]: `https://${SELF_HOST.nl}${path}`,
	},
});

const localizedAlternates = (enPath: string, nlPath: string) => ({
	languages: {
		[HTML_LANG.en]: `https://${SELF_HOST.en}${enPath}`,
		[HTML_LANG.nl]: `https://${SELF_HOST.nl}${nlPath}`,
	},
});

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const h = await headers();
	const locale = localeFromHost(h.get("host"));
	const base = `https://${SELF_HOST[locale]}`;

	const sectionEntries = (Object.keys(SECTION_PATHS) as ArticleSection[]).map((section) => ({
		url: `${base}/${SECTION_PATHS[section][locale]}`,
		lastModified: LAST_MODIFIED,
		changeFrequency: "weekly" as const,
		priority: 0.6,
		alternates: localizedAlternates(`/${SECTION_PATHS[section].en}`, `/${SECTION_PATHS[section].nl}`),
	}));

	// Only Indexable public Routes (the API endpoint applies the gate).
	const routeEntries = (await fetchIndexablePublicRoutes()).map((route) => {
		const path = `/r/${buildRouteSlugId(route.name, route.id)}`;
		return {
			url: `${base}${path}`,
			lastModified: route.updatedAt,
			changeFrequency: "monthly" as const,
			priority: 0.7,
			alternates: localizedAlternates(path, path),
		};
	});

	// Indexable Profiles (>= 3 Indexable routes; the API applies the gate).
	const profileEntries = (await fetchIndexableProfiles()).map((profile) => {
		const path = `/u/${profile.handle}`;
		return {
			url: `${base}${path}`,
			lastModified: profile.updatedAt,
			changeFrequency: "monthly" as const,
			priority: 0.5,
			alternates: localizedAlternates(path, path),
		};
	});

	const articleEntries = ARTICLES.map((article) => ({
		url: `${base}${articlePath(article, locale)}`,
		lastModified: article.dateModified,
		changeFrequency: "monthly" as const,
		priority: 0.8,
		alternates: localizedAlternates(articlePath(article, "en"), articlePath(article, "nl")),
	}));

	return [
		{
			url: `${base}/`,
			lastModified: LAST_MODIFIED,
			changeFrequency: "weekly",
			priority: 1,
			alternates: alternates("/"),
		},
		{
			url: `${base}/developers`,
			lastModified: LAST_MODIFIED,
			changeFrequency: "monthly",
			priority: 0.7,
			alternates: alternates("/developers"),
		},
		{
			url: `${base}/privacy`,
			lastModified: LAST_MODIFIED,
			changeFrequency: "yearly",
			priority: 0.3,
			alternates: alternates("/privacy"),
		},
		...sectionEntries,
		...articleEntries,
		...routeEntries,
		...profileEntries,
	];
}
