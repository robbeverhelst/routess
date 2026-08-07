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

// The data controller. Named here once so the privacy policy, the terms, and
// any future imprint stay in sync.
//
// TODO(legal): REGISTERED_ADDRESS and ENTERPRISE_NUMBER are placeholders. GDPR
// Art. 13(1)(a) requires the controller's identity and contact details, so
// these must be real before the page is linked from signup.
export const CONTROLLER = {
	name: "Robbe Verhelst",
	registeredAddress: "[[REGISTERED ADDRESS PENDING]]",
	enterpriseNumber: "[[ENTERPRISE NUMBER PENDING]]",
	country: "Belgium",
	privacyEmail: "privacy@routess.com",
	supportEmail: "hello@routess.com",
} as const;
