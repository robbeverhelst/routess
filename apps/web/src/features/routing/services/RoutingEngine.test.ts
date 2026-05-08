import type { Coordinate, Waypoint } from "@routess/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getDirectionsMock } = vi.hoisted(() => ({
	getDirectionsMock: vi.fn(),
}));

vi.mock("@/lib/utils/mapbox-api", () => ({
	getDirections: getDirectionsMock,
}));

import { computeRoute } from "./RoutingEngine";

const wp = (coord: Coordinate, type: "routed" | "direct" = "routed"): Waypoint => ({ coord, type });

describe("RoutingEngine.computeRoute — mixed-mode failures", () => {
	beforeEach(() => {
		getDirectionsMock.mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("does not silently downgrade routed segments to direct when Directions fails", async () => {
		// Three Waypoints: routed -> direct -> routed. The middle is direct
		// so the engine takes the mixed-mode branch. The first segment will
		// fail (Directions returns no route).
		const waypoints: Waypoint[] = [wp([0, 0], "routed"), wp([0.005, 0], "direct"), wp([0.01, 0], "routed")];

		// Segment 0->1 is direct (no Directions call). Segment 1->2 is
		// routed and will fail.
		getDirectionsMock.mockResolvedValueOnce({
			success: false,
			error: "NoRoute",
		});

		const outcome = await computeRoute(waypoints, "test-token");

		// The fix: a failed routed segment must surface as a route failure,
		// not a silent re-write of the user's chosen Type. The user picked
		// `routed`; the engine doesn't get to silently make it `direct`.
		expect(outcome.ok).toBe(false);
		if (!outcome.ok) {
			expect(outcome.error).toBeTruthy();
		}
	});

	it("returns ok when all routed segments snap successfully in mixed mode", async () => {
		const waypoints: Waypoint[] = [wp([0, 0], "routed"), wp([0.005, 0], "direct"), wp([0.01, 0], "routed")];

		getDirectionsMock.mockResolvedValue({
			success: true,
			data: {
				routes: [
					{
						geometry: {
							coordinates: [
								[0.005, 0],
								[0.0075, 0],
								[0.01, 0],
							],
						},
						distance: 500,
						duration: 300,
					},
				],
				waypoints: [{ location: [0.005, 0] }, { location: [0.01, 0] }],
				code: "Ok",
			},
		});

		const outcome = await computeRoute(waypoints, "test-token");
		expect(outcome.ok).toBe(true);
	});
});
