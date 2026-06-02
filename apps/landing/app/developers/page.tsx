import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { getDict } from "@/lib/content";
import { DOCS_HOST, HTML_LANG, type Locale, REPO_URL, SELF_HOST, SISTER_HOST } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { AccentInline } from "../components/AccentText";
import { Footer } from "../components/Footer";
import { ArrowIcon, GhIcon } from "../components/Icons";
import { Nav } from "../components/Nav";

function renderInlineCode(s: string): ReactNode {
	const chunks = s.split(/(`[^`]+`)/g);
	return chunks.map((chunk, ci) => {
		const k = `${ci}-${chunk}`;
		if (chunk.startsWith("`") && chunk.endsWith("`")) {
			return <code key={k}>{chunk.slice(1, -1)}</code>;
		}
		return <Fragment key={k}>{chunk}</Fragment>;
	});
}

export async function generateMetadata(): Promise<Metadata> {
	const locale = await getLocale();
	const dict = getDict(locale);
	const selfHost = SELF_HOST[locale];
	const sisterHost = SISTER_HOST[locale];
	const sisterLocale: Locale = locale === "en" ? "nl" : "en";
	const url = `https://${selfHost}/developers`;
	return {
		title: dict.meta.developers.title,
		description: dict.meta.developers.description,
		alternates: {
			canonical: url,
			languages: {
				[HTML_LANG[locale]]: url,
				[HTML_LANG[sisterLocale]]: `https://${sisterHost}/developers`,
				"x-default": "https://routess.com/developers",
			},
		},
		openGraph: {
			type: "website",
			locale: HTML_LANG[locale].replace("-", "_"),
			url,
			siteName: "routess",
			title: dict.meta.developers.title,
			description: dict.meta.developers.description,
		},
		twitter: {
			card: "summary_large_image",
			title: dict.meta.developers.title,
			description: dict.meta.developers.description,
		},
	};
}

export default async function DevelopersPage() {
	const locale = await getLocale();
	const dict = getDict(locale);
	return (
		<>
			<Nav dict={dict} locale={locale} dev />
			<main>
				<section className="topo-bg" style={{ padding: "60px 0 80px" }}>
					<div className="container-x">
						<div style={{ maxWidth: 820 }}>
							<span className="chip" style={{ marginBottom: 22 }}>
								{dict.dev.hero.chip}
							</span>
							<h1 className="display" style={{ fontSize: "clamp(44px, 6vw, 84px)", margin: "12px 0 24px" }}>
								<AccentInline pieces={dict.dev.hero.title} color="var(--terracotta)" />
							</h1>
							<p className="body-lg" style={{ maxWidth: 640, marginBottom: 32 }}>
								{dict.dev.hero.body}
							</p>
							<div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
								<a className="btn btn-primary" href={`https://${DOCS_HOST}`}>
									{dict.dev.hero.ctaDocs} <ArrowIcon />
								</a>
								<a className="btn btn-ghost" href={REPO_URL}>
									<GhIcon /> {dict.dev.hero.ctaGithub}
								</a>
							</div>
						</div>
					</div>
				</section>

				{dict.dev.sections.map((s, idx) => (
					<section key={s.eyebrow} style={{ background: idx % 2 === 0 ? "var(--paper-2)" : "var(--paper)" }}>
						<div className="container-x">
							<div
								className="grid-2"
								style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "start" }}
							>
								<div>
									<span className="eyebrow">{s.eyebrow}</span>
									<h2 className="display" style={{ fontSize: "clamp(32px, 4vw, 52px)", margin: "12px 0 18px" }}>
										{s.title}
									</h2>
									<p className="body-lg">{s.body}</p>
								</div>
								<div>
									<ul
										style={{
											listStyle: "none",
											padding: 0,
											margin: 0,
											display: "flex",
											flexDirection: "column",
											gap: 12,
										}}
									>
										{s.bullets.map((b) => (
											<li
												key={b}
												style={{
													display: "flex",
													gap: 12,
													alignItems: "flex-start",
													color: "var(--ink-soft)",
													padding: "14px 18px",
													borderRadius: 12,
													background: "var(--paper)",
													border: "1px solid var(--line)",
													fontFamily: b.includes("`") ? "var(--font-mono)" : undefined,
													fontSize: b.includes("`") ? 13 : 15,
												}}
											>
												<span
													style={{
														width: 6,
														height: 6,
														borderRadius: "50%",
														background: "var(--indigo)",
														marginTop: 8,
														flexShrink: 0,
													}}
													aria-hidden="true"
												/>
												<span>{renderInlineCode(b)}</span>
											</li>
										))}
									</ul>
								</div>
							</div>
						</div>
					</section>
				))}

				<section className="tight">
					<div className="container-x">
						<div
							className="card"
							style={{
								padding: "44px 48px",
								display: "flex",
								flexDirection: "column",
								gap: 16,
								alignItems: "flex-start",
								background: "var(--ink)",
								color: "var(--paper)",
								borderColor: "transparent",
							}}
						>
							<span className="eyebrow" style={{ color: "oklch(0.78 0.04 80)" }}>
								{dict.openSource.repo}
							</span>
							<h3 className="display" style={{ fontSize: 32, margin: 0, color: "var(--paper)" }}>
								{dict.openSource.title}
							</h3>
							<p style={{ margin: 0, color: "oklch(0.85 0.01 80)", maxWidth: 600 }}>{dict.openSource.body}</p>
							<div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
								<a className="btn" href={REPO_URL} style={{ background: "var(--paper)", color: "var(--ink)" }}>
									<GhIcon /> {dict.nav.github}
								</a>
								<a
									className="btn"
									href={`https://${DOCS_HOST}`}
									style={{ background: "var(--indigo)", color: "white" }}
								>
									{dict.dev.hero.ctaDocs} <ArrowIcon />
								</a>
							</div>
						</div>
					</div>
				</section>
			</main>

			<Footer dict={dict} />
		</>
	);
}
