import type { Locale } from "@/lib/i18n";
import { gpxFileCreate } from "./gpx-file-create";
import { komootAlternative } from "./komoot-alternative";
import { planCyclingRoute } from "./plan-cycling-route";
import { routePlannersCompared } from "./route-planners-compared";
import type { Article, ArticleSection } from "./types";

export const ARTICLES: ReadonlyArray<Article> = [
	komootAlternative,
	routePlannersCompared,
	gpxFileCreate,
	planCyclingRoute,
];

export const SECTION_PATHS: Record<ArticleSection, Record<Locale, string>> = {
	compare: { en: "compare", nl: "vergelijk" },
	guides: { en: "guides", nl: "gids" },
};

export function sectionFromPath(path: string): { section: ArticleSection; locale: Locale } | null {
	for (const section of Object.keys(SECTION_PATHS) as ArticleSection[]) {
		for (const locale of Object.keys(SECTION_PATHS[section]) as Locale[]) {
			if (SECTION_PATHS[section][locale] === path) return { section, locale };
		}
	}
	return null;
}

export function articlePath(article: Article, locale: Locale): string {
	return `/${SECTION_PATHS[article.section][locale]}/${article.content[locale].slug}`;
}

export function articlesFor(section: ArticleSection): ReadonlyArray<Article> {
	return ARTICLES.filter((a) => a.section === section);
}

export function findArticle(section: ArticleSection, locale: Locale, slug: string): Article | undefined {
	return ARTICLES.find((a) => a.section === section && a.content[locale].slug === slug);
}
