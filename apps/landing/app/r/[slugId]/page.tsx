import { buildRouteSlugId, formatDistance, formatDuration, isRouteIndexable, parseRouteSlugId } from "@routess/core";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Script from "next/script";
import { type Dict, getDict } from "@/lib/content";
import { APP_HOST, HTML_LANG, type Locale, SELF_HOST, SISTER_HOST } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { fetchPublicRoute, PUBLIC_API_URL, type PublicRoute } from "@/lib/route-api";
import { Footer } from "../../components/Footer";
import { Nav } from "../../components/Nav";

interface Params {
	slugId: string;
}

async function resolveRoute(slugId: string): Promise<{ route: PublicRoute; canonicalSlugId: string } | null> {
	const parsed = parseRouteSlugId(slugId);
	if (!parsed) return null;
	const route = await fetchPublicRoute(parsed.id ?? parsed.token);
	if (!route) return null;
	// Public routes get the canonical id URL; unlisted keep the unguessable
	// token so the link cannot be derived from the sequential id.
	const canonicalRef = route.visibility === "public" ? route.id : route.shareToken;
	return { route, canonicalSlugId: buildRouteSlugId(route.name, canonicalRef) };
}

function summary(dict: Dict, route: PublicRoute): string {
	const description = route.description?.trim();
	if (description) return description;
	const activity = dict.routePage.activities[route.activity ?? "route"] ?? dict.routePage.activities.route;
	return dict.routePage.summaryTemplate
		.replace("{distance}", formatDistance((route.distance ?? 0) / 1000))
		.replace("{activity}", activity)
		.replace("{elevation}", String(Math.round(route.elevationGain ?? 0)));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
	const { slugId } = await params;
	const resolved = await resolveRoute(slugId);
	if (!resolved) return {};
	const { route, canonicalSlugId } = resolved;
	const locale = await getLocale();
	const dict = getDict(locale);
	const sisterLocale: Locale = locale === "en" ? "nl" : "en";
	const path = `/r/${canonicalSlugId}`;
	const url = `https://${SELF_HOST[locale]}${path}`;
	const description = summary(dict, route);
	const indexable = isRouteIndexable(route);
	return {
		title: route.name,
		description,
		...(indexable ? {} : { robots: { index: false, follow: false } }),
		alternates: {
			canonical: url,
			languages: {
				[HTML_LANG[locale]]: url,
				[HTML_LANG[sisterLocale]]: `https://${SISTER_HOST[locale]}${path}`,
				"x-default": `https://routess.com${path}`,
			},
		},
		openGraph: {
			type: "website",
			url,
			siteName: "routess",
			title: route.name,
			description,
			images: [{ url: `${url}/og.png`, width: 1200, height: 630 }],
		},
		twitter: { card: "summary_large_image", title: route.name, description },
	};
}

function jsonLd(route: PublicRoute, canonicalSlugId: string, locale: Locale) {
	const base = `https://${SELF_HOST[locale]}`;
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{ "@type": "ListItem", position: 1, name: "routess", item: `${base}/` },
			{ "@type": "ListItem", position: 2, name: route.name, item: `${base}/r/${canonicalSlugId}` },
		],
	};
}

export default async function PublicRoutePage({ params }: { params: Promise<Params> }) {
	const { slugId } = await params;
	const resolved = await resolveRoute(slugId);
	if (!resolved) notFound();
	const { route, canonicalSlugId } = resolved;
	if (slugId !== canonicalSlugId) permanentRedirect(`/r/${canonicalSlugId}`);
	const locale = await getLocale();
	const dict = getDict(locale);
	const copy = dict.routePage;
	const stats: Array<{ label: string; value: string }> = [];
	if (route.distance) {
		stats.push({ label: copy.stats.distance, value: formatDistance(route.distance / 1000) });
	}
	if (route.elevationGain) {
		stats.push({ label: copy.stats.elevation, value: `${Math.round(route.elevationGain)} m` });
	}
	if (route.duration) {
		stats.push({ label: copy.stats.duration, value: formatDuration(route.duration / 60) });
	}
	const description = route.description?.trim();
	return (
		<>
			<Nav dict={dict} locale={locale} />
			<main>
				<section className="topo-bg" style={{ padding: "60px 0 80px" }}>
					<div className="container-x">
						<div style={{ maxWidth: 860 }}>
							<p className="eyebrow" style={{ marginBottom: 8 }}>
								{copy.eyebrow}
							</p>
							<h1 className="display" style={{ fontSize: "clamp(34px, 4.5vw, 56px)", margin: "0 0 18px" }}>
								{route.name}
							</h1>
							<div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
								{stats.map((stat) => (
									<span key={stat.label} className="chip">
										<span className="eyebrow" style={{ fontSize: 11 }}>
											{stat.label}
										</span>
										<strong>{stat.value}</strong>
									</span>
								))}
								{route.tags.map((tag) => (
									<span key={tag} className="chip mono" style={{ fontSize: 13 }}>
										#{tag}
									</span>
								))}
							</div>
							{/* Served by our own og.png proxy: crawler-safe (no Referer needed) and cached. */}
							{/* biome-ignore lint/performance/noImgElement: proxied remote image, next/image adds nothing here */}
							<img
								src={`/r/${canonicalSlugId}/og.png`}
								alt={copy.mapAlt}
								width={1200}
								height={630}
								style={{ width: "100%", height: "auto", borderRadius: 16, border: "1px solid var(--line)" }}
							/>
							{description ? (
								<>
									<h2 className="display" style={{ fontSize: 24, margin: "32px 0 8px" }}>
										{copy.about}
									</h2>
									<p className="body-lg">{description}</p>
								</>
							) : null}
							<div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
								<a className="btn btn-primary" href={`https://${APP_HOST}/r/${canonicalSlugId}`}>
									{copy.openInApp}
								</a>
								<a className="btn btn-ghost" href={`${PUBLIC_API_URL}/api/v1/routes/${route.id}/gpx`}>
									{copy.downloadGpx}
								</a>
								<a className="btn btn-ghost" href={`https://${APP_HOST}`}>
									{copy.planYourOwn}
								</a>
							</div>
						</div>
					</div>
				</section>
			</main>
			<Footer dict={dict} />
			<Script
				id="ld-route"
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: serialized JSON-LD
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(route, canonicalSlugId, locale)) }}
			/>
		</>
	);
}
