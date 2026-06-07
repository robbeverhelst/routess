import type { Coordinate } from "@routess/core";
import { Logger } from "@/lib/logger";
import { getDefaultElevationService } from "../routing/services/elevation";

// Candidate cards show ElevationGain; it is display-only (never scored, see
// ADR-0029) so sampling failures degrade to a blank stat, not an error.
export async function computeElevationForCandidate(geometry: Coordinate[]): Promise<number | null> {
	if (geometry.length < 2) return null;
	try {
		const result = await getDefaultElevationService().sampleAndCompute(geometry, { maxSamples: 128 });
		return Math.round(result.gainMeters);
	} catch (err) {
		Logger.warn("[Generation] candidate elevation sampling failed:", err);
		return null;
	}
}
