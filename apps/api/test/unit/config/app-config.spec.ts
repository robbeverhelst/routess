import { getAppConfig } from "../../../src/config/app-config";

describe("getAppConfig", () => {
	const originalNodeEnv = process.env.NODE_ENV;
	const originalFrontendUrl = process.env.FRONTEND_URL;
	const originalFrontendUrls = process.env.FRONTEND_URLS;
	const originalJwtSecret = process.env.JWT_SECRET;
	const originalBillingEnabled = process.env.BILLING_ENABLED;
	const originalBillingProvider = process.env.BILLING_PROVIDER;

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

		if (originalBillingEnabled === undefined) {
			delete process.env.BILLING_ENABLED;
		} else {
			process.env.BILLING_ENABLED = originalBillingEnabled;
		}

		if (originalBillingProvider === undefined) {
			delete process.env.BILLING_PROVIDER;
		} else {
			process.env.BILLING_PROVIDER = originalBillingProvider;
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

	it("keeps billing off unless BILLING_ENABLED is set", () => {
		delete process.env.BILLING_ENABLED;
		delete process.env.BILLING_PROVIDER;

		expect(getAppConfig().billing).toEqual({ enabled: false, provider: null });
	});

	it("parses the billing flag and a known provider, ignoring unknown ones", () => {
		process.env.BILLING_ENABLED = "true";
		process.env.BILLING_PROVIDER = " Mollie ";
		expect(getAppConfig().billing).toEqual({ enabled: true, provider: "mollie" });

		process.env.BILLING_PROVIDER = "paypal";
		expect(getAppConfig().billing.provider).toBeNull();
	});
});
