import { describe, expect, it } from "bun:test";
import {
	bucketMatchesPreference,
	bucketSurfaceType,
	isSurfaceMismatch,
	SURFACE_MISMATCH_THRESHOLD,
	surfaceMismatchFraction,
} from "./surface";
import type { SurfaceBucket } from "./types";

describe("bucketSurfaceType", () => {
	it("maps paved bucket to paved type", () => {
		expect(bucketSurfaceType("paved")).toBe("paved");
	});
	it("maps compacted bucket to mixed type", () => {
		expect(bucketSurfaceType("compacted")).toBe("mixed");
	});
	it("maps unpaved bucket to unpaved type", () => {
		expect(bucketSurfaceType("unpaved")).toBe("unpaved");
	});
	it("maps path bucket to unpaved type", () => {
		expect(bucketSurfaceType("path")).toBe("unpaved");
	});
});

describe("bucketMatchesPreference", () => {
	it("matches paved bucket against paved pref", () => {
		expect(bucketMatchesPreference("paved", "paved")).toBe(true);
	});
	it("rejects compacted bucket against paved pref", () => {
		expect(bucketMatchesPreference("compacted", "paved")).toBe(false);
	});
	it("rejects unpaved bucket against paved pref", () => {
		expect(bucketMatchesPreference("unpaved", "paved")).toBe(false);
	});
	it("rejects path bucket against paved pref", () => {
		expect(bucketMatchesPreference("path", "paved")).toBe(false);
	});
	it("matches unpaved bucket against unpaved pref", () => {
		expect(bucketMatchesPreference("unpaved", "unpaved")).toBe(true);
	});
	it("matches path bucket against unpaved pref (path counts as unpaved)", () => {
		expect(bucketMatchesPreference("path", "unpaved")).toBe(true);
	});
	it("rejects paved bucket against unpaved pref", () => {
		expect(bucketMatchesPreference("paved", "unpaved")).toBe(false);
	});
	it("treats mixed pref as permissive — matches all buckets", () => {
		expect(bucketMatchesPreference("paved", "mixed")).toBe(true);
		expect(bucketMatchesPreference("compacted", "mixed")).toBe(true);
		expect(bucketMatchesPreference("unpaved", "mixed")).toBe(true);
		expect(bucketMatchesPreference("path", "mixed")).toBe(true);
	});
});

describe("surfaceMismatchFraction", () => {
	const zero: Record<SurfaceBucket, number> = { paved: 0, compacted: 0, unpaved: 0, path: 0 };

	it("returns 0 when total distance is 0", () => {
		expect(surfaceMismatchFraction(zero, "paved")).toBe(0);
	});

	it("returns 0 for mixed pref regardless of composition", () => {
		expect(surfaceMismatchFraction({ ...zero, paved: 100, unpaved: 100 }, "mixed")).toBe(0);
	});

	it("returns 0 for a fully-paved route under paved pref", () => {
		expect(surfaceMismatchFraction({ ...zero, paved: 1000 }, "paved")).toBe(0);
	});

	it("returns 0.2 for 20% unpaved under paved pref", () => {
		expect(surfaceMismatchFraction({ ...zero, paved: 800, unpaved: 200 }, "paved")).toBeCloseTo(0.2);
	});

	it("counts compacted as a violation of paved pref", () => {
		expect(surfaceMismatchFraction({ ...zero, paved: 700, compacted: 300 }, "paved")).toBeCloseTo(0.3);
	});

	it("counts path as a match for unpaved pref", () => {
		expect(surfaceMismatchFraction({ ...zero, unpaved: 500, path: 500 }, "unpaved")).toBe(0);
	});
});

describe("isSurfaceMismatch", () => {
	const zero: Record<SurfaceBucket, number> = { paved: 0, compacted: 0, unpaved: 0, path: 0 };

	it("is false at exactly the threshold", () => {
		const violating = SURFACE_MISMATCH_THRESHOLD * 1000;
		const matching = 1000 - violating;
		expect(isSurfaceMismatch({ ...zero, paved: matching, unpaved: violating }, "paved")).toBe(false);
	});

	it("is true above the threshold", () => {
		expect(isSurfaceMismatch({ ...zero, paved: 900, unpaved: 100 }, "paved")).toBe(true);
	});

	it("is false below the threshold", () => {
		expect(isSurfaceMismatch({ ...zero, paved: 990, unpaved: 10 }, "paved")).toBe(false);
	});

	it("is always false for mixed pref", () => {
		expect(isSurfaceMismatch({ ...zero, paved: 1, unpaved: 999 }, "mixed")).toBe(false);
	});
});
