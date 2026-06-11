import { headers } from "next/headers";
import { ARTICLES, articlePath, SECTION_PATHS } from "@/lib/articles";
import type { ArticleSection } from "@/lib/articles/types";
import { localeFromHost, SELF_HOST } from "@/lib/i18n";
import { localizedAlternates, type SitemapUrl, urlsetXml, xmlResponse } from "@/lib/sitemap-xml";

const LAST_MODIFIED = "2026-06-02";

// Static pages, article sections, and articles.
export async function GET() {
	const h = await headers();
	const locale = localeFromHost(h.get("host"));
	const base = `https://${SELF_HOST[locale]}`;

	const staticEntries: SitemapUrl[] = [
		{
			loc: `${base}/`,
			lastModified: LAST_MODIFIED,
			changeFrequency: "weekly",
			priority: 1,
			alternates: localizedAlternates("/", "/"),
		},
		{
			loc: `${base}/developers`,
			lastModified: LAST_MODIFIED,
			changeFrequency: "monthly",
			priority: 0.7,
			alternates: localizedAlternates("/developers", "/developers"),
		},
		{
			loc: `${base}/privacy`,
			lastModified: LAST_MODIFIED,
			changeFrequency: "yearly",
			priority: 0.3,
			alternates: localizedAlternates("/privacy", "/privacy"),
		},
	];

	const sectionEntries: SitemapUrl[] = (Object.keys(SECTION_PATHS) as ArticleSection[]).map((section) => ({
		loc: `${base}/${SECTION_PATHS[section][locale]}`,
		lastModified: LAST_MODIFIED,
		changeFrequency: "weekly",
		priority: 0.6,
		alternates: localizedAlternates(`/${SECTION_PATHS[section].en}`, `/${SECTION_PATHS[section].nl}`),
	}));

	const articleEntries: SitemapUrl[] = ARTICLES.map((article) => ({
		loc: `${base}${articlePath(article, locale)}`,
		lastModified: article.dateModified,
		changeFrequency: "monthly",
		priority: 0.8,
		alternates: localizedAlternates(articlePath(article, "en"), articlePath(article, "nl")),
	}));

	return xmlResponse(urlsetXml([...staticEntries, ...sectionEntries, ...articleEntries]));
}
