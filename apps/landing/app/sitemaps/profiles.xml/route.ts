import { headers } from "next/headers";
import { localeFromHost, SELF_HOST } from "@/lib/i18n";
import { fetchIndexableProfiles } from "@/lib/profile-api";
import { localizedAlternates, type SitemapUrl, urlsetXml, xmlResponse } from "@/lib/sitemap-xml";

// Indexable Profiles (>= 3 Indexable routes; the API applies the gate).
export async function GET() {
	const h = await headers();
	const locale = localeFromHost(h.get("host"));
	const base = `https://${SELF_HOST[locale]}`;

	const entries: SitemapUrl[] = (await fetchIndexableProfiles()).map((profile) => {
		const path = `/u/${profile.handle}`;
		return {
			loc: `${base}${path}`,
			lastModified: profile.updatedAt,
			changeFrequency: "monthly",
			priority: 0.5,
			alternates: localizedAlternates(path, path),
		};
	});

	return xmlResponse(urlsetXml(entries));
}
