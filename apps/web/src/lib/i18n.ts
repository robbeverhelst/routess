import translations from './translations.json';
import { Logger } from './logger'; // Assuming logger is in the same directory

// Define the structure of our translation keys and their nested language strings
interface TranslationObject {
  [key: string]: string;
}

interface Translations {
  [key: string]: TranslationObject;
}

const loadedTranslations: Translations = translations;

// Type for supported language codes
export type SupportedLanguage = 'en' | 'nl' | 'fr' | 'de';

/**
 * Retrieves a translated string for a given key and language.
 * Optionally replaces placeholders in the string.
 * 
 * @param key The key for the desired string (e.g., "sidebar.currentRoute").
 * @param lang The desired language code (e.g., "en", "nl").
 * @param replacements An optional object with key-value pairs for placeholder replacement.
 * @returns The translated string, or the key itself if not found.
 */
export function t(key: string, lang: SupportedLanguage, replacements?: Record<string, string>): string {
  let text: string;

  if (loadedTranslations[key] && loadedTranslations[key][lang]) {
    text = loadedTranslations[key][lang];
  } else if (loadedTranslations[key] && loadedTranslations[key]['en']) {
    Logger.warn(`[i18n] Translation missing for key '${key}' in language '${lang}'. Falling back to English.`);
    text = loadedTranslations[key]['en'];
  } else {
    Logger.warn(`[i18n] Translation key '${key}' not found.`);
    text = key;
  }

  if (replacements) {
    Object.keys(replacements).forEach(placeholder => {
      const value = replacements[placeholder];
      // Use a regex to replace all occurrences of {placeholder}
      text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
    });
  }

  return text;
}

// We might want to add a global state management for language later (e.g., Zustand, Context API)
// For now, the language will be passed directly to the t() function. 