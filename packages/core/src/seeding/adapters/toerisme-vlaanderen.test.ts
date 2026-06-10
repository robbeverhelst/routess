import { describe, expect, it } from "bun:test";
import { TOERISME_VLAANDEREN_ICOONROUTES_SOURCE, toerismeVlaanderenIcoonroutesAdapter } from "./toerisme-vlaanderen";

// WFS-shaped fixture: legs out of order, one stored in reverse direction, and
// a second route mixed in. Stitching must yield one continuous path per route.
const FIXTURE = JSON.stringify({
	type: "FeatureCollection",
	features: [
		// Frontroute leg 2, stored REVERSED (end 20 -> begin 30 in geometry order).
		{
			geometry: {
				type: "LineString",
				coordinates: [
					[3.3, 51.2],
					[3.2, 51.1],
				],
			},
			properties: { icoonroute: "Frontroute 14-18", begin_geoid: 20, end_geoid: 30, updatedate: "2026-06-04Z" },
		},
		// Other route, to prove grouping.
		{
			geometry: {
				type: "LineString",
				coordinates: [
					[4.0, 51.0],
					[4.1, 51.05],
				],
			},
			properties: { icoonroute: "Kustroute", begin_geoid: 1, end_geoid: 2, meldpunt: "https://kust.example" },
		},
		// Frontroute leg 1 (10 -> 20).
		{
			geometry: {
				type: "LineString",
				coordinates: [
					[3.1, 51.0],
					[3.2, 51.1],
				],
			},
			properties: {
				icoonroute: "Frontroute 14-18",
				begin_geoid: 10,
				end_geoid: 20,
				meldpunt: "https://westtoer.example",
				updatedate: "2026-06-01Z",
			},
		},
		// Nameless leg: skipped.
		{
			geometry: {
				type: "LineString",
				coordinates: [
					[5.0, 51.0],
					[5.1, 51.0],
				],
			},
			properties: { begin_geoid: 7, end_geoid: 8 },
		},
	],
});

describe("toerismeVlaanderenIcoonroutesAdapter", () => {
	it("declares a green automatic source with the keep-updated cadence", () => {
		expect(TOERISME_VLAANDEREN_ICOONROUTES_SOURCE.status).toBe("green");
		expect(TOERISME_VLAANDEREN_ICOONROUTES_SOURCE.feedUrl).toContain("icoonroute_trajecten");
		expect(TOERISME_VLAANDEREN_ICOONROUTES_SOURCE.refreshIntervalDays).toBe(7);
	});

	it("groups legs per icoonroute and stitches them in order, reversing backwards legs", () => {
		const routes = toerismeVlaanderenIcoonroutesAdapter.parse(FIXTURE);
		expect(routes.map((r) => r.name).sort()).toEqual(["Frontroute 14-18", "Kustroute"]);
		const front = routes.find((r) => r.name === "Frontroute 14-18");
		// 10->20 then 20->30: continuous, joint coordinate deduped.
		expect(front?.geometry).toEqual([
			[3.1, 51.0],
			[3.2, 51.1],
			[3.3, 51.2],
		]);
		expect(front?.sourceRecordId).toBe("frontroute-14-18");
		expect(front?.sourceUpdatedAt).toBe("2026-06-04T00:00:00Z");
	});

	it("carries the meldpunt link in the description (license obligation)", () => {
		const routes = toerismeVlaanderenIcoonroutesAdapter.parse(FIXTURE);
		expect(routes.find((r) => r.name === "Frontroute 14-18")?.description).toContain("https://westtoer.example");
		expect(routes.find((r) => r.name === "Kustroute")?.description).toContain("https://kust.example");
	});

	it("computes distance and tags", () => {
		const route = toerismeVlaanderenIcoonroutesAdapter.parse(FIXTURE)[0];
		expect(route?.distance).toBeGreaterThan(0);
		expect(route?.tags).toContain("icoonroute");
	});
});
