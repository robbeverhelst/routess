import type { Locale } from "@/lib/i18n";

export type LegalBlock =
	| { kind: "p"; text: string }
	| { kind: "ul"; items: readonly string[] }
	| { kind: "table"; head: readonly string[]; rows: readonly (readonly string[])[] };

export interface LegalSection {
	id: string;
	h: string;
	blocks: readonly LegalBlock[];
}

export interface LegalDocument {
	title: string;
	intro: string;
	// ISO date, rendered as the "last updated" stamp. Bump it whenever the
	// substance changes; a policy without a date is not a policy.
	updated: string;
	updatedLabel: string;
	tocLabel: string;
	sections: readonly LegalSection[];
}

export type LegalContent = Record<Locale, LegalDocument>;

// The data controller (GDPR Art. 13(1)(a)). Named here once so the privacy
// policy, the terms, and any future imprint stay in sync. The registered seat
// of an eenmanszaak is public in the KBO register either way.
export const CONTROLLER = {
	name: "Robbe Verhelst",
	registeredAddress: "Buisstraat 45, 2890 Sint-Amands",
	enterpriseNumber: "BE 1024.261.897",
	country: { en: "Belgium", nl: "België" } satisfies Record<Locale, string>,
	privacyEmail: "privacy@routess.com",
	supportEmail: "hello@routess.com",
} as const;
