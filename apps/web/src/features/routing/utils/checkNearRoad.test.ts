import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkNearRoad } from "./RoutingUtils";

const fetchMock = vi.fn();

describe("checkNearRoad", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = fetchMock as unknown as typeof fetch;
	});

	const respond = (body: unknown, ok = true, status = 200) =>
		fetchMock.mockResolvedValue({ ok, status, json: async () => body, text: async () => JSON.stringify(body) });

	it("snaps a point that sits on a road", async () => {
		respond({ code: "Ok", tracepoints: [{ location: [3.7174, 51.0543] }] });

		const result = await checkNearRoad([3.7174, 51.0543], "pk.test");

		expect(result.isValid).toBe(true);
		expect(result.snappedCoords).toEqual([3.7174, 51.0543]);
		expect(result.unavailable).toBeUndefined();
	});

	// NoSegment is the API answering "nothing to snap to", which is the whole
	// question. Treating it as an outage would route points that are genuinely
	// off-road.
	it.each(["NoSegment", "NoMatch", "NoRoute"])("treats %s as a definite off-road verdict", async (code) => {
		respond({ code, message: "Could not find a matching segment" });

		const result = await checkNearRoad([3.7174, 51.0543], "pk.test");

		expect(result.isValid).toBe(false);
		expect(result.unavailable).toBeUndefined();
	});

	it("reports a null tracepoint as off-road, not unavailable", async () => {
		respond({ code: "Ok", tracepoints: [null, null] });

		const result = await checkNearRoad([3.7174, 51.0543], "pk.test");

		expect(result.isValid).toBe(false);
		expect(result.unavailable).toBeUndefined();
	});

	it.each([
		["a rate limit", () => respond({ message: "Too Many Requests" }, false, 429)],
		["a rejected token", () => respond({ message: "Not Authorized" }, false, 401)],
		["an unexpected code", () => respond({ code: "ProfileNotFound" })],
		["a transport failure", () => fetchMock.mockRejectedValue(new TypeError("Load failed"))],
	])("reports %s as unavailable rather than off-road", async (_label, arrange) => {
		arrange();

		const result = await checkNearRoad([3.7174, 51.0543], "pk.test");

		expect(result.isValid).toBe(false);
		expect(result.unavailable).toBe(true);
	});
});
