import type { DomainErrorPayload } from "./index";

// The Pro gates (ADR 0039). The API answers a gated call with 403 FORBIDDEN
// and `details.reason` of `pro_required` (the Feature is Pro only) or
// `saved_route_limit` (free saves up to FREE_SAVED_ROUTE_LIMIT Routes). The
// web and the CLI branch on `details`, never on the message text.
export const PRO_GATED_FEATURES = [
	"node_network_generation",
	"navigation",
	"collections",
	"personal_access_tokens",
	"unlimited_saved_routes",
] as const;
export type ProGatedFeature = (typeof PRO_GATED_FEATURES)[number];

// How many Routes a free User may save. Users already past it keep every
// Route; only saving a new one is refused.
export const FREE_SAVED_ROUTE_LIMIT = 5;

export const PRO_GATE_MESSAGES: Readonly<Record<ProGatedFeature, string>> = {
	node_network_generation: "Knooppunt routes are part of Pro.",
	navigation: "Turn-by-turn navigation is part of Pro.",
	collections: "Creating collections and adding routes to them is part of Pro.",
	personal_access_tokens: "CLI and agent access is part of Pro.",
	unlimited_saved_routes: `Free saves up to ${FREE_SAVED_ROUTE_LIMIT} routes. Go Pro for unlimited.`,
};

export type ProGateDetails =
	| { reason: "pro_required"; feature: Exclude<ProGatedFeature, "unlimited_saved_routes">; upgrade: "pro" }
	| { reason: "saved_route_limit"; feature: "unlimited_saved_routes"; limit: number; upgrade: "pro" };

const isProGatedFeature = (value: unknown): value is ProGatedFeature =>
	typeof value === "string" && (PRO_GATED_FEATURES as readonly string[]).includes(value);

// The Pro gate a domain error carries, or null when it is some other error.
export const proGateOf = (
	error: Pick<DomainErrorPayload, "code" | "details"> | null | undefined,
): ProGateDetails | null => {
	if (error?.code !== "FORBIDDEN" || !error.details) return null;
	const { reason, feature } = error.details;
	if (!isProGatedFeature(feature)) return null;
	if (reason === "saved_route_limit" && feature === "unlimited_saved_routes") {
		const limit = typeof error.details.limit === "number" ? error.details.limit : FREE_SAVED_ROUTE_LIMIT;
		return { reason, feature, limit, upgrade: "pro" };
	}
	if (reason === "pro_required" && feature !== "unlimited_saved_routes") {
		return { reason, feature, upgrade: "pro" };
	}
	return null;
};
