import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Read DOCS_PUBLIC_URL at request time so self-hosted deployments get
// correct absolute URLs without rebuilding the image.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: "*", allow: "/" },
		sitemap: `${SITE_URL}/sitemap.xml`,
	};
}
