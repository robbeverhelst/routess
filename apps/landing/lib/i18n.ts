export const LOCALES = ["en", "nl"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const HOST_LOCALE_MAP: Record<string, Locale> = {
	"routess.com": "en",
	"www.routess.com": "en",
	"routess.be": "nl",
	"www.routess.be": "nl",
};

export function localeFromHost(host: string | null | undefined): Locale {
	if (!host) return DEFAULT_LOCALE;
	const normalized = host.toLowerCase().split(":")[0];
	return HOST_LOCALE_MAP[normalized ?? ""] ?? DEFAULT_LOCALE;
}

export const LOCALE_HEADER = "x-routess-locale";

export const HTML_LANG: Record<Locale, string> = {
	en: "en",
	nl: "nl-BE",
};

export const SISTER_HOST: Record<Locale, string> = {
	en: "routess.be",
	nl: "routess.com",
};

export const SELF_HOST: Record<Locale, string> = {
	en: "routess.com",
	nl: "routess.be",
};

export const APP_HOST = "app.routess.com";
export const DOCS_HOST = "docs.routess.com";
export const REPO_URL = "https://github.com/robbeverhelst/routess";
