import { describe, expect, it } from "bun:test";
import { REGIONAL_HUB_MIN_INDEXABLE_ROUTES } from "@routess/core";
import { HUB_ACTIVITIES, HUB_PATH_PREFIXES, hubPath, isLiveHub } from "./hubs";

describe("hubPath", () => {
	it("uses the localized keyword segment per host language (ADR 0017)", () => {
		expect(hubPath("cycle", "gent", "nl")).toBe("/fietsroutes/gent");
		expect(hubPath("cycle", "gent", "en")).toBe("/cycling-routes/gent");
	});

	it("keeps the place slug identical across locales so hreflang pairs stay derivable", () => {
		const nl = hubPath("cycle", "de-haan", "nl");
		const en = hubPath("cycle", "de-haan", "en");
		expect(nl.split("/").pop()).toBe(en.split("/").pop());
	});
});

describe("HUB_PATH_PREFIXES", () => {
	it("defines both locales for every hub activity", () => {
		for (const activity of HUB_ACTIVITIES) {
			expect(HUB_PATH_PREFIXES[activity].en).toBeTruthy();
			expect(HUB_PATH_PREFIXES[activity].nl).toBeTruthy();
			expect(HUB_PATH_PREFIXES[activity].en).not.toBe(HUB_PATH_PREFIXES[activity].nl);
		}
	});
});

describe("isLiveHub (thin-content threshold)", () => {
	it("rejects places below the RegionalHub threshold", () => {
		expect(isLiveHub(REGIONAL_HUB_MIN_INDEXABLE_ROUTES - 1)).toBe(false);
		expect(isLiveHub(0)).toBe(false);
	});

	it("accepts places at or above the threshold", () => {
		expect(isLiveHub(REGIONAL_HUB_MIN_INDEXABLE_ROUTES)).toBe(true);
		expect(isLiveHub(REGIONAL_HUB_MIN_INDEXABLE_ROUTES + 10)).toBe(true);
	});
});
