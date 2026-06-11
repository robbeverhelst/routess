import { headers } from "next/headers";
import { localeFromHost, SELF_HOST } from "@/lib/i18n";
import { fetchIndexablePublicRoutes } from "@/lib/route-api";
import { localizedAlternates, type SitemapUrl, urlsetXml, xmlResponse } from "@/lib/sitemap-xml";

// Indexable public route pages (the API applies the gate). The slugId from
// the API is canonical for both kinds: '{slug}-{id}' user Routes and
// '{slug}-x{id}' ExternalRoutes (ADR 0025 amendment, ADR 0035).
export async function GET() {
	const h = await headers();
	const locale = localeFromHost(h.get("host"));
	const base = `https://${SELF_HOST[locale]}`;

	const entries: SitemapUrl[] = (await fetchIndexablePublicRoutes()).map((route) => {
		const path = `/r/${route.slugId}`;
		return {
			loc: `${base}${path}`,
			lastModified: route.updatedAt,
			changeFrequency: "monthly",
			priority: 0.7,
			alternates: localizedAlternates(path, path),
		};
	});

	return xmlResponse(urlsetXml(entries));
}
