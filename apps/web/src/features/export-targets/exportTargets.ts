import { getRuntimeConfig } from "@/lib/runtime-config";

// Export targets push a saved route to an external service (Garmin Connect,
// Strava, ...) next to the plain GPX download. This is the provider-agnostic
// seam only: no adapters are registered until a provider approves our API
// access, so the "Send to" buttons stay hidden. See
// data/routess-retention/sync-apply.md for the provider research and design.

export type ExportTargetId = "garmin" | "strava";

export const EXPORT_TARGET_IDS: readonly ExportTargetId[] = ["garmin", "strava"];

export interface ExportTargetResult {
	/** Link to the route on the provider's side, for a "View on ..." action. */
	externalUrl?: string;
}

export interface ExportTarget {
	id: ExportTargetId;
	/** Brand name shown in "Send to {target}". Not translated. */
	displayName: string;
	send(routeId: number): Promise<ExportTargetResult>;
}

export type ExportTargetRegistry = ReadonlyMap<ExportTargetId, ExportTarget>;

// Adapters register here once built. Empty on purpose.
const registry: ExportTargetRegistry = new Map();

/**
 * Parse the VITE_EXPORT_TARGETS flag: a comma-separated list of target ids.
 * Unset, empty or unknown ids mean off, so the default is no export targets.
 */
export function parseExportTargetsFlag(raw: string | undefined): ExportTargetId[] {
	if (!raw) return [];
	const ids = raw
		.split(",")
		.map((part) => part.trim().toLowerCase())
		.filter((part): part is ExportTargetId => (EXPORT_TARGET_IDS as readonly string[]).includes(part));
	return [...new Set(ids)];
}

/** Targets that are both switched on by the flag and have an adapter. */
export function getEnabledExportTargets(
	flag: string | undefined = getRuntimeConfig("VITE_EXPORT_TARGETS"),
	targets: ExportTargetRegistry = registry,
): ExportTarget[] {
	return parseExportTargetsFlag(flag).flatMap((id) => {
		const target = targets.get(id);
		return target ? [target] : [];
	});
}
