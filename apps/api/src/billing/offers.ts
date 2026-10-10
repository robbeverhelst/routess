import type { UserPlan } from "../entities/user.entity";

// What a User can buy (ADR 0039). One offer for now: the Pro year pass, a
// one-off payment (no subscription) that grants the Pro Plan for 365 days from
// payment, extending any Pro time the User already has.
export const BILLING_OFFERS = ["pro_year_pass"] as const;
export type BillingOffer = (typeof BILLING_OFFERS)[number];

export const OFFER_GRANTS: Readonly<Record<BillingOffer, { plan: UserPlan; days: number }>> = {
	pro_year_pass: { plan: "pro", days: 365 },
};

export function isBillingOffer(value: unknown): value is BillingOffer {
	return typeof value === "string" && (BILLING_OFFERS as readonly string[]).includes(value);
}
