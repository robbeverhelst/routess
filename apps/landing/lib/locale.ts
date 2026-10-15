import { headers } from "next/headers";

import { DEFAULT_LOCALE, type Locale, LOCALE_HEADER, LOCALES } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
	const h = await headers();
	const fromHeader = h.get(LOCALE_HEADER);
	if (fromHeader && (LOCALES as readonly string[]).includes(fromHeader)) {
		return fromHeader as Locale;
	}
	return DEFAULT_LOCALE;
}
