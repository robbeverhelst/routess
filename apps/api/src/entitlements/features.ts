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
	// Saving past a free cap on POST /routes; today there is no cap.
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

// Free mirrors what the hosted app gives every User today, so switching
// billing on still gates nothing. Answering ADR 0039 means moving Features out
// of free; nothing else has to change for can() to start saying no.
export const PLAN_FEATURES: PlanFeatureMatrix = {
	free: FEATURES,
	pro: FEATURES,
};

export function isFeature(value: string): value is Feature {
	return (FEATURES as readonly string[]).includes(value);
}
