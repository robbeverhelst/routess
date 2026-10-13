import type { UserPlan } from "../entities/user.entity";

// Every Feature a Plan or an Entitlement can unlock (CONTEXT.md "Feature",
// ADR 0039). Each one names something the hosted app already does; the ADR
// lists where it lives in the code. Things that cannot be enforced server-side
// (the node-network map overlay is public tiles, elevation is computed in the
// browser) are deliberately absent.
export const FEATURES = [
	// POST /generation (RouteGeneration, ADR 0029).
	"route_generation",
	// preferNodeNetworks on POST /generation (ADR 0037).
	"node_network_generation",
	// Saving past the free cap (FREE_SAVED_ROUTE_LIMIT) on POST /routes.
	"unlimited_saved_routes",
	// /collections (ADR 0024).
	"collections",
	// GET /routes/:ref/gpx and the web/CLI GPX downloads.
	"gpx_export",
	// POST /routing/cues (turn-by-turn, ADR 0038).
	"navigation",
	// /auth/tokens, the CLI and agent access (ADR 0022).
	"personal_access_tokens",
] as const;
export type Feature = (typeof FEATURES)[number];

export type PlanFeatureMatrix = Readonly<Record<UserPlan, readonly Feature[]>>;

// What each Plan includes (ADR 0039, decided 2026-10-13). Free keeps route
// generation at the free quota, GPX export and saving up to
// FREE_SAVED_ROUTE_LIMIT Routes; everything else is Pro. With billing off
// can() ignores this and unlocks everything.
export const PLAN_FEATURES: PlanFeatureMatrix = {
	free: ["route_generation", "gpx_export"],
	pro: FEATURES,
};
