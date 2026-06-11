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

// A SurfaceType is a bias, not a guarantee, and the two strict preferences
// are not symmetric: a paved route can realistically be ~100% paved, while
// an unpaved ride always needs paved connectors between the good parts —
// 30-60% tarmac is normal gravel reality in most regions. The warning only
// fires when the preference visibly failed: a "paved" route with real gravel
// in it, or an "unpaved" ride that is essentially all tarmac. Calibrated on
// Flanders reality, where a normal unpaved-preferring walk still measures
// 60-70% paved connectors.
export const SURFACE_MISMATCH_THRESHOLDS: Record<SurfaceType, number> = {
	mixed: 1,
	paved: 0.2,
	unpaved: 0.75,
};

export function isSurfaceMismatch(metersByBucket: Record<SurfaceBucket, number>, pref: SurfaceType): boolean {
	return surfaceMismatchFraction(metersByBucket, pref) > SURFACE_MISMATCH_THRESHOLDS[pref];
}

// Surface composition persisted on a saved Route (ADR 0032): the result of
// classifying the RoutePath's edges once, so viewing a route never re-calls
// the provider. Segments index into the matched shape polyline instead of
// embedding coordinates, keeping the stored JSON small.
export interface SurfaceCompositionSegment {
	surface: SurfaceBucket;
	begin: number;
	end: number;
	distanceStartMeters: number;
	distanceEndMeters: number;
}

export interface SurfaceComposition {
	meters: Record<SurfaceBucket, number>;
	total: number;
	// Valhalla's matched shape (polyline6); segment indices refer to it.
	shape?: string;
	segments: SurfaceCompositionSegment[];
}

export interface ValhallaSurfaceEdge {
	surface?: string;
	length?: number;
	begin_shape_index?: number;
	end_shape_index?: number;
}

// Pure builder shared by the web's live breakdown and the API's save-time
// derivation, so both classify identically.
export function surfaceCompositionFromEdges(edges: ValhallaSurfaceEdge[], shape?: string): SurfaceComposition | null {
	if (!Array.isArray(edges) || edges.length === 0) return null;
	const meters: Record<SurfaceBucket, number> = { paved: 0, compacted: 0, unpaved: 0, path: 0 };
	let total = 0;
	for (const edge of edges) {
		if (typeof edge.length !== "number") continue;
		const lengthMeters = edge.length * 1000;
		meters[bucketFromValhallaSurface(edge.surface)] += lengthMeters;
		total += lengthMeters;
	}
	if (total <= 0) return null;

	const segments: SurfaceCompositionSegment[] = [];
	let current: SurfaceCompositionSegment | null = null;
	let cumulativeMeters = 0;
	for (const edge of edges) {
		const begin = edge.begin_shape_index;
		const end = edge.end_shape_index;
		if (typeof begin !== "number" || typeof end !== "number" || end <= begin) continue;
		const bucket = bucketFromValhallaSurface(edge.surface);
		const edgeMeters = typeof edge.length === "number" ? edge.length * 1000 : 0;
		const edgeStart = cumulativeMeters;
		cumulativeMeters += edgeMeters;

		if (current && current.surface === bucket && begin <= current.end) {
			current.end = Math.max(current.end, end);
			current.distanceEndMeters = cumulativeMeters;
		} else {
			if (current) segments.push(current);
			current = {
				surface: bucket,
				begin,
				end,
				distanceStartMeters: edgeStart,
				distanceEndMeters: cumulativeMeters,
			};
		}
	}
	if (current) segments.push(current);

	return { meters, total, shape, segments };
}
