import { createI18nService, type SupportedLanguage } from "@routess/i18n";
import { useCallback } from "react";
import { Logger } from "@/lib/logger";
import { useUiStore } from "@/stores/uiStore";

const i18nService = createI18nService(Logger);

// React hook: subscribes to the current language and returns a translate
// function bound to it. Components re-render automatically when the user
// switches language.
export const useT = () => {
	const language = useUiStore((s) => s.language);
	return useCallback(
		(key: string, replacements?: Record<string, string>): string => i18nService.t(key, language, replacements),
		[language],
	);
};

// Plain function: usable from anywhere (event handlers, app events, modules
// outside React). Reads the current language from the UI store at call time;
// does not subscribe, so callers in React components should use useT() instead
// to re-render on language changes.
export const t = (key: string, replacements?: Record<string, string>): string =>
	i18nService.t(key, useUiStore.getState().language, replacements);

// Translate against an explicit language, regardless of the user's current
// locale. Used when persisting human-readable strings that must stay stable
// across UI-language switches (e.g. storing the canonical English sport name).
export const tIn = (language: SupportedLanguage, key: string, replacements?: Record<string, string>): string =>
	i18nService.t(key, language, replacements);

export type { SupportedLanguage };
export { i18nService };
