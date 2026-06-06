import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Script from "next/script";
import { articlePath, findArticle, SECTION_PATHS, sectionFromPath } from "@/lib/articles";
import type { Article } from "@/lib/articles/types";
import { getDict } from "@/lib/content";
import { HTML_LANG, type Locale, SELF_HOST, SISTER_HOST } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { ArticleBlocks, RichTextSpan } from "../../components/ArticleBlocks";
import { Footer } from "../../components/Footer";
import { Nav } from "../../components/Nav";

interface Params {
	section: string;
	slug: string;
}

function resolve(params: Params, locale: Locale): { article: Article } | { redirectTo: string } | null {
	const match = sectionFromPath(params.section);
	if (!match) return null;
	if (match.locale !== locale) {
		// Path belongs to the sister locale: send the visitor to the sister host.
		const article = findArticle(match.section, match.locale, params.slug);
		if (!article) return null;
		return { redirectTo: `https://${SELF_HOST[match.locale]}${articlePath(article, match.locale)}` };
	}
	const article = findArticle(match.section, locale, params.slug);
	if (!article) return null;
	return { article };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
	const locale = await getLocale();
	const resolved = resolve(await params, locale);
	if (!resolved || "redirectTo" in resolved) return {};
	const { article } = resolved;
	const content = article.content[locale];
	const sisterLocale: Locale = locale === "en" ? "nl" : "en";
	const url = `https://${SELF_HOST[locale]}${articlePath(article, locale)}`;
	return {
		title: content.metaTitle,
		description: content.description,
		alternates: {
			canonical: url,
			languages: {
				[HTML_LANG[locale]]: url,
				[HTML_LANG[sisterLocale]]: `https://${SISTER_HOST[locale]}${articlePath(article, sisterLocale)}`,
				"x-default": `https://routess.com${articlePath(article, "en")}`,
			},
		},
		openGraph: {
			type: "article",
			url,
			siteName: "routess",
			title: content.metaTitle,
			description: content.description,
			publishedTime: article.datePublished,
			modifiedTime: article.dateModified,
		},
	};
}

function jsonLd(article: Article, locale: Locale, sectionLabel: string) {
	const base = `https://${SELF_HOST[locale]}`;
	const content = article.content[locale];
	const url = `${base}${articlePath(article, locale)}`;
	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "Article",
				headline: content.title,
				description: content.description,
				inLanguage: HTML_LANG[locale],
				datePublished: article.datePublished,
				dateModified: article.dateModified,
				mainEntityOfPage: url,
				author: { "@id": `${base}/#org` },
				publisher: { "@id": `${base}/#org` },
			},
			{
				"@type": "BreadcrumbList",
				itemListElement: [
					{ "@type": "ListItem", position: 1, name: "routess", item: `${base}/` },
					{
						"@type": "ListItem",
						position: 2,
						name: sectionLabel,
						item: `${base}/${SECTION_PATHS[article.section][locale]}`,
					},
					{ "@type": "ListItem", position: 3, name: content.title, item: url },
				],
			},
		],
	};
}

const SECTION_LABELS: Record<string, Record<Locale, string>> = {
	compare: { en: "Compare", nl: "Vergelijk" },
	guides: { en: "Guides", nl: "Gidsen" },
};

export default async function ArticlePage({ params }: { params: Promise<Params> }) {
	const locale = await getLocale();
	const resolved = resolve(await params, locale);
	if (!resolved) notFound();
	if ("redirectTo" in resolved) permanentRedirect(resolved.redirectTo);
	const { article } = resolved;
	const content = article.content[locale];
	const dict = getDict(locale);
	const sectionLabel = SECTION_LABELS[article.section]?.[locale] ?? article.section;
	return (
		<>
			<Nav dict={dict} locale={locale} />
			<main>
				<section className="topo-bg" style={{ padding: "60px 0 80px" }}>
					<div className="container-x">
						<article style={{ maxWidth: 760 }}>
							<p className="eyebrow" style={{ marginBottom: 8 }}>
								{sectionLabel}
							</p>
							<h1 className="display" style={{ fontSize: "clamp(36px, 4.5vw, 60px)", margin: "0 0 20px" }}>
								{content.title}
							</h1>
							<p className="body-lg" style={{ fontSize: 21, marginBottom: 32 }}>
								<RichTextSpan content={content.intro} />
							</p>
							<ArticleBlocks blocks={content.blocks} />
						</article>
					</div>
				</section>
			</main>
			<Footer dict={dict} />
			<Script
				id="ld-article"
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: serialized JSON-LD
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(article, locale, sectionLabel)) }}
			/>
		</>
	);
}
