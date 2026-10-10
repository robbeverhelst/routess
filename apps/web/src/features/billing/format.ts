import type { ApiBillingStatus } from "@routess/api-client";

type OfferPrice = NonNullable<NonNullable<ApiBillingStatus["offer"]>["price"]>;

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
