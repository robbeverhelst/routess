import type { I18nConfig } from "fumadocs-core/i18n";
import { type AdvancedIndex, createI18nSearchAPI } from "fumadocs-core/search/server";
import { i18n } from "@/lib/i18n";
import { apiSource, docsSource, guideSource } from "@/lib/source";

type SearchablePage = {
	url: string;
	locale?: string;
	data: {
		title?: string;
		description?: string;
		structuredData: AdvancedIndex["structuredData"];
	};
};

function toIndex(page: SearchablePage): AdvancedIndex {
	return {
		id: page.url,
		title: page.data.title ?? page.url,
		description: page.data.description,
		structuredData: page.data.structuredData,
		url: page.url,
	};
}

export const { GET } = createI18nSearchAPI("advanced", {
	i18n: i18n as I18nConfig,
	indexes: () => [
		...guideSource.getPages().map((page) => ({
			...toIndex(page),
			locale: page.locale ?? i18n.defaultLanguage,
		})),
		...docsSource.getPages().map((page) => ({
			...toIndex(page),
			locale: i18n.defaultLanguage,
		})),
		...apiSource.getPages().map((page) => ({
			...toIndex(page),
			locale: i18n.defaultLanguage,
		})),
	],
});
