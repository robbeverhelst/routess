import type { BillingProviderName } from "../config/app-config";
import type { UserPlan } from "../entities/user.entity";

export const BILLING_PROVIDER = Symbol("BILLING_PROVIDER");

// Provider-neutral contract the billing module talks to (ADR 0039). Stripe and
// Mollie both fit it: a hosted checkout the browser is sent to, and a webhook
// that reports what was paid. Customer-portal and cancel calls join it with the
// provider choice, since Mollie has no hosted portal. No implementation ships
// yet.
export interface BillingProvider {
	readonly name: BillingProviderName;
	// Starts a hosted checkout for one Offer; the caller redirects the browser
	// to the returned URL.
	createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
	// Authenticates one webhook delivery (Stripe: signature over the raw body;
	// Mollie: re-fetch the payment by id) and normalizes it. Null means the
	// delivery is valid but billing does not act on it.
	parseWebhook(delivery: WebhookDelivery): Promise<BillingEvent | null>;
}

export interface CheckoutRequest {
	userId: number;
	email: string;
	// Opaque name of what is being bought (e.g. 'pro_yearly'); the provider
	// maps it to its own price id. The set of Offers waits on ADR 0039.
	offer: string;
	successUrl: string;
	cancelUrl: string;
}

export interface CheckoutSession {
	url: string;
	providerRef: string;
}

export interface WebhookDelivery {
	rawBody: Buffer;
	headers: Record<string, string | string[] | undefined>;
}

// What billing does with a provider event. The webhook owns Plan state; the
// browser's return from checkout never changes it.
export interface PlanChangedEvent {
	kind: "plan_changed";
	userId: number;
	plan: UserPlan;
	providerRef: string;
}

export type BillingEvent = PlanChangedEvent;
