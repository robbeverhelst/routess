import type { Logger } from "@routess/core";
import type { I18nConfig, I18nService as II18nService, SupportedLanguage, Translations } from "./types";

export class I18nService implements II18nService {
	private translations: Translations;
	private defaultLanguage: SupportedLanguage;
	private fallbackLanguage: SupportedLanguage;
	private logger?: Logger;

	constructor(config: I18nConfig) {
		this.translations = config.translations;
		this.defaultLanguage = config.defaultLanguage;
		this.fallbackLanguage = config.fallbackLanguage;
		this.logger = config.logger;
	}

	/**
	 * Retrieves a translated string for a given key and language.
	 * Optionally replaces placeholders in the string.
	 *
	 * @param key The key for the desired string (e.g., "sidebar.currentRoute").
	 * @param lang The desired language code (e.g., "en", "nl").
	 * @param replacements An optional object with key-value pairs for placeholder replacement.
	 * @returns The translated string, or the key itself if not found.
	 */
	t(key: string, lang: SupportedLanguage, replacements?: Record<string, string>): string {
		let text: string;

		if (this.translations[key]?.[lang]) {
			text = this.translations[key][lang];
		} else if (this.translations[key]?.[this.fallbackLanguage]) {
			this.logger?.warn(
				`[i18n] Translation missing for key '${key}' in language '${lang}'. Falling back to ${this.fallbackLanguage}.`,
			);
			text = this.translations[key][this.fallbackLanguage];
		} else {
			this.logger?.warn(`[i18n] Translation key '${key}' not found.`);
			text = key;
		}

		if (replacements) {
			Object.keys(replacements).forEach((placeholder) => {
				const value = replacements[placeholder];
				// Function replacer: a plain string would apply $-substitution
				// semantics, corrupting values that contain $$ or $&.
				text = text.replaceAll(`{${placeholder}}`, () => value);
			});
		}

		return text;
	}

	/**
	 * Check if a translation exists for a given key and language
	 */
	hasTranslation(key: string, lang: SupportedLanguage): boolean {
		return !!this.translations[key]?.[lang];
	}

	/**
	 * Get all supported languages
	 */
	getSupportedLanguages(): SupportedLanguage[] {
		return ["en", "nl", "fr", "de"];
	}

	/**
	 * Add or update translations dynamically
	 */
	addTranslations(newTranslations: Translations): void {
		this.translations = { ...this.translations, ...newTranslations };
	}

	/**
	 * Get all translations for debugging/development
	 */
	getAllTranslations(): Translations {
		return { ...this.translations };
	}

	/**
	 * Get all translation keys
	 */
	getAllKeys(): string[] {
		return Object.keys(this.translations);
	}
}
