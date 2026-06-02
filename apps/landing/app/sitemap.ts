import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { localeFromHost, SELF_HOST } from "@/lib/i18n";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const h = await headers();
	const locale = localeFromHost(h.get("host"));
	const base = `https://${SELF_HOST[locale]}`;
	return [
		{ url: `${base}/`, changeFrequency: "weekly", priority: 1 },
		{ url: `${base}/developers`, changeFrequency: "monthly", priority: 0.7 },
	];
}
