import { afterEach, describe, expect, it, vi } from "vitest";
import { isBotClient, isBotUserAgent } from "./bots";

// The single noisiest GlitchTip issue was Googlebot failing to register the
// service worker, so that UA is the one that must not slip through.
const GOOGLEBOT =
	"Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const REAL_BROWSERS = [
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
	"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
	"Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
];

describe("isBotUserAgent", () => {
	it("catches Googlebot", () => {
		expect(isBotUserAgent(GOOGLEBOT)).toBe(true);
	});

	it.each([
		"Bingbot/2.0",
		"facebookexternalhit/1.1",
		"Chrome-Lighthouse",
		"HeadlessChrome/140.0.0.0",
	])("catches %s", (ua) => {
		expect(isBotUserAgent(ua)).toBe(true);
	});

	it.each(REAL_BROWSERS)("leaves real browsers alone: %s", (ua) => {
		expect(isBotUserAgent(ua)).toBe(false);
	});

	it("treats a missing user agent as human", () => {
		expect(isBotUserAgent(undefined)).toBe(false);
	});
});

describe("isBotClient", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const withNavigator = (nav: unknown) => vi.stubGlobal("navigator", nav);

	it("reads the live user agent", () => {
		withNavigator({ userAgent: GOOGLEBOT });
		expect(isBotClient()).toBe(true);

		withNavigator({ userAgent: REAL_BROWSERS[0] });
		expect(isBotClient()).toBe(false);
	});

	it("treats an automated browser as a bot even with a human user agent", () => {
		withNavigator({ userAgent: REAL_BROWSERS[0], webdriver: true });
		expect(isBotClient()).toBe(true);
	});

	it("does not trip on webdriver being present but false", () => {
		withNavigator({ userAgent: REAL_BROWSERS[0], webdriver: false });
		expect(isBotClient()).toBe(false);
	});

	it("is false where there is no navigator at all", () => {
		withNavigator(undefined);
		expect(isBotClient()).toBe(false);
	});
});
