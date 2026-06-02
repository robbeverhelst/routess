import { headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_HEADER, LOCALES, type Locale } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
	const h = await headers();
	const fromHeader = h.get(LOCALE_HEADER);
	if (fromHeader && (LOCALES as readonly string[]).includes(fromHeader)) {
		return fromHeader as Locale;
	}
	return DEFAULT_LOCALE;
}
