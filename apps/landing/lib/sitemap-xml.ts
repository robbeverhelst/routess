import { HTML_LANG, SELF_HOST } from "@/lib/i18n";

// Segmented sitemap index per page type (docs/agents/seo.md): /sitemap.xml is
// the index, each segment below lives at /sitemaps/{segment}.xml. Hand-rolled
// XML because Next's metadata sitemap supports neither an index nor segments.
export const SITEMAP_SEGMENTS = ["pages", "routes", "profiles", "hubs"] as const;

export interface SitemapAlternate {
	hreflang: string;
	href: string;
}

export interface SitemapUrl {
	loc: string;
	lastModified?: string;
	changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
	priority?: number;
	alternates?: SitemapAlternate[];
}

export function xmlEscape(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

export function localizedAlternates(enPath: string, nlPath: string): SitemapAlternate[] {
	return [
		{ hreflang: HTML_LANG.en, href: `https://${SELF_HOST.en}${enPath}` },
		{ hreflang: HTML_LANG.nl, href: `https://${SELF_HOST.nl}${nlPath}` },
	];
}

export function urlsetXml(urls: SitemapUrl[]): string {
	const body = urls
		.map((url) => {
			const parts = [`<loc>${xmlEscape(url.loc)}</loc>`];
			for (const alt of url.alternates ?? []) {
				parts.push(`<xhtml:link rel="alternate" hreflang="${xmlEscape(alt.hreflang)}" href="${xmlEscape(alt.href)}"/>`);
			}
			if (url.lastModified) parts.push(`<lastmod>${xmlEscape(url.lastModified)}</lastmod>`);
			if (url.changeFrequency) parts.push(`<changefreq>${url.changeFrequency}</changefreq>`);
			if (url.priority !== undefined) parts.push(`<priority>${url.priority}</priority>`);
			return `<url>${parts.join("")}</url>`;
		})
		.join("");
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${body}</urlset>`;
}

export function sitemapIndexXml(locs: string[]): string {
	const body = locs.map((loc) => `<sitemap><loc>${xmlEscape(loc)}</loc></sitemap>`).join("");
	return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}

export function xmlResponse(xml: string): Response {
	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
