import { generateGPXString, parseGPXFile } from "@/features/routing/services/GPXService";

describe("GPXService", () => {
	it("parses exported GPX files with route and track data", async () => {
		const waypoints: [number, number][] = [
			[4.3517, 50.8503],
			[4.4025, 51.2194],
		];
		const routePath: [number, number][] = [
			[4.3517, 50.8503],
			[4.36, 50.9],
			[4.4025, 51.2194],
		];

		const gpxString = generateGPXString(waypoints, routePath);
		const parsed = await parseGPXFile(gpxString);

		expect(parsed.error).toBeUndefined();
		expect(parsed.waypoints).toEqual(waypoints);
		expect(parsed.trackPoints).toEqual(routePath);
	});

	it("rejects malformed GPX input", async () => {
		const parsed = await parseGPXFile("<gpx><not-closed>");

		expect(parsed.error).toContain("Invalid GPX file");
	});
});
