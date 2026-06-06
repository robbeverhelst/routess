import { formatDistance } from "@routess/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { getDict } from "@/lib/content";
import { APP_HOST, HTML_LANG, type Locale, SELF_HOST, SISTER_HOST } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { fetchPublicProfile, type PublicProfile } from "@/lib/profile-api";
import { Footer } from "../../components/Footer";
import { Nav } from "../../components/Nav";

interface Params {
	handle: string;
}

function summary(template: string, profile: PublicProfile): string {
	return template
		.replace("{name}", profile.name)
		.replace("{count}", String(profile.stats.publicRoutes))
		.replace("{distance}", formatDistance(profile.stats.totalDistance / 1000));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
	const { handle } = await params;
	const profile = await fetchPublicProfile(handle);
	if (!profile) return {};
	const locale = await getLocale();
	const dict = getDict(locale);
	const sisterLocale: Locale = locale === "en" ? "nl" : "en";
	const path = `/u/${profile.handle}`;
	const url = `https://${SELF_HOST[locale]}${path}`;
	const description = summary(dict.profilePage.summaryTemplate, profile);
	const title = `${profile.name} (@${profile.handle})`;
	return {
		title,
		description,
		// Thin-content rule (CONTEXT.md "Indexable"): profiles below the gate
		// render but never get indexed.
		...(profile.isIndexable ? {} : { robots: { index: false, follow: false } }),
		alternates: {
			canonical: url,
			languages: {
				[HTML_LANG[locale]]: url,
				[HTML_LANG[sisterLocale]]: `https://${SISTER_HOST[locale]}${path}`,
				"x-default": `https://routess.com${path}`,
			},
		},
		openGraph: { type: "profile", url, siteName: "routess", title, description },
		twitter: { card: "summary", title, description },
	};
}

function jsonLd(profile: PublicProfile, locale: Locale) {
	const base = `https://${SELF_HOST[locale]}`;
	return {
		"@context": "https://schema.org",
		"@type": "ProfilePage",
		mainEntity: {
			"@type": "Person",
			name: profile.name,
			identifier: profile.handle,
			url: `${base}/u/${profile.handle}`,
		},
	};
}

export default async function PublicProfilePage({ params }: { params: Promise<Params> }) {
	const { handle } = await params;
	const profile = await fetchPublicProfile(handle);
	if (!profile) notFound();
	const locale = await getLocale();
	const dict = getDict(locale);
	const copy = dict.profilePage;
	const stats: Array<{ label: string; value: string }> = [
		{ label: copy.stats.routes, value: String(profile.stats.publicRoutes) },
		{ label: copy.stats.distance, value: formatDistance(profile.stats.totalDistance / 1000) },
		{ label: copy.stats.elevation, value: `${Math.round(profile.stats.totalElevationGain)} m` },
		{ label: copy.stats.followers, value: String(profile.stats.followers) },
	];
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
							<div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
								{profile.avatar ? (
									// biome-ignore lint/performance/noImgElement: remote avatar, next/image adds nothing here
									<img
										src={profile.avatar}
										alt={profile.name}
										width={72}
										height={72}
										style={{ borderRadius: 999, border: "1px solid var(--line)" }}
										referrerPolicy="no-referrer"
									/>
								) : null}
								<div>
									<h1 className="display" style={{ fontSize: "clamp(30px, 4vw, 48px)", margin: 0 }}>
										{profile.name}
									</h1>
									<p className="mono" style={{ margin: "4px 0 0", opacity: 0.7 }}>
										@{profile.handle}
									</p>
								</div>
							</div>
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
								{copy.routesTitle}
							</h2>
							<ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
								{profile.routes.map((route) => (
									<li key={route.id} className="card" style={{ padding: "14px 18px" }}>
										<a
											href={`/r/${route.slugId}`}
											style={{ textDecoration: "none", color: "inherit", display: "block" }}
										>
											<strong>{route.name}</strong>
											<span className="mono" style={{ display: "block", fontSize: 13, opacity: 0.7, marginTop: 4 }}>
												{route.distance ? formatDistance(route.distance / 1000) : ""}
												{route.elevationGain ? ` · ${Math.round(route.elevationGain)} m` : ""}
											</span>
										</a>
									</li>
								))}
							</ul>
							<div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
								<a className="btn btn-primary" href={`https://${APP_HOST}/u/${profile.handle}`}>
									{copy.followInApp}
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
				id="ld-profile"
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: serialized JSON-LD
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(profile, locale)) }}
			/>
		</>
	);
}
