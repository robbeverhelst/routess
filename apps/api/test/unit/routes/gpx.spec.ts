import { describe, expect, it } from "bun:test";
import { buildRouteGpx } from "@routess/core";

describe("buildRouteGpx", () => {
	it("emits a track from geometry", () => {
		const gpx = buildRouteGpx({
			name: "Sunday Loop",
			waypoints: [],
			geometry: [
				[3.72, 51.05],
				[3.74, 51.06],
			],
		});
		expect(gpx).toContain("<trkpt");
		expect(gpx).toContain('lat="51.05"');
		expect(gpx).not.toContain("<copyright");
	});

	it("embeds source attribution as <copyright> when provided (ADR 0033)", () => {
		const gpx = buildRouteGpx({
			name: "EuroVelo 5",
			waypoints: [],
			geometry: [
				[3.72, 51.05],
				[3.74, 51.06],
			],
			attribution: "© EuroVelo / European Cyclists' Federation, ODbL",
			sourceUrl: "https://eurovelo.com",
		});
		expect(gpx).toContain("<copyright author=");
		expect(gpx).toContain("EuroVelo");
		expect(gpx).toContain("<license>https://eurovelo.com</license>");
	});

	it("escapes XML in attribution", () => {
		const gpx = buildRouteGpx({
			name: "X",
			waypoints: [],
			geometry: [
				[0, 0],
				[1, 1],
			],
			attribution: 'A & B "src"',
		});
		expect(gpx).toContain("A &amp; B &quot;src&quot;");
	});
});
