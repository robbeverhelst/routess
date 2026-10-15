import { HttpStatus } from "@nestjs/common";
import { PRO_GATE_MESSAGES, type ProGateDetails, type ProGatedFeature } from "@routess/core";

import { DomainException } from "../common/exceptions/domain.exception";

// 403 for a Pro-only Feature (ADR 0039). The web and the CLI read
// `details` (see proGateOf in @routess/core) to show the Pro state.
export class ProRequiredException extends DomainException {
	constructor(feature: Exclude<ProGatedFeature, "unlimited_saved_routes">) {
		const details: ProGateDetails = { reason: "pro_required", feature, upgrade: "pro" };
		super(HttpStatus.FORBIDDEN, "FORBIDDEN", PRO_GATE_MESSAGES[feature], details);
	}
}

// 403 when a free User at the saved-Route cap saves another Route.
export class SavedRouteLimitException extends DomainException {
	constructor(limit: number) {
		const details: ProGateDetails = {
			reason: "saved_route_limit",
			feature: "unlimited_saved_routes",
			limit,
			upgrade: "pro",
		};
		super(HttpStatus.FORBIDDEN, "FORBIDDEN", `Free saves up to ${limit} routes. Go Pro for unlimited.`, details);
	}
}
