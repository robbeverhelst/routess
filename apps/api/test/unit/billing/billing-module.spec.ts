import { createBillingProvider } from "../../../src/billing/billing.module";
import { StripeBillingProvider } from "../../../src/billing/stripe-billing.provider";
import type { AppConfig } from "../../../src/config/app-config";

const STRIPE = { secretKey: "sk_test_x", webhookSecret: "whsec_x", proYearPassPriceId: "price_x" };
const LAUNCHED_AT = new Date("2026-11-01T00:00:00Z");

function billing(overrides: Partial<AppConfig["billing"]> = {}): AppConfig["billing"] {
	return { enabled: true, provider: "stripe", launchedAt: LAUNCHED_AT, stripe: STRIPE, ...overrides };
}

describe("createBillingProvider", () => {
	it("returns no provider while billing is off, whatever else is set", () => {
		expect(createBillingProvider(billing({ enabled: false }))).toBeNull();
		expect(
			createBillingProvider(
				billing({
					enabled: false,
					launchedAt: null,
					stripe: { secretKey: "", webhookSecret: "", proYearPassPriceId: "" },
				}),
			),
		).toBeNull();
	});

	it("builds the Stripe provider when every value is set", () => {
		expect(createBillingProvider(billing())).toBeInstanceOf(StripeBillingProvider);
	});

	// An API that cannot take a payment, or would skip the OG grant, must not boot.
	it("refuses to start with an unknown provider or a missing value, naming what is missing", () => {
		expect(() => createBillingProvider(billing({ provider: null }))).toThrow("BILLING_PROVIDER=stripe");
		expect(() =>
			createBillingProvider(
				billing({ launchedAt: null, stripe: { secretKey: "sk_test_x", webhookSecret: "", proYearPassPriceId: "" } }),
			),
		).toThrow(
			"BILLING_ENABLED=true but STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO_YEAR_PASS, BILLING_LAUNCHED_AT is not set",
		);
	});
});
