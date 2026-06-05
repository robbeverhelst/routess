import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { articlePath, articlesFor, SECTION_PATHS, sectionFromPath } from "@/lib/articles";
import type { ArticleSection } from "@/lib/articles/types";
import { getDict } from "@/lib/content";
import { HTML_LANG, type Locale, SELF_HOST, SISTER_HOST } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { Footer } from "../components/Footer";
import { Nav } from "../components/Nav";

const COPY: Record<ArticleSection, Record<Locale, { title: string; intro: string }>> = {
	compare: {
		en: {
			title: "Compare",
			intro: "How routess stacks up against other route planners. Honest comparisons, trade-offs included.",
		},
		nl: {
			title: "Vergelijk",
			intro: "Hoe routess zich verhoudt tot andere routeplanners. Eerlijke vergelijkingen, nadelen inbegrepen.",
		},
	},
	guides: {
		en: {
			title: "Guides",
			intro: "Practical guides for planning routes, working with GPX files, and getting routes onto your devices.",
		},
		nl: {
			title: "Gidsen",
			intro: "Praktische gidsen voor routes plannen, werken met GPX-bestanden en routes op je toestellen krijgen.",
		},
	},
};

function resolve(sectionParam: string, locale: Locale): { section: ArticleSection } | { redirectTo: string } | null {
	const match = sectionFromPath(sectionParam);
	if (!match) return null;
	if (match.locale !== locale) {
		return {
			redirectTo: `https://${SELF_HOST[match.locale]}/${SECTION_PATHS[match.section][match.locale]}`,
		};
	}
	return { section: match.section };
}

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
	const locale = await getLocale();
	const resolved = resolve((await params).section, locale);
	if (!resolved || "redirectTo" in resolved) return {};
	const { section } = resolved;
	const copy = COPY[section][locale];
	const sisterLocale: Locale = locale === "en" ? "nl" : "en";
	const url = `https://${SELF_HOST[locale]}/${SECTION_PATHS[section][locale]}`;
	return {
		title: copy.title,
		description: copy.intro,
		alternates: {
			canonical: url,
			languages: {
				[HTML_LANG[locale]]: url,
				[HTML_LANG[sisterLocale]]: `https://${SISTER_HOST[locale]}/${SECTION_PATHS[section][sisterLocale]}`,
				"x-default": `https://routess.com/${SECTION_PATHS[section].en}`,
			},
		},
		openGraph: { type: "website", url, siteName: "routess", title: copy.title, description: copy.intro },
	};
}

export default async function SectionIndexPage({ params }: { params: Promise<{ section: string }> }) {
	const locale = await getLocale();
	const resolved = resolve((await params).section, locale);
	if (!resolved) notFound();
	if ("redirectTo" in resolved) permanentRedirect(resolved.redirectTo);
	const { section } = resolved;
	const copy = COPY[section][locale];
	const dict = getDict(locale);
	const articles = articlesFor(section);
	return (
		<>
			<Nav dict={dict} locale={locale} />
			<main>
				<section className="topo-bg" style={{ padding: "60px 0 80px" }}>
					<div className="container-x">
						<div style={{ maxWidth: 760 }}>
							<h1 className="display" style={{ fontSize: "clamp(40px, 5vw, 72px)", margin: "12px 0 20px" }}>
								{copy.title}
							</h1>
							<p className="body-lg" style={{ marginBottom: 36 }}>
								{copy.intro}
							</p>
							{articles.map((article) => {
								const content = article.content[locale];
								return (
									<a key={article.key} className="article-list-item" href={articlePath(article, locale)}>
										<h2 className="display" style={{ fontSize: 24, margin: "0 0 8px" }}>
											{content.title}
										</h2>
										<p className="body-lg" style={{ fontSize: 17, margin: 0 }}>
											{content.description}
										</p>
									</a>
								);
							})}
						</div>
					</div>
				</section>
			</main>
			<Footer dict={dict} />
		</>
	);
}
