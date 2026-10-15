import { describe, expect, it } from "bun:test";

import { proGateOf } from "./pro-gates";

describe("proGateOf", () => {
	it("reads a Pro-only Feature gate", () => {
		expect(
			proGateOf({
				code: "FORBIDDEN",
				details: { reason: "pro_required", feature: "navigation", upgrade: "pro" },
			}),
		).toEqual({ reason: "pro_required", feature: "navigation", upgrade: "pro" });
	});

	it("reads the saved-route cap with its limit", () => {
		expect(
			proGateOf({
				code: "FORBIDDEN",
				details: { reason: "saved_route_limit", feature: "unlimited_saved_routes", limit: 5, upgrade: "pro" },
			}),
		).toEqual({ reason: "saved_route_limit", feature: "unlimited_saved_routes", limit: 5, upgrade: "pro" });
	});

	it("ignores other errors and mismatched details", () => {
		expect(proGateOf(null)).toBeNull();
		expect(proGateOf({ code: "FORBIDDEN" })).toBeNull();
		expect(proGateOf({ code: "RATE_LIMITED", details: { reason: "pro_required", feature: "navigation" } })).toBeNull();
		expect(proGateOf({ code: "FORBIDDEN", details: { reason: "pro_required", feature: "gpx_export" } })).toBeNull();
		expect(
			proGateOf({ code: "FORBIDDEN", details: { reason: "pro_required", feature: "unlimited_saved_routes" } }),
		).toBeNull();
	});
});
