import type { BillingProviderName } from "../config/app-config";
import type { BillingOffer } from "./offers";

export const BILLING_PROVIDER = Symbol("BILLING_PROVIDER");

// Provider-neutral contract the billing module talks to (ADR 0039): a hosted
// checkout the browser is sent to, and a webhook that reports what was paid.
// Stripe is the implementation (stripe-billing.provider.ts). A Pro pass is a
// one-off payment, so there is no subscription to manage or cancel.
export interface BillingProvider {
	readonly name: BillingProviderName;
	// Starts a hosted checkout for one Offer; the caller redirects the browser
	// to the returned URL.
	createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
	// Authenticates one webhook delivery (Stripe: signature over the raw body)
	// and normalizes it. Throws InvalidWebhookError when the delivery cannot be
	// trusted. Null means the delivery is valid but billing does not act on it.
	parseWebhook(delivery: WebhookDelivery): Promise<BillingEvent | null>;
	// The price the provider will charge for an Offer, for display only; the
	// checkout page is authoritative. Null when it cannot be read.
	describeOffer(offer: BillingOffer): Promise<OfferPrice | null>;
}

export interface CheckoutRequest {
	userId: number;
	email: string;
	offer: BillingOffer;
	successUrl: string;
	cancelUrl: string;
}

export interface CheckoutSession {
	url: string;
	providerRef: string;
}

export interface OfferPrice {
	// Minor units (cents), VAT-inclusive.
	amount: number;
	currency: string;
}

export interface WebhookDelivery {
	rawBody: Buffer;
	headers: Record<string, string | string[] | undefined>;
}

// A delivery that fails authentication (bad or missing signature). The
// controller answers 400 so the provider shows the failure.
export class InvalidWebhookError extends Error {}

// What billing does with a provider event. The webhook owns Pro state; the
// browser's return from checkout never changes it.
export interface PassPurchasedEvent {
	kind: "pass_purchased";
	// The provider's event id: redelivering it must not grant twice.
	eventId: string;
	userId: number;
	offer: BillingOffer;
	// The provider's checkout reference (Stripe Checkout Session id).
	providerRef: string;
	// When the provider recorded the payment; the pass runs from here.
	paidAt: Date;
	amountTotal: number | null;
	currency: string | null;
}

export type BillingEvent = PassPurchasedEvent;
