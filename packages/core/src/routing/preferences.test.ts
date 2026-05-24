import { describe, expect, it } from "bun:test";
import {
	DEFAULT_CYCLE_PREFERENCES,
	DEFAULT_ROUTING_DEFAULTS,
	defaultPreferencesForActivity,
	mergeRoutingDefaults,
	normalizeRoutingDefaults,
	normalizeRoutingPreferences,
} from "./preferences";
import type { RoutingPreferences } from "./types";

describe("defaultPreferencesForActivity", () => {
	it("returns a fresh object (mutation-safe)", () => {
		const a = defaultPreferencesForActivity("cycle");
		const b = defaultPreferencesForActivity("cycle");
		expect(a).not.toBe(b);
		a.surfacePreference = "paved";
		expect(b.surfacePreference).toBe("mixed");
	});

	it("has the same shape across activities", () => {
		expect(Object.keys(defaultPreferencesForActivity("cycle")).sort()).toEqual(
			Object.keys(defaultPreferencesForActivity("run")).sort(),
		);
	});
});

describe("normalizeRoutingPreferences", () => {
	it("returns activity defaults for empty input", () => {
		expect(normalizeRoutingPreferences("cycle", null)).toEqual(DEFAULT_CYCLE_PREFERENCES);
		expect(normalizeRoutingPreferences("cycle", undefined)).toEqual(DEFAULT_CYCLE_PREFERENCES);
		expect(normalizeRoutingPreferences("cycle", {})).toEqual(DEFAULT_CYCLE_PREFERENCES);
	});

	it("rejects invalid enum values and falls back to defaults", () => {
		const result = normalizeRoutingPreferences("cycle", {
			surfacePreference: "asphalt" as unknown as RoutingPreferences["surfacePreference"],
			hillPreference: "rolling" as unknown as RoutingPreferences["hillPreference"],
		});
		expect(result.surfacePreference).toBe("mixed");
		expect(result.hillPreference).toBe("mixed");
	});

	it("rejects non-boolean avoidFerries/avoidHighways", () => {
		const result = normalizeRoutingPreferences("cycle", {
			avoidFerries: "yes" as unknown as RoutingPreferences["avoidFerries"],
		});
		expect(result.avoidFerries).toBe(true);
	});
});

describe("normalizeRoutingDefaults", () => {
	it("returns full defaults for null input", () => {
		expect(normalizeRoutingDefaults(null)).toEqual(DEFAULT_ROUTING_DEFAULTS);
	});

	it("fills in missing activities", () => {
		const result = normalizeRoutingDefaults({ cycle: { surfacePreference: "paved" } });
		expect(result.cycle.surfacePreference).toBe("paved");
		expect(result.run).toEqual(DEFAULT_ROUTING_DEFAULTS.run);
		expect(result.walk).toEqual(DEFAULT_ROUTING_DEFAULTS.walk);
	});
});

describe("mergeRoutingDefaults", () => {
	it("overlays update onto current per activity", () => {
		const current = normalizeRoutingDefaults(null);
		const result = mergeRoutingDefaults(current, { cycle: { surfacePreference: "unpaved" } });
		expect(result.cycle.surfacePreference).toBe("unpaved");
		// Other cycle fields preserved
		expect(result.cycle.hillPreference).toBe(DEFAULT_CYCLE_PREFERENCES.hillPreference);
		// Other activities untouched
		expect(result.run).toEqual(DEFAULT_ROUTING_DEFAULTS.run);
	});

	it("treats null current as full defaults base", () => {
		const result = mergeRoutingDefaults(null, { run: { hillPreference: "hilly" } });
		expect(result.run.hillPreference).toBe("hilly");
		expect(result.cycle).toEqual(DEFAULT_ROUTING_DEFAULTS.cycle);
	});
});
