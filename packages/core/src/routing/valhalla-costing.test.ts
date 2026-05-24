import { describe, expect, it } from "bun:test";
import { DEFAULT_CYCLE_PREFERENCES, DEFAULT_RUN_PREFERENCES, DEFAULT_WALK_PREFERENCES } from "./preferences";
import type { HillPreference, SurfaceType } from "./types";
import { valhallaCostingFromPreferences, valhallaCostingModelForActivity } from "./valhalla-costing";

describe("valhallaCostingModelForActivity", () => {
	it("maps cycle to bicycle", () => {
		expect(valhallaCostingModelForActivity("cycle")).toBe("bicycle");
	});
	it("maps run to pedestrian", () => {
		expect(valhallaCostingModelForActivity("run")).toBe("pedestrian");
	});
	it("maps walk to pedestrian", () => {
		expect(valhallaCostingModelForActivity("walk")).toBe("pedestrian");
	});
});

describe("valhallaCostingFromPreferences — cycle", () => {
	it("translates default cycle prefs to bicycle costing", () => {
		const req = valhallaCostingFromPreferences("cycle", DEFAULT_CYCLE_PREFERENCES);
		expect(req.costing).toBe("bicycle");
		expect("bicycle" in req.costing_options).toBe(true);
	});

	it("does not send a bicycle_type (Valhalla defaults it to Hybrid)", () => {
		const req = valhallaCostingFromPreferences("cycle", DEFAULT_CYCLE_PREFERENCES);
		const b = (req.costing_options as { bicycle: Record<string, unknown> }).bicycle;
		expect("bicycle_type" in b).toBe(false);
	});

	it("orders use_hills monotonically: flat < mixed < hilly", () => {
		const useHills = (h: HillPreference) => {
			const prefs = { ...DEFAULT_CYCLE_PREFERENCES, hillPreference: h };
			const req = valhallaCostingFromPreferences("cycle", prefs);
			return (req.costing_options as { bicycle: { use_hills: number } }).bicycle.use_hills;
		};
		expect(useHills("flat")).toBeLessThan(useHills("mixed"));
		expect(useHills("mixed")).toBeLessThan(useHills("hilly"));
	});

	it("orders use_tracks monotonically: paved < mixed < unpaved", () => {
		const useTracks = (s: SurfaceType) => {
			const prefs = { ...DEFAULT_CYCLE_PREFERENCES, surfacePreference: s };
			const req = valhallaCostingFromPreferences("cycle", prefs);
			return (req.costing_options as { bicycle: { use_tracks: number } }).bicycle.use_tracks;
		};
		expect(useTracks("paved")).toBeLessThan(useTracks("mixed"));
		expect(useTracks("mixed")).toBeLessThan(useTracks("unpaved"));
	});

	it("orders avoid_bad_surfaces inversely: paved > mixed > unpaved", () => {
		const avoid = (s: SurfaceType) => {
			const prefs = { ...DEFAULT_CYCLE_PREFERENCES, surfacePreference: s };
			const req = valhallaCostingFromPreferences("cycle", prefs);
			return (req.costing_options as { bicycle: { avoid_bad_surfaces: number } }).bicycle.avoid_bad_surfaces;
		};
		expect(avoid("paved")).toBeGreaterThan(avoid("mixed"));
		expect(avoid("mixed")).toBeGreaterThan(avoid("unpaved"));
	});

	it("zeroes use_ferry when avoidFerries is true", () => {
		const reqAvoid = valhallaCostingFromPreferences("cycle", { ...DEFAULT_CYCLE_PREFERENCES, avoidFerries: true });
		const reqAllow = valhallaCostingFromPreferences("cycle", { ...DEFAULT_CYCLE_PREFERENCES, avoidFerries: false });
		const a = (reqAvoid.costing_options as { bicycle: { use_ferry: number } }).bicycle.use_ferry;
		const b = (reqAllow.costing_options as { bicycle: { use_ferry: number } }).bicycle.use_ferry;
		expect(a).toBe(0);
		expect(b).toBeGreaterThan(0);
	});

	it("lowers use_roads when avoidHighways is true", () => {
		const reqAvoid = valhallaCostingFromPreferences("cycle", { ...DEFAULT_CYCLE_PREFERENCES, avoidHighways: true });
		const reqAllow = valhallaCostingFromPreferences("cycle", { ...DEFAULT_CYCLE_PREFERENCES, avoidHighways: false });
		const a = (reqAvoid.costing_options as { bicycle: { use_roads: number } }).bicycle.use_roads;
		const b = (reqAllow.costing_options as { bicycle: { use_roads: number } }).bicycle.use_roads;
		expect(a).toBeLessThan(b);
	});
});

describe("valhallaCostingFromPreferences — pedestrian", () => {
	it("translates run prefs to pedestrian costing", () => {
		const req = valhallaCostingFromPreferences("run", DEFAULT_RUN_PREFERENCES);
		expect(req.costing).toBe("pedestrian");
		expect("pedestrian" in req.costing_options).toBe(true);
	});

	it("translates walk prefs to pedestrian costing", () => {
		const req = valhallaCostingFromPreferences("walk", DEFAULT_WALK_PREFERENCES);
		expect(req.costing).toBe("pedestrian");
	});

	it("does not include bicycle options for pedestrian costing", () => {
		const req = valhallaCostingFromPreferences("walk", DEFAULT_WALK_PREFERENCES);
		expect("bicycle" in req.costing_options).toBe(false);
	});

	it("forwards walking_speed when provided", () => {
		const req = valhallaCostingFromPreferences("walk", DEFAULT_WALK_PREFERENCES, { walkingSpeedMps: 1.6 });
		const p = (req.costing_options as { pedestrian: { walking_speed?: number } }).pedestrian;
		expect(p.walking_speed).toBe(1.6);
	});

	it("omits walking_speed when not provided or invalid", () => {
		const req = valhallaCostingFromPreferences("walk", DEFAULT_WALK_PREFERENCES);
		const p = (req.costing_options as { pedestrian: { walking_speed?: number } }).pedestrian;
		expect(p.walking_speed).toBeUndefined();

		const req2 = valhallaCostingFromPreferences("walk", DEFAULT_WALK_PREFERENCES, { walkingSpeedMps: -1 });
		const p2 = (req2.costing_options as { pedestrian: { walking_speed?: number } }).pedestrian;
		expect(p2.walking_speed).toBeUndefined();
	});

	it("orders use_tracks monotonically for pedestrian: paved < mixed < unpaved", () => {
		const useTracks = (s: SurfaceType) => {
			const prefs = { ...DEFAULT_WALK_PREFERENCES, surfacePreference: s };
			const req = valhallaCostingFromPreferences("walk", prefs);
			return (req.costing_options as { pedestrian: { use_tracks: number } }).pedestrian.use_tracks;
		};
		expect(useTracks("paved")).toBeLessThan(useTracks("mixed"));
		expect(useTracks("mixed")).toBeLessThan(useTracks("unpaved"));
	});
});
