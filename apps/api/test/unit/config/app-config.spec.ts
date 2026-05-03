import { getAppConfig } from "../../../src/config/app-config";

describe("getAppConfig", () => {
	const originalFrontendUrl = process.env.FRONTEND_URL;
	const originalFrontendUrls = process.env.FRONTEND_URLS;

	afterEach(() => {
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
	});

	it("parses FRONTEND_URLS into an allowlist", () => {
		process.env.FRONTEND_URLS = "https://routess.com, https://routess.be\nhttps://maps.routess.com";
		process.env.FRONTEND_URL = "https://legacy.routess.com";

		const config = getAppConfig();

		expect(config.app.frontendUrl).toBe("https://routess.com");
		expect(config.app.frontendUrls).toEqual([
			"https://routess.com",
			"https://routess.be",
			"https://maps.routess.com",
		]);
	});

	it("falls back to FRONTEND_URL when FRONTEND_URLS is not set", () => {
		delete process.env.FRONTEND_URLS;
		process.env.FRONTEND_URL = "https://routess.be";

		const config = getAppConfig();

		expect(config.app.frontendUrl).toBe("https://routess.be");
		expect(config.app.frontendUrls).toEqual(["https://routess.be"]);
	});
});
