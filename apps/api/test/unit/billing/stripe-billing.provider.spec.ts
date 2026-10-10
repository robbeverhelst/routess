import Stripe = require("stripe");

import { InvalidWebhookError } from "../../../src/billing/billing-provider";
import { StripeBillingProvider } from "../../../src/billing/stripe-billing.provider";

const SETTINGS = { secretKey: "sk_test_dummy", webhookSecret: "whsec_test_secret", proYearPassPriceId: "price_pass" };
// Signature checks are local HMAC work; this client never reaches the network.
const stripe = new Stripe(SETTINGS.secretKey);

function checkoutEvent(overrides: Record<string, unknown> = {}, type = "checkout.session.completed") {
	return {
		id: "evt_123",
		object: "event",
		type,
		created: 1_790_000_000,
		data: {
			object: {
				id: "cs_test_123",
				object: "checkout.session",
				mode: "payment",
				payment_status: "paid",
				client_reference_id: "42",
				metadata: { userId: "42", offer: "pro_year_pass" },
				amount_total: 2999,
				currency: "eur",
				...overrides,
			},
		},
	};
}

async function signed(payload: unknown, secret = SETTINGS.webhookSecret) {
	const body = JSON.stringify(payload);
	const signature = await stripe.webhooks.generateTestHeaderStringAsync({ payload: body, secret });
	return { rawBody: Buffer.from(body), headers: { "stripe-signature": signature } };
}

describe("StripeBillingProvider.parseWebhook", () => {
	const provider = new StripeBillingProvider(SETTINGS, stripe);

	it("turns a signed, paid checkout.session.completed into a pass purchase", async () => {
		expect(await provider.parseWebhook(await signed(checkoutEvent()))).toEqual({
			kind: "pass_purchased",
			eventId: "evt_123",
			userId: 42,
			offer: "pro_year_pass",
			providerRef: "cs_test_123",
			paidAt: new Date(1_790_000_000 * 1000),
			amountTotal: 2999,
			currency: "eur",
		});
	});

	it("rejects a delivery signed with another secret, a tampered body, or no signature", async () => {
		await expect(provider.parseWebhook(await signed(checkoutEvent(), "whsec_other"))).rejects.toBeInstanceOf(
			InvalidWebhookError,
		);

		const delivery = await signed(checkoutEvent());
		const tampered = { ...delivery, rawBody: Buffer.from(delivery.rawBody.toString().replace('"42"', '"43"')) };
		await expect(provider.parseWebhook(tampered)).rejects.toBeInstanceOf(InvalidWebhookError);

		await expect(provider.parseWebhook({ rawBody: delivery.rawBody, headers: {} })).rejects.toBeInstanceOf(
			InvalidWebhookError,
		);
	});

	it("ignores other event types, unpaid or non-payment sessions, and sessions that are not Routess's", async () => {
		expect(await provider.parseWebhook(await signed(checkoutEvent({}, "checkout.session.expired")))).toBeNull();
		expect(await provider.parseWebhook(await signed(checkoutEvent({ payment_status: "unpaid" })))).toBeNull();
		expect(await provider.parseWebhook(await signed(checkoutEvent({ mode: "subscription" })))).toBeNull();
		expect(
			await provider.parseWebhook(await signed(checkoutEvent({ client_reference_id: null, metadata: {} }))),
		).toBeNull();
		expect(
			await provider.parseWebhook(await signed(checkoutEvent({ metadata: { userId: "42", offer: "other" } }))),
		).toBeNull();
	});
});

describe("StripeBillingProvider.createCheckout", () => {
	it("opens a one-off payment for the pass price, limited to Bancontact, iDEAL and card", async () => {
		const calls: unknown[] = [];
		const client = {
			checkout: {
				sessions: {
					create: async (params: unknown) => {
						calls.push(params);
						return { id: "cs_new", url: "https://checkout.stripe.com/c/pay/cs_new" };
					},
				},
			},
		} as unknown as InstanceType<typeof Stripe>;
		const provider = new StripeBillingProvider(SETTINGS, client);

		const session = await provider.createCheckout({
			userId: 7,
			email: "buyer@example.com",
			offer: "pro_year_pass",
			successUrl: "https://app.example/upgrade?checkout=success",
			cancelUrl: "https://app.example/upgrade?checkout=cancelled",
		});

		expect(session).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_new", providerRef: "cs_new" });
		expect(calls[0]).toMatchObject({
			mode: "payment",
			line_items: [{ price: "price_pass", quantity: 1 }],
			allowed_payment_method_types: ["bancontact", "ideal", "card"],
			customer_email: "buyer@example.com",
			client_reference_id: "7",
			metadata: { userId: "7", offer: "pro_year_pass" },
			success_url: "https://app.example/upgrade?checkout=success",
			cancel_url: "https://app.example/upgrade?checkout=cancelled",
		});
	});
});

describe("StripeBillingProvider.describeOffer", () => {
	function providerWith(retrieve: () => Promise<unknown>) {
		const calls = { count: 0 };
		const client = {
			prices: {
				retrieve: async () => {
					calls.count++;
					return retrieve();
				},
			},
		} as unknown as InstanceType<typeof Stripe>;
		return { provider: new StripeBillingProvider(SETTINGS, client), calls };
	}

	it("reads the pass price once and serves it from cache", async () => {
		const { provider, calls } = providerWith(async () => ({ unit_amount: 2999, currency: "eur" }));
		expect(await provider.describeOffer("pro_year_pass")).toEqual({ amount: 2999, currency: "eur" });
		expect(await provider.describeOffer("pro_year_pass")).toEqual({ amount: 2999, currency: "eur" });
		expect(calls.count).toBe(1);
	});

	it("answers null when Stripe fails, without asking again on every read", async () => {
		const { provider, calls } = providerWith(async () => {
			throw new Error("No such price");
		});
		expect(await provider.describeOffer("pro_year_pass")).toBeNull();
		expect(await provider.describeOffer("pro_year_pass")).toBeNull();
		expect(calls.count).toBe(1);
	});
});
