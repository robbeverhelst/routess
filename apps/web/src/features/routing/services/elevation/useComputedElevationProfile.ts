import type { Coordinate, ElevationProfilePoint } from "@routess/core";
import { useEffect, useState } from "react";
import { Logger } from "@/lib/logger";
import { getDefaultElevationService } from "./defaultService";

interface ComputedProfile {
	profile: ElevationProfilePoint[] | null;
	loading: boolean;
}

// Computes an elevation profile for an arbitrary polyline (e.g., a saved
// route's stored geometry). Re-runs only when `key` changes — callers should
// pass a stable identifier like `route.id` rather than the geometry array
// itself, which would change reference every render.
export function useComputedElevationProfile(geometry: Coordinate[] | null | undefined, key: string): ComputedProfile {
	const [profile, setProfile] = useState<ElevationProfilePoint[] | null>(null);
	const [loading, setLoading] = useState(false);

	// `geometry` is read inside the effect but intentionally not in the dep
	// array — array references change every render. `key` (typically route.id)
	// is the stable signal for "the geometry actually changed".
	// biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
	useEffect(() => {
		if (!geometry || geometry.length < 2) {
			setProfile(null);
			setLoading(false);
			return;
		}

		const controller = new AbortController();
		setLoading(true);
		setProfile(null);

		getDefaultElevationService()
			.sampleAndCompute(geometry, { signal: controller.signal })
			.then((result) => {
				if (controller.signal.aborted) return;
				setProfile(result.profile);
			})
			.catch((err) => {
				if (controller.signal.aborted) return;
				Logger.warn("[useComputedElevationProfile] sampling failed:", err);
				setProfile(null);
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});

		return () => controller.abort();
	}, [key]);

	return { profile, loading };
}
