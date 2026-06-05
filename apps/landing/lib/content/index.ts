import type { Locale } from "@/lib/i18n";
import { en } from "./en";
import { nl } from "./nl";
import type { Dict } from "./types";

const dictionaries: Record<Locale, Dict> = { en, nl };

export function getDict(locale: Locale): Dict {
	return dictionaries[locale];
}

export type { Dict };
