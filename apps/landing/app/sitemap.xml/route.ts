import { headers } from "next/headers";
import { localeFromHost, SELF_HOST } from "@/lib/i18n";
import { SITEMAP_SEGMENTS, sitemapIndexXml, xmlResponse } from "@/lib/sitemap-xml";

// The sitemap index (docs/agents/seo.md): one segment per page type, per host.
// /sitemap.xml stays the URL submitted in Search Console.
export async function GET() {
	const h = await headers();
	const base = `https://${SELF_HOST[localeFromHost(h.get("host"))]}`;
	return xmlResponse(sitemapIndexXml(SITEMAP_SEGMENTS.map((segment) => `${base}/sitemaps/${segment}.xml`)));
}
