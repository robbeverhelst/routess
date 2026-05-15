import type { RouteActivity } from "../types";
import { isBikeType, isHillPreference, isSurfaceType, type RoutingDefaults, type RoutingPreferences } from "./types";

export const DEFAULT_CYCLE_PREFERENCES: RoutingPreferences = {
	surfacePreference: "mixed",
	hillPreference: "mixed",
	avoidFerries: true,
	avoidHighways: true,
	bikeType: "hybrid",
};

export const DEFAULT_RUN_PREFERENCES: RoutingPreferences = {
	surfacePreference: "mixed",
	hillPreference: "mixed",
	avoidFerries: true,
	avoidHighways: true,
};

export const DEFAULT_WALK_PREFERENCES: RoutingPreferences = {
	surfacePreference: "mixed",
	hillPreference: "mixed",
	avoidFerries: true,
	avoidHighways: true,
};

export const DEFAULT_ROUTING_DEFAULTS: RoutingDefaults = {
	cycle: DEFAULT_CYCLE_PREFERENCES,
	run: DEFAULT_RUN_PREFERENCES,
	walk: DEFAULT_WALK_PREFERENCES,
};

export function defaultPreferencesForActivity(activity: RouteActivity): RoutingPreferences {
	return { ...DEFAULT_ROUTING_DEFAULTS[activity] };
}

export function normalizeRoutingPreferences(
	activity: RouteActivity,
	input: Partial<RoutingPreferences> | null | undefined,
): RoutingPreferences {
	const base = defaultPreferencesForActivity(activity);
	if (!input) return base;

	const next: RoutingPreferences = {
		surfacePreference: isSurfaceType(input.surfacePreference) ? input.surfacePreference : base.surfacePreference,
		hillPreference: isHillPreference(input.hillPreference) ? input.hillPreference : base.hillPreference,
		avoidFerries: typeof input.avoidFerries === "boolean" ? input.avoidFerries : base.avoidFerries,
		avoidHighways: typeof input.avoidHighways === "boolean" ? input.avoidHighways : base.avoidHighways,
	};

	// bikeType only meaningful for cycle; ignore on run/walk
	if (activity === "cycle") {
		next.bikeType = isBikeType(input.bikeType) ? input.bikeType : base.bikeType;
	}

	return next;
}

export function normalizeRoutingDefaults(input: Partial<RoutingDefaults> | null | undefined): RoutingDefaults {
	return {
		cycle: normalizeRoutingPreferences("cycle", input?.cycle),
		run: normalizeRoutingPreferences("run", input?.run),
		walk: normalizeRoutingPreferences("walk", input?.walk),
	};
}

export type RoutingDefaultsPatch = Partial<Record<RouteActivity, Partial<RoutingPreferences>>>;

export function mergeRoutingDefaults(
	current: RoutingDefaults | null | undefined,
	update: RoutingDefaultsPatch | null | undefined,
): RoutingDefaults {
	const base = normalizeRoutingDefaults(current);
	if (!update) return base;
	return {
		cycle: normalizeRoutingPreferences("cycle", { ...base.cycle, ...update.cycle }),
		run: normalizeRoutingPreferences("run", { ...base.run, ...update.run }),
		walk: normalizeRoutingPreferences("walk", { ...base.walk, ...update.walk }),
	};
}
