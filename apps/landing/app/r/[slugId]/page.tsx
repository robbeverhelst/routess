import { buildRouteSlugId, formatDistance, formatDuration, isRouteIndexable, parseRouteSlugId } from "@routess/core";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Script from "next/script";
import { type Dict, getDict } from "@/lib/content";
import { APP_HOST, HTML_LANG, type Locale, SELF_HOST, SISTER_HOST } from "@/lib/i18n";
import { serializeJsonLd } from "@/lib/json-ld";
import { getLocale } from "@/lib/locale";
import { fetchExternalRoute, fetchPublicRoute, PUBLIC_API_URL } from "@/lib/route-api";
import { Footer } from "../../components/Footer";
import { Nav } from "../../components/Nav";

interface Params {
	slugId: string;
}

// One normalized view over both route kinds: user Routes and seeded
// ExternalRoutes ('-x{id}' slugs, ADR 0035). The render-time combination is
// the ODbL Produced Work; the only visible differences are the author line
// versus the source attribution, and where the GPX comes from.
interface RouteView {
	name: string;
	description?: string;
	activity?: "run" | "cycle" | "walk";
	tags: string[];
	distance?: number;
	duration?: number;
	elevationGain?: number;
	canonicalSlugId: string;
	indexable: boolean;
	user?: { name: string; handle: string };
	source?: { name: string; attribution: string; url: string };
	gpxHref: string;
}

async function resolveRoute(slugId: string): Promise<RouteView | null> {
	const parsed = parseRouteSlugId(slugId);
	if (!parsed) return null;
	if (parsed.externalId !== undefined) {
		const route = await fetchExternalRoute(parsed.externalId);
		if (!route) return null;
		return {
			name: route.name,
			description: route.description,
			activity: route.activity,
			tags: route.tags,
			distance: route.distance,
			duration: route.duration,
			elevationGain: route.elevationGain,
			canonicalSlugId: route.slugId,
			// ExternalRoutes are always public; the gate is the quality bar.
			indexable: isRouteIndexable({
				visibility: "public",
				name: route.name,
				distance: route.distance,
				description: route.description,
				tags: route.tags,
			}),
			source: route.source,
			gpxHref: `${PUBLIC_API_URL}/api/v1/external-routes/${route.id}/gpx`,
		};
	}
	const route = await fetchPublicRoute(parsed.id ?? parsed.token);
	if (!route) return null;
	// Public routes get the canonical id URL; unlisted keep the unguessable
	// token so the link cannot be derived from the sequential id.
	const canonicalRef = route.visibility === "public" ? route.id : route.shareToken;
	return {
		name: route.name,
		description: route.description,
		activity: route.activity,
		tags: route.tags,
		distance: route.distance,
		duration: route.duration,
		elevationGain: route.elevationGain,
		canonicalSlugId: buildRouteSlugId(route.name, canonicalRef),
		indexable: isRouteIndexable(route),
		user: route.user,
		gpxHref: `${PUBLIC_API_URL}/api/v1/routes/${route.id}/gpx`,
	};
}

function summary(dict: Dict, route: RouteView): string {
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
	const locale = await getLocale();
	const dict = getDict(locale);
	const sisterLocale: Locale = locale === "en" ? "nl" : "en";
	const path = `/r/${resolved.canonicalSlugId}`;
	const url = `https://${SELF_HOST[locale]}${path}`;
	const description = summary(dict, resolved);
	return {
		title: resolved.name,
		description,
		...(resolved.indexable ? {} : { robots: { index: false, follow: false } }),
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
			title: resolved.name,
			description,
			images: [{ url: `${url}/og.png`, width: 1200, height: 630 }],
		},
		twitter: { card: "summary_large_image", title: resolved.name, description },
	};
}

function jsonLd(route: RouteView, locale: Locale) {
	const base = `https://${SELF_HOST[locale]}`;
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{ "@type": "ListItem", position: 1, name: "routess", item: `${base}/` },
			{ "@type": "ListItem", position: 2, name: route.name, item: `${base}/r/${route.canonicalSlugId}` },
		],
	};
}

export default async function PublicRoutePage({ params }: { params: Promise<Params> }) {
	const { slugId } = await params;
	const route = await resolveRoute(slugId);
	if (!route) notFound();
	if (slugId !== route.canonicalSlugId) permanentRedirect(`/r/${route.canonicalSlugId}`);
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
							<h1 className="display" style={{ fontSize: "clamp(34px, 4.5vw, 56px)", margin: "0 0 8px" }}>
								{route.name}
							</h1>
							{route.user?.handle ? (
								<p style={{ margin: "0 0 18px" }}>
									<a href={`/u/${route.user.handle}`} className="mono" style={{ fontSize: 14 }}>
										{copy.byAuthor.replace("{name}", route.user.name)}
									</a>
								</p>
							) : null}
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
								src={`/r/${route.canonicalSlugId}/og.png`}
								alt={copy.mapAlt}
								width={1200}
								height={630}
								style={{ width: "100%", height: "auto", borderRadius: 16, border: "1px solid var(--line)" }}
							/>
							{route.source ? (
								// License obligation (ADR 0035): attribution on every
								// externally-derived route page.
								<p className="mono" style={{ fontSize: 13, opacity: 0.7, margin: "10px 0 0" }}>
									<a href={route.source.url} rel="license noopener" style={{ color: "inherit" }}>
										{route.source.attribution}
									</a>
								</p>
							) : null}
							{description ? (
								<>
									<h2 className="display" style={{ fontSize: 24, margin: "32px 0 8px" }}>
										{copy.about}
									</h2>
									<p className="body-lg">{description}</p>
								</>
							) : null}
							<div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
								<a className="btn btn-primary" href={`https://${APP_HOST}/r/${route.canonicalSlugId}`}>
									{copy.openInApp}
								</a>
								<a className="btn btn-ghost" href={route.gpxHref}>
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
				dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd(route, locale)) }}
			/>
		</>
	);
}
