import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAddCoord } from "./WaypointCoordinator";

const fetchMock = vi.fn();
const GHENT: [number, number] = [3.7174, 51.0543];

describe("resolveAddCoord", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = fetchMock as unknown as typeof fetch;
	});

	const respond = (body: unknown, ok = true, status = 200) =>
		fetchMock.mockResolvedValue({ ok, status, json: async () => body, text: async () => JSON.stringify(body) });

	it("snaps a routed waypoint onto the road it matched", async () => {
		respond({ code: "Ok", tracepoints: [{ location: [3.7175, 51.0544] }] });

		const result = await resolveAddCoord(GHENT, "routed", "pk.test");

		expect(result.coord).toEqual([3.7175, 51.0544]);
		expect(result.checkNearRoadFailed).toBe(false);
	});

	it("flags a definite off-road verdict", async () => {
		respond({ code: "Ok", tracepoints: [null, null] });

		const result = await resolveAddCoord(GHENT, "routed", "pk.test");

		expect(result.coord).toEqual(GHENT);
		expect(result.checkNearRoadFailed).toBe(true);
	});

	// The flag drives a user-facing "Point is too far from any road" message.
	// An outage tells us nothing about the point, so claiming that would be a lie.
	it.each([
		["a rate limit", () => respond({ message: "Too Many Requests" }, false, 429)],
		["a transport failure", () => fetchMock.mockRejectedValue(new TypeError("Load failed"))],
	])("does not claim off-road when the check was unavailable: %s", async (_label, arrange) => {
		arrange();

		const result = await resolveAddCoord(GHENT, "routed", "pk.test");

		expect(result.coord).toEqual(GHENT);
		expect(result.checkNearRoadFailed).toBe(false);
	});

	it("leaves direct waypoints alone without calling the API", async () => {
		const result = await resolveAddCoord(GHENT, "direct", "pk.test");

		expect(result).toEqual({ coord: GHENT, type: "direct", checkNearRoadFailed: false });
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
