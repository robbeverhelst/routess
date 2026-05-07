import type { Waypoint } from "@routess/core";
import { generateGPXString, parseGPXFile } from "@/features/routing/services/GPXService";

describe("GPXService", () => {
	it("preserves Waypoint Type across a round-trip via the routess:type extension", async () => {
		const waypoints: Waypoint[] = [
			{ coord: [4.3517, 50.8503], type: "routed" },
			{ coord: [4.4025, 51.2194], type: "direct", name: "Antwerp" },
		];
		const routePath: [number, number][] = [
			[4.3517, 50.8503],
			[4.36, 50.9],
			[4.4025, 51.2194],
		];

		const gpxString = generateGPXString(waypoints, routePath);
		const parsed = await parseGPXFile(gpxString);

		expect(parsed.error).toBeUndefined();
		expect(parsed.waypoints).toEqual([
			{ coord: [4.3517, 50.8503], type: "routed" },
			{ coord: [4.4025, 51.2194], type: "direct", name: "Antwerp" },
		]);
		expect(parsed.trackPoints).toEqual(routePath);
	});

	it("returns waypoints without Type for foreign GPX (heuristic applies later)", async () => {
		const foreignGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OtherApp" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <rtept lat="50.8503" lon="4.3517"><name>A</name></rtept>
    <rtept lat="51.2194" lon="4.4025"></rtept>
  </rte>
</gpx>`;
		const parsed = await parseGPXFile(foreignGpx);

		expect(parsed.error).toBeUndefined();
		expect(parsed.waypoints).toEqual([{ coord: [4.3517, 50.8503], name: "A" }, { coord: [4.4025, 51.2194] }]);
	});

	it("rejects malformed GPX input", async () => {
		const parsed = await parseGPXFile("<gpx><not-closed>");

		expect(parsed.error).toContain("Invalid GPX file");
	});
});
