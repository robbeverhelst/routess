import { formatDistance } from "@routess/core";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Script from "next/script";
import { getDict } from "@/lib/content";
import { fetchHub, fetchHubRoutes } from "@/lib/hub-api";
import { type HubActivity, hubPath, isLiveHub } from "@/lib/hubs";
import { APP_HOST, HTML_LANG, type Locale, SELF_HOST } from "@/lib/i18n";
import { serializeJsonLd } from "@/lib/json-ld";
import { getLocale } from "@/lib/locale";
import { Footer } from "./Footer";
import { Nav } from "./Nav";

// RegionalHub pages (CONTEXT.md "RegionalHub", #236): one page per
// (activity, place) pair, keyword-in-URL localized per ccTLD. The two page
// directories (cycling-routes on .com, fietsroutes on .be) are thin wrappers
// around this module; each path is canonical on exactly one host.

function normalizeSlug(rawSlug: string): string {
	return decodeURIComponent(rawSlug).toLowerCase();
}

export async function hubMetadata(activity: HubActivity, locale: Locale, rawSlug: string): Promise<Metadata> {
	const hub = await fetchHub(activity, normalizeSlug(rawSlug));
	if (!hub || !isLiveHub(hub.indexableCount)) return {};
	const dict = getDict(locale);
	const copy = dict.hub.activities[activity];
	const sisterLocale: Locale = locale === "en" ? "nl" : "en";
	const path = hubPath(activity, hub.slug, locale);
	const url = `https://${SELF_HOST[locale]}${path}`;
	const title = copy.title.replace("{place}", hub.city);
	const description = copy.description.replace("{count}", String(hub.indexableCount)).replace("{place}", hub.city);
	return {
		title,
		description,
		alternates: {
			canonical: url,
			languages: {
				[HTML_LANG[locale]]: url,
				[HTML_LANG[sisterLocale]]: `https://${SELF_HOST[sisterLocale]}${hubPath(activity, hub.slug, sisterLocale)}`,
				"x-default": `https://routess.com${hubPath(activity, hub.slug, "en")}`,
			},
		},
		openGraph: { type: "website", url, siteName: "routess", title, description },
		twitter: { card: "summary", title, description },
	};
}

function jsonLd(title: string, path: string, locale: Locale) {
	const base = `https://${SELF_HOST[locale]}`;
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: [
			{ "@type": "ListItem", position: 1, name: "routess", item: `${base}/` },
			{ "@type": "ListItem", position: 2, name: title, item: `${base}${path}` },
		],
	};
}

export async function RegionalHubPage({
	activity,
	expectedLocale,
	rawSlug,
}: {
	activity: HubActivity;
	expectedLocale: Locale;
	rawSlug: string;
}) {
	const slug = normalizeSlug(rawSlug);
	const locale = await getLocale();
	// The localized segment exists on exactly one host (ADR 0017): the Dutch
	// keyword belongs to .be, the English one to .com. Cross-host requests get
	// a 301 to the canonical home so no duplicate content can be indexed.
	if (locale !== expectedLocale) {
		permanentRedirect(`https://${SELF_HOST[expectedLocale]}${hubPath(activity, slug, expectedLocale)}`);
	}
	if (rawSlug !== slug) permanentRedirect(hubPath(activity, slug, expectedLocale));
	const hub = await fetchHub(activity, slug);
	// Thin-content rule: below the threshold this page must not exist.
	if (!hub || !isLiveHub(hub.indexableCount)) notFound();
	const routes = await fetchHubRoutes(hub.city, activity);
	const dict = getDict(expectedLocale);
	const copy = dict.hub;
	const activityCopy = copy.activities[activity];
	const title = activityCopy.title.replace("{place}", hub.city);
	const path = hubPath(activity, hub.slug, expectedLocale);
	const totalDistance = routes.reduce((sum, route) => sum + (route.distance ?? 0), 0);
	const stats: Array<{ label: string; value: string }> = [
		{ label: copy.stats.routes, value: String(hub.indexableCount) },
		{ label: copy.stats.totalDistance, value: formatDistance(totalDistance / 1000) },
	];
	if (hub.region) stats.push({ label: copy.stats.region, value: hub.region });
	return (
		<>
			<Nav dict={dict} locale={expectedLocale} />
			<main>
				<section className="topo-bg" style={{ padding: "60px 0 80px" }}>
					<div className="container-x">
						<div style={{ maxWidth: 860 }}>
							<p className="eyebrow" style={{ marginBottom: 8 }}>
								{activityCopy.eyebrow}
							</p>
							<h1 className="display" style={{ fontSize: "clamp(34px, 4.5vw, 56px)", margin: "0 0 16px" }}>
								{title}
							</h1>
							<p className="body-lg" style={{ margin: "0 0 24px" }}>
								{activityCopy.intro.replace("{count}", String(hub.indexableCount)).replace("{place}", hub.city)}
							</p>
							<div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 32 }}>
								{stats.map((stat) => (
									<span key={stat.label} className="chip">
										<span className="eyebrow" style={{ fontSize: 11 }}>
											{stat.label}
										</span>
										<strong>{stat.value}</strong>
									</span>
								))}
							</div>
							<h2 className="display" style={{ fontSize: 24, margin: "0 0 16px" }}>
								{copy.routesTitle.replace("{place}", hub.city)}
							</h2>
							<ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
								{routes.map((route) => (
									<li key={route.slugId} className="card" style={{ padding: "14px 18px" }}>
										<a
											href={`/r/${route.slugId}`}
											style={{ textDecoration: "none", color: "inherit", display: "block" }}
										>
											<strong>{route.name}</strong>
											<span className="mono" style={{ display: "block", fontSize: 13, opacity: 0.7, marginTop: 4 }}>
												{route.distance ? formatDistance(route.distance / 1000) : ""}
												{route.elevationGain ? ` · ${Math.round(route.elevationGain)} m` : ""}
												{route.source ? ` · ${route.source.name}` : ""}
											</span>
										</a>
									</li>
								))}
							</ul>
							<div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
								<a className="btn btn-primary" href={`https://${APP_HOST}`}>
									{copy.planYourOwn}
								</a>
							</div>
						</div>
					</div>
				</section>
			</main>
			<Footer dict={dict} />
			<Script
				id="ld-hub"
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: serialized JSON-LD
				dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd(title, path, expectedLocale)) }}
			/>
		</>
	);
}
