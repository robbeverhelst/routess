import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { apiSource, docsSource, guideSource } from "@/lib/source";

// Read DOCS_PUBLIC_URL at request time so self-hosted deployments get
// correct absolute URLs without rebuilding the image.
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
	const urls = new Set<string>(["/"]);

	for (const page of guideSource.getPages()) urls.add(page.url);
	for (const language of guideSource._i18n?.languages ?? []) {
		for (const page of guideSource.getPages(language)) urls.add(page.url);
	}
	for (const page of docsSource.getPages()) urls.add(page.url);
	for (const page of apiSource.getPages()) urls.add(page.url);

	return [...urls].map((url) => ({ url: url === "/" ? SITE_URL : `${SITE_URL}${url}` }));
}
