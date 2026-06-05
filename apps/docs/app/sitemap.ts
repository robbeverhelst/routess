import type { MetadataRoute } from "next";
import { i18n } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";
import { apiSource, docsSource, guideSource } from "@/lib/source";

// Read DOCS_PUBLIC_URL at request time so self-hosted deployments get
// correct absolute URLs without rebuilding the image.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
	const urls = new Set<string>();

	for (const language of i18n.languages) {
		urls.add(`/${language}`);
		for (const source of [guideSource, docsSource, apiSource]) {
			for (const page of source.getPages(language)) urls.add(page.url);
		}
	}

	return [...urls].map((url) => ({ url: `${SITE_URL}${url}` }));
}
