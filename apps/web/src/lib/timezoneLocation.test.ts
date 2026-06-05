import { afterEach, describe, expect, it, vi } from "vitest";
import { getLocationForTimezone, getTimezoneFallbackLocation } from "@/lib/timezoneLocation";

describe("getLocationForTimezone", () => {
	it("returns [lng, lat] for a canonical zone", () => {
		const location = getLocationForTimezone("Europe/Brussels");
		expect(location).not.toBeNull();
		const [lng, lat] = location as [number, number];
		expect(lng).toBeCloseTo(4.33, 1);
		expect(lat).toBeCloseTo(50.83, 1);
	});

	it("resolves legacy aliases to their canonical zone", () => {
		expect(getLocationForTimezone("Europe/Kiev")).toEqual(getLocationForTimezone("Europe/Kyiv"));
		expect(getLocationForTimezone("Asia/Calcutta")).toEqual(getLocationForTimezone("Asia/Kolkata"));
	});

	it("returns null for unknown zones", () => {
		expect(getLocationForTimezone("Mars/Olympus_Mons")).toBeNull();
		expect(getLocationForTimezone("")).toBeNull();
	});
});

describe("getTimezoneFallbackLocation", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("uses the browser-reported timezone", () => {
		vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
			resolvedOptions: () => ({ timeZone: "America/New_York" }),
		} as unknown as Intl.DateTimeFormat);

		const location = getTimezoneFallbackLocation();
		expect(location).not.toBeNull();
		const [lng, lat] = location as [number, number];
		expect(lng).toBeCloseTo(-74.01, 1);
		expect(lat).toBeCloseTo(40.71, 1);
	});

	it("returns null when the timezone is unknown", () => {
		vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
			resolvedOptions: () => ({ timeZone: "Not/A_Zone" }),
		} as unknown as Intl.DateTimeFormat);

		expect(getTimezoneFallbackLocation()).toBeNull();
	});

	it("returns null when Intl throws", () => {
		vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
			throw new Error("boom");
		});

		expect(getTimezoneFallbackLocation()).toBeNull();
	});
});
