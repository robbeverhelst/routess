import type { SurfaceBucket, SurfaceType } from "./types";

// Valhalla edge.surface strings → SurfaceBucket. Unknown strings classify as
// unpaved (the cautious default for a routing preference check).
const VALHALLA_SURFACE_TO_BUCKET: Record<string, SurfaceBucket> = {
	paved_smooth: "paved",
	paved: "paved",
	paved_rough: "paved",
	compacted: "compacted",
	dirt: "unpaved",
	gravel: "unpaved",
	sand: "unpaved",
	path: "path",
	impassable: "path",
};

export function bucketFromValhallaSurface(surface: string | undefined): SurfaceBucket {
	return VALHALLA_SURFACE_TO_BUCKET[surface ?? ""] ?? "unpaved";
}

const BUCKET_TO_TYPE: Record<SurfaceBucket, SurfaceType> = {
	paved: "paved",
	compacted: "mixed",
	unpaved: "unpaved",
	path: "unpaved",
};

export function bucketSurfaceType(bucket: SurfaceBucket): SurfaceType {
	return BUCKET_TO_TYPE[bucket];
}

export function bucketMatchesPreference(bucket: SurfaceBucket, pref: SurfaceType): boolean {
	if (pref === "mixed") return true;
	// Compacted gravel is the canonical unpaved riding surface even though it
	// renders as its own bucket; only tarmac violates the unpaved preference.
	if (pref === "unpaved") return bucket !== "paved";
	return BUCKET_TO_TYPE[bucket] === pref;
}

// Fraction (0..1) of route distance that violates the preference.
// "mixed" is permissive; nothing ever violates it.
export function surfaceMismatchFraction(metersByBucket: Record<SurfaceBucket, number>, pref: SurfaceType): number {
	if (pref === "mixed") return 0;
	let total = 0;
	let violating = 0;
	for (const bucket of Object.keys(metersByBucket) as SurfaceBucket[]) {
		const m = metersByBucket[bucket];
		total += m;
		if (!bucketMatchesPreference(bucket, pref)) violating += m;
	}
	if (total <= 0) return 0;
	return violating / total;
}

export const SURFACE_MISMATCH_THRESHOLD = 0.05;

export function isSurfaceMismatch(metersByBucket: Record<SurfaceBucket, number>, pref: SurfaceType): boolean {
	return surfaceMismatchFraction(metersByBucket, pref) > SURFACE_MISMATCH_THRESHOLD;
}
