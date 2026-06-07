import { encodePolyline6, type Waypoint } from "@routess/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeRoute } from "./valhallaClient";

const fetchMock = vi.fn();

// 30 routed waypoints in a line, 0.01° (~0.7km) apart: exceeds the routing
// API's 25-location cap, so computeRoute must split into stitched chunks.
const waypoints: Waypoint[] = Array.from({ length: 30 }, (_, i) => ({
	coord: [3.7 + i * 0.01, 51.05] as [number, number],
	type: "routed" as const,
}));

const prefs = { surfacePreference: "mixed" as const, avoidFerries: true, avoidHighways: false };

describe("computeRoute — chunked all-routed requests", () => {
	beforeEach(() => {
		(global.fetch as unknown as typeof fetchMock) = fetchMock;
		fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
			const body = JSON.parse(init.body) as { locations: { lat: number; lon: number }[] };
			const coords = body.locations.map((l) => [l.lon, l.lat] as [number, number]);
			return {
				ok: true,
				json: async () => ({
					// One leg per location pair, straight-line shapes.
					legs: coords.slice(1).map((to, i) => ({
						shape: encodePolyline6([coords[i], to]),
						summary: { length: 0.7, time: 120 },
					})),
					locations: [],
				}),
			};
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("splits >25 waypoints into chunks sharing boundary waypoints", async () => {
		const outcome = await computeRoute(waypoints, "cycle", prefs);
		expect(outcome.ok).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(2);

		const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
		const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body);
		expect(firstBody.locations).toHaveLength(25);
		expect(secondBody.locations).toHaveLength(6);
		// Boundary waypoint shared: last of chunk 1 == first of chunk 2.
		expect(secondBody.locations[0]).toEqual(firstBody.locations[24]);
	});

	it("stitches geometry and sums metrics across chunks", async () => {
		const outcome = await computeRoute(waypoints, "cycle", prefs);
		if (!outcome.ok) throw new Error("expected ok");
		// 29 legs of 0.7km / 120s.
		expect(outcome.distanceKm).toBeCloseTo(29 * 0.7, 5);
		expect(outcome.durationMinutes).toBe(58);
		// Path covers first to last waypoint without duplicated boundary point
		// (polyline6 rounds to 1e-6, so compare with tolerance).
		const close = (a: number, b: number) => Math.abs(a - b) < 1e-5;
		expect(close(outcome.routePath[0][0], waypoints[0].coord[0])).toBe(true);
		expect(close(outcome.routePath[outcome.routePath.length - 1][0], waypoints[29].coord[0])).toBe(true);
		const boundary = waypoints[24].coord;
		expect(outcome.routePath.filter((c) => close(c[0], boundary[0]) && close(c[1], boundary[1]))).toHaveLength(1);
	});

	it("stays a single call at or under 25 waypoints", async () => {
		const outcome = await computeRoute(waypoints.slice(0, 25), "cycle", prefs);
		expect(outcome.ok).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("reports the failing chunk's waypoint span on routing failure", async () => {
		let call = 0;
		fetchMock.mockImplementation(async () => {
			call++;
			if (call === 1) {
				return {
					ok: true,
					json: async () => ({
						legs: Array.from({ length: 24 }, (_, i) => ({
							shape: encodePolyline6([waypoints[i].coord, waypoints[i + 1].coord]),
							summary: { length: 0.7, time: 120 },
						})),
						locations: [],
					}),
				};
			}
			return { ok: false, status: 400, headers: { get: () => null }, text: async () => "no path" };
		});

		const outcome = await computeRoute(waypoints, "cycle", prefs);
		expect(outcome.ok).toBe(false);
		if (outcome.ok) throw new Error("expected failure");
		expect(outcome.failedSegment).toEqual({ from: 24, to: 29 });
	});
});
