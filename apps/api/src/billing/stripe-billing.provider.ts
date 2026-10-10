import { Logger } from "@nestjs/common";

import Stripe = require("stripe");

import type { AppConfig } from "../config/app-config";
import {
	type BillingEvent,
	type BillingProvider,
	type CheckoutRequest,
	type CheckoutSession,
	InvalidWebhookError,
	type OfferPrice,
	type WebhookDelivery,
} from "./billing-provider";
import { type BillingOffer, isBillingOffer } from "./offers";

type StripeClient = InstanceType<typeof Stripe>;
type StripeSettings = AppConfig["billing"]["stripe"];

// The decided payment methods (ADR 0039). Stripe offers the methods enabled in
// the Dashboard; this narrows them to these three, so each must be switched
// on there. All three confirm immediately, so checkout.session.completed
// already carries payment_status 'paid'; a delayed method (SEPA) would also
// need checkout.session.async_payment_succeeded.
const PAYMENT_METHODS = ["bancontact", "ideal", "card"] as const;

// Prices change rarely and only show on the upgrade page; the checkout page
// is authoritative.
const PRICE_CACHE_MS = 60 * 60 * 1000;
// A failed read is remembered briefly too, so a Stripe outage or a bad price
// id does not add a Stripe round trip to every status request.
const PRICE_FAILURE_CACHE_MS = 5 * 60 * 1000;

// Stripe Checkout in payment mode: a Pro pass is one VAT-inclusive payment,
// no subscription and no Stripe Customer. Routess (Robbe's VAT number) is the
// seller; there is no merchant of record.
export class StripeBillingProvider implements BillingProvider {
	readonly name = "stripe" as const;
	private readonly logger = new Logger(StripeBillingProvider.name);
	private readonly stripe: StripeClient;
	private priceCache: { price: OfferPrice | null; expiresAt: number } | null = null;

	constructor(
		private readonly settings: StripeSettings,
		client?: StripeClient,
	) {
		this.stripe = client ?? new Stripe(settings.secretKey);
	}

	async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
		const metadata = { userId: String(request.userId), offer: request.offer };
		const session = await this.stripe.checkout.sessions.create({
			mode: "payment",
			line_items: [{ price: this.priceIdFor(request.offer), quantity: 1 }],
			allowed_payment_method_types: [...PAYMENT_METHODS],
			customer_email: request.email,
			client_reference_id: String(request.userId),
			metadata,
			payment_intent_data: { metadata },
			success_url: request.successUrl,
			cancel_url: request.cancelUrl,
			locale: "auto",
		});
		if (!session.url) {
			throw new Error(`Stripe returned checkout session ${session.id} without a URL`);
		}
		return { url: session.url, providerRef: session.id };
	}

	async parseWebhook(delivery: WebhookDelivery): Promise<BillingEvent | null> {
		const signature = delivery.headers["stripe-signature"];
		if (typeof signature !== "string" || signature.length === 0) {
			throw new InvalidWebhookError("Missing Stripe-Signature header");
		}
		let event: Stripe.Event;
		try {
			// The async variant: under Bun (which runs the API) the SDK verifies
			// with SubtleCrypto, which has no synchronous HMAC.
			event = await this.stripe.webhooks.constructEventAsync(delivery.rawBody, signature, this.settings.webhookSecret);
		} catch (error) {
			throw new InvalidWebhookError(error instanceof Error ? error.message : "Invalid Stripe signature");
		}

		// The completed Checkout Session is the source of truth for a pass.
		if (event.type !== "checkout.session.completed") return null;
		const session = event.data.object;
		if (session.mode !== "payment") return null;
		if (session.payment_status !== "paid") {
			this.logger.warn(`Checkout session ${session.id} completed with payment_status=${session.payment_status}`);
			return null;
		}

		const userId = Number.parseInt(session.client_reference_id ?? session.metadata?.userId ?? "", 10);
		const offer = session.metadata?.offer;
		if (!Number.isSafeInteger(userId) || userId <= 0 || !isBillingOffer(offer)) {
			// Not a Routess checkout (another integration on the same account).
			this.logger.warn(`Ignoring checkout session ${session.id}: no Routess user or offer`);
			return null;
		}

		return {
			kind: "pass_purchased",
			eventId: event.id,
			userId,
			offer,
			providerRef: session.id,
			paidAt: new Date(event.created * 1000),
			amountTotal: session.amount_total ?? null,
			currency: session.currency ?? null,
		};
	}

	async describeOffer(offer: BillingOffer): Promise<OfferPrice | null> {
		if (this.priceCache && Date.now() < this.priceCache.expiresAt) {
			return this.priceCache.price;
		}
		let described: OfferPrice | null = null;
		try {
			const price = await this.stripe.prices.retrieve(this.priceIdFor(offer));
			if (price.unit_amount !== null) {
				described = { amount: price.unit_amount, currency: price.currency };
			}
		} catch (error) {
			this.logger.warn(`Could not read the Stripe price: ${error instanceof Error ? error.message : String(error)}`);
		}
		this.priceCache = {
			price: described,
			expiresAt: Date.now() + (described ? PRICE_CACHE_MS : PRICE_FAILURE_CACHE_MS),
		};
		return described;
	}

	private priceIdFor(_offer: BillingOffer): string {
		return this.settings.proYearPassPriceId;
	}
}
