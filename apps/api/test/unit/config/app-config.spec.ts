import { getAppConfig } from "../../../src/config/app-config";

describe("getAppConfig", () => {
	const originalNodeEnv = process.env.NODE_ENV;
	const originalFrontendUrl = process.env.FRONTEND_URL;
	const originalFrontendUrls = process.env.FRONTEND_URLS;
	const originalJwtSecret = process.env.JWT_SECRET;
	// Billing and quota variables, restored wholesale after each test.
	const billingEnvNames = [
		"BILLING_ENABLED",
		"BILLING_PROVIDER",
		"BILLING_LAUNCHED_AT",
		"STRIPE_SECRET_KEY",
		"STRIPE_WEBHOOK_SECRET",
		"STRIPE_PRICE_PRO_YEAR_PASS",
		"GENERATION_QUOTA_PER_DAY",
		"GENERATION_QUOTA_PER_DAY_ANONYMOUS",
		"GENERATION_QUOTA_PER_DAY_FREE",
		"GENERATION_QUOTA_PER_DAY_PRO",
	] as const;
	const originalBillingEnv = Object.fromEntries(billingEnvNames.map((name) => [name, process.env[name]]));

	afterEach(() => {
		if (originalNodeEnv === undefined) {
			delete process.env.NODE_ENV;
		} else {
			process.env.NODE_ENV = originalNodeEnv;
		}

		if (originalFrontendUrl === undefined) {
			delete process.env.FRONTEND_URL;
		} else {
			process.env.FRONTEND_URL = originalFrontendUrl;
		}

		if (originalFrontendUrls === undefined) {
			delete process.env.FRONTEND_URLS;
		} else {
			process.env.FRONTEND_URLS = originalFrontendUrls;
		}

		if (originalJwtSecret === undefined) {
			delete process.env.JWT_SECRET;
		} else {
			process.env.JWT_SECRET = originalJwtSecret;
		}

		for (const name of billingEnvNames) {
			const original = originalBillingEnv[name];
			if (original === undefined) {
				delete process.env[name];
			} else {
				process.env[name] = original;
			}
		}
	});

	it("parses FRONTEND_URLS into an allowlist", () => {
		process.env.FRONTEND_URLS = "https://routess.com, https://routess.be\nhttps://maps.routess.com";
		process.env.FRONTEND_URL = "https://legacy.routess.com";

		const config = getAppConfig();

		expect(config.app.frontendUrl).toBe("https://routess.com");
		expect(config.app.frontendUrls).toEqual(["https://routess.com", "https://routess.be", "https://maps.routess.com"]);
	});

	it("falls back to FRONTEND_URL when FRONTEND_URLS is not set", () => {
		delete process.env.FRONTEND_URLS;
		process.env.FRONTEND_URL = "https://routess.be";

		const config = getAppConfig();

		expect(config.app.frontendUrl).toBe("https://routess.be");
		expect(config.app.frontendUrls).toEqual(["https://routess.be"]);
	});

	it("fails production startup when JWT_SECRET is missing", () => {
		process.env.NODE_ENV = "production";
		delete process.env.JWT_SECRET;

		expect(() => getAppConfig()).toThrow("JWT_SECRET must be set when NODE_ENV=production");
	});

	it("keeps billing off unless BILLING_ENABLED is set, with Stripe as the provider", () => {
		for (const name of billingEnvNames) delete process.env[name];

		expect(getAppConfig().billing).toEqual({
			enabled: false,
			provider: "stripe",
			launchedAt: null,
			stripe: { secretKey: "", webhookSecret: "", proYearPassPriceId: "" },
		});
	});

	it("parses the billing flag, launch moment and Stripe values, rejecting unknown providers", () => {
		process.env.BILLING_ENABLED = "true";
		process.env.BILLING_PROVIDER = " Stripe ";
		process.env.BILLING_LAUNCHED_AT = "2026-11-01T00:00:00Z";
		process.env.STRIPE_SECRET_KEY = " sk_test_x ";
		process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
		process.env.STRIPE_PRICE_PRO_YEAR_PASS = "price_x";
		expect(getAppConfig().billing).toEqual({
			enabled: true,
			provider: "stripe",
			launchedAt: new Date("2026-11-01T00:00:00Z"),
			stripe: { secretKey: "sk_test_x", webhookSecret: "whsec_x", proYearPassPriceId: "price_x" },
		});

		process.env.BILLING_PROVIDER = "mollie";
		expect(getAppConfig().billing.provider).toBeNull();

		process.env.BILLING_LAUNCHED_AT = "not a date";
		expect(getAppConfig().billing.launchedAt).toBeNull();
	});

	it("reads the generation quota per tier from config, defaulting to 1 / 3 / 50", () => {
		for (const name of billingEnvNames) delete process.env[name];
		expect(getAppConfig().quotas).toEqual({
			generationPerDay: 50,
			generationPerDayByTier: { anonymous: 1, free: 3, pro: 50 },
		});

		process.env.GENERATION_QUOTA_PER_DAY_ANONYMOUS = "0";
		process.env.GENERATION_QUOTA_PER_DAY_FREE = "5";
		process.env.GENERATION_QUOTA_PER_DAY_PRO = "100";
		expect(getAppConfig().quotas.generationPerDayByTier).toEqual({ anonymous: 0, free: 5, pro: 100 });
	});
});
