import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { HTML_LANG, localeFromHost, SELF_HOST } from "@/lib/i18n";

const LAST_MODIFIED = "2026-06-02";

const alternates = (path: string) => ({
	languages: {
		[HTML_LANG.en]: `https://${SELF_HOST.en}${path}`,
		[HTML_LANG.nl]: `https://${SELF_HOST.nl}${path}`,
	},
});

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const h = await headers();
	const locale = localeFromHost(h.get("host"));
	const base = `https://${SELF_HOST[locale]}`;
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
	];
}
