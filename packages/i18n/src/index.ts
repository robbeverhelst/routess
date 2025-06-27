export * from "./types";
export { I18nService } from "./I18nService";
export * from "./locales";

// Convenience export for creating i18n service
import { I18nService } from "./I18nService";
import { translations } from "./locales";
import type { Logger } from "@maps/core";
import type { SupportedLanguage } from "./types";

export function createI18nService(logger?: Logger): I18nService {
  return new I18nService({
    translations,
    defaultLanguage: "en",
    fallbackLanguage: "en",
    logger,
  });
}

// Simple function-based API for backward compatibility
export function createTranslationFunction(i18nService: I18nService) {
  return (key: string, lang: SupportedLanguage, replacements?: Record<string, string>) => {
    return i18nService.t(key, lang, replacements);
  };
}
