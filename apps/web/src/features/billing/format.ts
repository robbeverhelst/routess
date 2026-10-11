import type { ApiBillingStatus } from "@routess/api-client";

type OfferPrice = NonNullable<NonNullable<ApiBillingStatus["offer"]>["price"]>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The decided Checkout methods (ADR 0039), in the order the paywall shows them.
export const PAYMENT_METHODS = ["bancontact", "ideal", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// "€29.99" in the UI language; Stripe reports minor units.
export function formatPrice(price: OfferPrice, language: string): string {
	return new Intl.NumberFormat(language, { style: "currency", currency: price.currency.toUpperCase() }).format(
		price.amount / 100,
	);
}

// "10 October 2027": the day a pass ends, without a time of day.
export function formatDay(iso: string, language: string): string {
	return new Intl.DateTimeFormat(language, { dateStyle: "long" }).format(new Date(iso));
}

// Whole days of Pro left, counting a started day as a day; 0 once it ended.
export function daysLeft(iso: string, now: Date = new Date()): number {
	return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / MS_PER_DAY));
}
