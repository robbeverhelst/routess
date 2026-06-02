import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { localeFromHost, SELF_HOST } from "@/lib/i18n";

export default async function robots(): Promise<MetadataRoute.Robots> {
	const h = await headers();
	const locale = localeFromHost(h.get("host"));
	const base = `https://${SELF_HOST[locale]}`;
	return {
		rules: [{ userAgent: "*", allow: "/", disallow: ["/screenshot"] }],
		sitemap: `${base}/sitemap.xml`,
		host: base,
	};
}
