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
	const totalElevation = routes.reduce((sum, route) => sum + (route.elevationGain ?? 0), 0);
	// The place name carries the accent, same move as the homepage headlines.
	const [titleBefore, titleAfter] = activityCopy.title.split("{place}");
	const stats: Array<{ label: string; value: string; dot: string }> = [
		{ label: copy.stats.routes, value: String(hub.indexableCount), dot: "var(--moss)" },
		{ label: copy.stats.totalDistance, value: formatDistance(totalDistance / 1000), dot: "var(--terracotta)" },
	];
	if (totalElevation > 0) {
		stats.push({ label: copy.stats.elevation, value: `↑ ${Math.round(totalElevation)} m`, dot: "var(--sky)" });
	}
	if (hub.region) stats.push({ label: copy.stats.region, value: hub.region, dot: "var(--sun)" });
	return (
		<>
			<Nav dict={dict} locale={expectedLocale} />
			<main>
				<section className="topo-bg" style={{ padding: "70px 0 90px" }}>
					<div className="container-x">
						<div className="section-header reveal" style={{ marginBottom: 36 }}>
							<span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
								<span
									style={{ width: 8, height: 8, borderRadius: 999, background: "var(--moss)", display: "inline-block" }}
								/>
								{activityCopy.eyebrow}
							</span>
							<h1 className="display" style={{ fontSize: "clamp(38px, 5vw, 64px)", margin: 0 }}>
								{titleBefore}
								<span style={{ color: "var(--moss)" }}>{hub.city}</span>
								{titleAfter}
							</h1>
							<p className="body-lg">
								{activityCopy.intro.replace("{count}", String(hub.indexableCount)).replace("{place}", hub.city)}
							</p>
						</div>
						<div className="reveal" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 44 }}>
							{stats.map((stat) => (
								<span key={stat.label} className="chip">
									<span
										style={{ width: 7, height: 7, borderRadius: 999, background: stat.dot, display: "inline-block" }}
									/>
									<span className="eyebrow" style={{ fontSize: 11 }}>
										{stat.label}
									</span>
									<strong>{stat.value}</strong>
								</span>
							))}
						</div>
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
								gap: 18,
							}}
						>
							{routes.map((route, i) => (
								<a
									key={route.slugId}
									href={`/r/${route.slugId}`}
									className="card card-lift reveal"
									style={
										{
											overflow: "hidden",
											textDecoration: "none",
											color: "inherit",
											display: "block",
											"--reveal-delay": `${Math.min(i, 8) * 60}ms`,
										} as React.CSSProperties
									}
								>
									{/* Each route's first-party map preview (the og.png proxy). */}
									{/* biome-ignore lint/performance/noImgElement: proxied remote image, next/image adds nothing here */}
									<img
										src={`/r/${route.slugId}/og.png`}
										alt=""
										width={1200}
										height={630}
										loading={i > 5 ? "lazy" : undefined}
										style={{ width: "100%", aspectRatio: "1200 / 630", objectFit: "cover", display: "block" }}
									/>
									<div style={{ padding: "14px 18px 16px" }}>
										<div style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.3 }}>{route.name}</div>
										<div className="mono" style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
											{route.distance ? formatDistance(route.distance / 1000) : ""}
											{route.elevationGain ? ` · ↑ ${Math.round(route.elevationGain)} m` : ""}
										</div>
										<div style={{ fontSize: 12.5, color: "var(--muted-color)", marginTop: 4 }}>
											{route.source
												? route.source.name
												: route.user
													? copy.byAuthor.replace("{name}", route.user.name)
													: "routess"}
										</div>
									</div>
								</a>
							))}
						</div>
						<div
							className="card reveal"
							style={{
								marginTop: 44,
								padding: "28px 32px",
								display: "flex",
								flexWrap: "wrap",
								alignItems: "center",
								justifyContent: "space-between",
								gap: 18,
							}}
						>
							<div>
								<div className="display" style={{ fontSize: 22, marginBottom: 4 }}>
									{copy.cta.title.replace("{place}", hub.city)}
								</div>
								<div style={{ color: "var(--muted-color)", fontSize: 15 }}>{copy.cta.body}</div>
							</div>
							<a className="btn btn-primary" href={`https://${APP_HOST}`}>
								{copy.planYourOwn}
							</a>
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
