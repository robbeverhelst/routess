import { createI18nService, createTranslationFunction } from "@maps/i18n";
import { Logger } from "@/lib/logger";

// Create the i18n service with logger
const i18nService = createI18nService(Logger);

// Create the translation function for backward compatibility
export const t = createTranslationFunction(i18nService);

// Re-export types for components
export type { SupportedLanguage } from "@maps/i18n";

// Export the service for advanced usage
export { i18nService };
