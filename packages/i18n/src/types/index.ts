import type { Logger } from "@routess/core";

// Type for supported language codes
export type SupportedLanguage = "en" | "nl" | "fr" | "de";

// Translation structure
export interface TranslationObject {
	[key: string]: string;
}

export interface Translations {
	[key: string]: TranslationObject;
}

// I18n configuration
export interface I18nConfig {
	translations: Translations;
	defaultLanguage: SupportedLanguage;
	fallbackLanguage: SupportedLanguage;
	logger?: Logger;
}

// I18n service interface
export interface I18nService {
	t(key: string, lang: SupportedLanguage, replacements?: Record<string, string>): string;
	hasTranslation(key: string, lang: SupportedLanguage): boolean;
	getSupportedLanguages(): SupportedLanguage[];
	addTranslations(translations: Translations): void;
}
