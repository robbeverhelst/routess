import type { Waypoint } from "@routess/core";
import { decompressAndParse, serializeAndCompress } from "@/lib/shareUtils";

describe("shareUtils", () => {
	it("round-trips shared route data", () => {
		const waypoints: Waypoint[] = [
			{ coord: [4.3517, 50.8503], type: "routed" },
			{ coord: [4.4025, 51.2194], type: "direct" },
		];
		const encoded = serializeAndCompress(waypoints, true);

		expect(encoded).not.toBeNull();
		expect(decompressAndParse(encoded || "")).toEqual({
			waypoints,
			isLocked: true,
		});
	});

	it("returns null for invalid shared route data", () => {
		expect(decompressAndParse("definitely-not-valid")).toBeNull();
	});
});
