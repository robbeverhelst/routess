import { headers } from "next/headers";
import { fetchHubs } from "@/lib/hub-api";
import { HUB_ACTIVITIES, hubPath } from "@/lib/hubs";
import { localeFromHost, SELF_HOST } from "@/lib/i18n";
import { localizedAlternates, type SitemapUrl, urlsetXml, xmlResponse } from "@/lib/sitemap-xml";

// RegionalHub pages (#236). Only live hubs: the API returns places clearing
// the 5-route threshold, so a hub below it never enters a sitemap.
export async function GET() {
	const h = await headers();
	const locale = localeFromHost(h.get("host"));
	const base = `https://${SELF_HOST[locale]}`;

	const entries: SitemapUrl[] = [];
	for (const activity of HUB_ACTIVITIES) {
		for (const hub of await fetchHubs(activity)) {
			entries.push({
				loc: `${base}${hubPath(activity, hub.slug, locale)}`,
				lastModified: hub.lastModified,
				changeFrequency: "weekly",
				priority: 0.7,
				alternates: localizedAlternates(hubPath(activity, hub.slug, "en"), hubPath(activity, hub.slug, "nl")),
			});
		}
	}

	return xmlResponse(urlsetXml(entries));
}
