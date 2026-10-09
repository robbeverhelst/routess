import { createBillingProvider } from "../../../src/billing/billing.module";

describe("createBillingProvider", () => {
	it("returns no provider while billing is off", () => {
		expect(createBillingProvider({ enabled: false, provider: "stripe" })).toBeNull();
	});

	// No provider implementation ships yet (ADR 0039), so turning billing on
	// must stop startup rather than run an API that cannot take a payment.
	it("refuses to start when billing is on", () => {
		expect(() => createBillingProvider({ enabled: true, provider: "mollie" })).toThrow(
			"BILLING_ENABLED=true but no billing provider is implemented yet (BILLING_PROVIDER=mollie)",
		);
		expect(() => createBillingProvider({ enabled: true, provider: null })).toThrow(
			"BILLING_ENABLED=true but no billing provider is implemented yet",
		);
	});
});
