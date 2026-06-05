import { describe, expect, it } from "bun:test";
import { getDict } from "./content";
import { DEFAULT_LOCALE, localeFromHost, SELF_HOST, SISTER_HOST } from "./i18n";

describe("localeFromHost", () => {
	it("maps routess.com hosts to en", () => {
		expect(localeFromHost("routess.com")).toBe("en");
		expect(localeFromHost("www.routess.com")).toBe("en");
		expect(localeFromHost("ROUTESS.COM")).toBe("en");
		expect(localeFromHost("routess.com:3002")).toBe("en");
	});

	it("maps routess.be hosts to nl", () => {
		expect(localeFromHost("routess.be")).toBe("nl");
		expect(localeFromHost("www.routess.be")).toBe("nl");
		expect(localeFromHost("routess.be:3002")).toBe("nl");
	});

	it("falls back to default locale for unknown hosts", () => {
		expect(localeFromHost("localhost")).toBe(DEFAULT_LOCALE);
		expect(localeFromHost(undefined)).toBe(DEFAULT_LOCALE);
		expect(localeFromHost(null)).toBe(DEFAULT_LOCALE);
		expect(localeFromHost("example.com")).toBe(DEFAULT_LOCALE);
	});
});

describe("hostname maps", () => {
	it("self/sister hosts are mirrors", () => {
		expect(SELF_HOST.en).toBe(SISTER_HOST.nl);
		expect(SELF_HOST.nl).toBe(SISTER_HOST.en);
	});
});

describe("dictionaries", () => {
	it("en and nl have identical structure", () => {
		const en = getDict("en");
		const nl = getDict("nl");
		expect(Object.keys(en).sort()).toEqual(Object.keys(nl).sort());
		expect(en.hero.headlineLines.length).toBe(nl.hero.headlineLines.length);
		expect(en.mapStyles.items.length).toBe(nl.mapStyles.items.length);
		expect(en.outside.bullets.length).toBe(nl.outside.bullets.length);
		expect(en.surface.buckets.length).toBe(nl.surface.buckets.length);
		expect(en.pricing.freePerks.length).toBe(nl.pricing.freePerks.length);
		expect(en.pricing.proPerks.length).toBe(nl.pricing.proPerks.length);
		expect(en.dev.sections.length).toBe(nl.dev.sections.length);
	});

	it("dictionaries contain non-empty content", () => {
		const en = getDict("en");
		expect(en.meta.landing.title.length).toBeGreaterThan(0);
		expect(en.hero.body.length).toBeGreaterThan(20);
		const nl = getDict("nl");
		expect(nl.meta.landing.title.length).toBeGreaterThan(0);
		expect(nl.hero.body.length).toBeGreaterThan(20);
	});
});
