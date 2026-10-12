import { describe, expect, it } from "bun:test";
import { buildRouteGpx, type Coordinate, type Waypoint } from "@routess/core";
import { parseGpx } from "./gpx";

const waypoints: Waypoint[] = [
	{ coord: [3.7174, 51.0543], type: "routed", name: "Start & <finish>" },
	{ coord: [3.7274, 51.0643], type: "direct" },
];
const geometry: Coordinate[] = [
	[3.7174, 51.0543],
	[3.72, 51.06],
	[3.7274, 51.0643],
];

describe("buildRouteGpx output read back by parseGpx", () => {
	it("round-trips name, waypoints (with type and name) and geometry through parseGpx", () => {
		const parsed = parseGpx(buildRouteGpx({ name: `Loop "A" & B`, waypoints, geometry }));
		expect(parsed).toEqual({ name: `Loop "A" & B`, waypoints, trackPoints: geometry });
	});

	it("emits a GPX 1.1 document with the routess namespace", () => {
		const xml = buildRouteGpx({ name: "Loop", waypoints, geometry });
		expect(xml.startsWith(`<?xml version="1.0" encoding="UTF-8"?>`)).toBe(true);
		const root = /<gpx [^>]*>/.exec(xml)?.[0] ?? "";
		expect(root).toContain(`version="1.1"`);
		expect(root).toContain(`xmlns="http://www.topografix.com/GPX/1/1"`);
		expect(root).toContain(`xmlns:routess="https://routess.app/gpx/1"`);
	});

	it("omits the route block without waypoints and the track block without geometry", () => {
		expect(parseGpx(buildRouteGpx({ name: "Only track", waypoints: [], geometry }))).toEqual({
			name: "Only track",
			waypoints: [],
			trackPoints: geometry,
		});
		expect(parseGpx(buildRouteGpx({ name: "Only route", waypoints }))).toEqual({
			name: "Only route",
			waypoints,
			trackPoints: [],
		});
	});
});

describe("parseGpx", () => {
	it("falls back to standalone wpt elements when there are no rtept", () => {
		const parsed = parseGpx(`<gpx><wpt lat="51.1" lon="3.1"><name>A</name></wpt><wpt lat="51.2" lon="3.2"/></gpx>`);
		expect(parsed.waypoints).toEqual([
			{ coord: [3.1, 51.1], type: "routed", name: "A" },
			{ coord: [3.2, 51.2], type: "routed" },
		]);
	});

	it("reads a track-only export from another tool and takes the track name", () => {
		const parsed = parseGpx(
			`<gpx><trk><name>Morning ride</name><trkseg><trkpt lat="51" lon="3"><ele>5</ele></trkpt><trkpt lat="51.5" lon="3.5"/></trkseg></trk></gpx>`,
		);
		expect(parsed).toEqual({
			name: "Morning ride",
			waypoints: [],
			trackPoints: [
				[3, 51],
				[3.5, 51.5],
			],
		});
	});

	it("skips points with missing or non-numeric coordinates", () => {
		const parsed = parseGpx(`<gpx><rte><rtept lat="51" lon="3"/><rtept lat="x" lon="3"/><rtept lon="3"/></rte></gpx>`);
		expect(parsed.waypoints).toEqual([{ coord: [3, 51], type: "routed" }]);
	});

	it("has no name when the document carries none", () => {
		expect(parseGpx(`<gpx></gpx>`)).toEqual({ waypoints: [], trackPoints: [] });
	});
});
