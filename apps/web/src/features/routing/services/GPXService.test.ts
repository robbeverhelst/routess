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

	it("round-trips the route name through metadata", async () => {
		const gpxString = generateGPXString([{ coord: [4.3517, 50.8503], type: "routed" }], [], "Kanaalroute Gent");
		const parsed = await parseGPXFile(gpxString);

		expect(parsed.name).toBe("Kanaalroute Gent");
	});

	it("reads the rte name when metadata has none, without grabbing rtept names", async () => {
		const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OtherApp" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <rtept lat="50.8503" lon="4.3517"><name>First stop</name></rtept>
  </rte>
</gpx>`;
		const parsed = await parseGPXFile(gpx);

		expect(parsed.name).toBeUndefined();
		expect(parsed.waypoints?.[0]?.name).toBe("First stop");
	});

	it("derives waypoints from a track-only file and keeps the raw track", async () => {
		const trkpts = Array.from({ length: 20 }, (_, i) => `<trkpt lat="${50.8 + i * 0.01}" lon="4.35"></trkpt>`).join("");
		const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OtherApp" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Morning ride</name><trkseg>${trkpts}</trkseg></trk>
</gpx>`;
		const parsed = await parseGPXFile(gpx);

		expect(parsed.error).toBeUndefined();
		expect(parsed.name).toBe("Morning ride");
		expect(parsed.waypointsDerivedFromTrack).toBe(true);
		expect(parsed.trackPoints).toHaveLength(20);
		expect(parsed.waypoints?.length).toBeGreaterThan(0);
	});
});
