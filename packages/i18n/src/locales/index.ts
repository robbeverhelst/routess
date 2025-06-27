import { en } from "./en";
import { nl } from "./nl";
import { fr } from "./fr";
import { de } from "./de";
import type { Translations, SupportedLanguage } from "../types";

// Convert flat key-value objects to nested translation structure
function createTranslations(
  locales: Record<SupportedLanguage, Record<string, string>>,
): Translations {
  const translations: Translations = {};

  // Get all unique keys from all locales
  const allKeys = new Set<string>();
  Object.values(locales).forEach((locale) => {
    Object.keys(locale).forEach((key) => allKeys.add(key));
  });

  // Create nested structure: { [key]: { [lang]: translation } }
  allKeys.forEach((key) => {
    translations[key] = {};
    Object.entries(locales).forEach(([lang, locale]) => {
      translations[key][lang] = locale[key] || key; // fallback to key if translation missing
    });
  });

  return translations;
}

export const translations = createTranslations({ en, nl, fr, de });
export const supportedLanguages: SupportedLanguage[] = ["en", "nl", "fr", "de"];

export { en, nl, fr, de };
