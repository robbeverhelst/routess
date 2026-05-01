import type { I18nConfig } from "fumadocs-core/i18n";

export const i18n: I18nConfig = {
	defaultLanguage: "en",
	fallbackLanguage: "en",
	languages: ["en", "nl", "fr", "de"],
	hideLocale: "never",
	parser: "dir",
};

export const localeLabels: Record<string, string> = {
	en: "English",
	nl: "Nederlands",
	fr: "Français",
	de: "Deutsch",
};
