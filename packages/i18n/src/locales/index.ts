import type { SupportedLanguage, Translations } from "../types";
import { de } from "./de";
import { en } from "./en";
import { fr } from "./fr";
import { nl } from "./nl";

// Convert flat key-value objects to nested translation structure
function createTranslations(locales: Record<SupportedLanguage, Record<string, string>>): Translations {
	const translations: Translations = {};

	// Get all unique keys from all locales
	const allKeys = new Set<string>();
	for (const locale of Object.values(locales)) {
		for (const key of Object.keys(locale)) {
			allKeys.add(key);
		}
	}

	// Create nested structure: { [key]: { [lang]: translation } }
	for (const key of allKeys) {
		translations[key] = {};
		for (const [lang, locale] of Object.entries(locales)) {
			translations[key][lang] = locale[key] || key; // fallback to key if translation missing
		}
	}

	return translations;
}

export const translations = createTranslations({ en, nl, fr, de });
export const supportedLanguages: SupportedLanguage[] = ["en", "nl", "fr", "de"];

export { de, en, fr, nl };
