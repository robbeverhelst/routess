import { describe, expect, it } from "bun:test";
import { brusselsIcrAdapter } from "./brussels-icr";
import { osmBelgiumAdapter } from "./osm-routes";
import { ravelAdapter } from "./ravel";

describe("osmBelgiumAdapter", () => {
	const FIXTURE = JSON.stringify({
		elements: [
			{
				type: "relation",
				id: 123456,
				tags: { route: "bicycle", name: "Kempense Heuvelrugroute", network: "lcn", ref: "KHR" },
				members: [
					// Second leg listed first and stored reversed; stitching must fix
					// both. Points ~110m apart so the quality gate sees no jumps.
					{
						type: "way",
						geometry: [
							{ lat: 51.102, lon: 4.502 },
							{ lat: 51.101, lon: 4.501 },
						],
					},
					{
						type: "way",
						geometry: [
							{ lat: 51.1, lon: 4.5 },
							{ lat: 51.101, lon: 4.501 },
						],
					},
					// Far-away variant leg: excluded by role, not stitched in.
					{
						type: "way",
						role: "alternative",
						geometry: [
							{ lat: 51.5, lon: 5.0 },
							{ lat: 51.501, lon: 5.001 },
						],
					},
				],
			},
			{
				type: "relation",
				id: 222,
				tags: { route: "hiking", name: "Heidewandeling" },
				members: [
					{
						type: "way",
						geometry: [
							{ lat: 51.0, lon: 4.0 },
							{ lat: 51.001, lon: 4.001 },
						],
					},
				],
			},
			// Unstitchable: two pieces kilometers apart -> quality gate skips it.
			{
				type: "relation",
				id: 444,
				tags: { route: "hiking", name: "Kapotte route" },
				members: [
					{
						type: "way",
						geometry: [
							{ lat: 50.0, lon: 4.0 },
							{ lat: 50.001, lon: 4.001 },
						],
					},
					{
						type: "way",
						geometry: [
							{ lat: 50.2, lon: 4.2 },
							{ lat: 50.201, lon: 4.201 },
						],
					},
				],
			},
			// Nameless: skipped.
			{ type: "relation", id: 333, tags: { route: "bicycle" }, members: [] },
		],
	});

	it("converts named relations, stitching member ways geometrically", () => {
		const routes = osmBelgiumAdapter.parse(FIXTURE);
		expect(routes.map((r) => r.sourceRecordId)).toEqual(["rel-123456", "rel-222"]);
		const bike = routes[0];
		expect(bike?.name).toBe("Kempense Heuvelrugroute (KHR)");
		expect(bike?.activity).toBe("cycle");
		expect(bike?.tags).toContain("lcn");
		// Continuous after reorder + reverse, variant role excluded.
		expect(bike?.geometry.map((c) => c[0])).toEqual([4.502, 4.501, 4.5]);
		expect(routes[1]?.activity).toBe("walk");
	});
});

describe("ravelAdapter", () => {
	const FIXTURE = JSON.stringify({
		features: [
			{
				geometry: {
					type: "LineString",
					coordinates: [
						[5.57, 50.63],
						[5.4, 50.55],
					],
				},
				properties: {
					ID_PORTION: "21",
					NOM: "De Liège à Huy",
					DESCRIPT: "Meuse & liaisons",
					SITE_WEB: "https://r.example",
				},
			},
		],
	});

	it("emits one route per étape with itinerary context and the info link", () => {
		const routes = ravelAdapter.parse(FIXTURE);
		expect(routes).toHaveLength(1);
		expect(routes[0]?.name).toBe("Meuse & liaisons: De Liège à Huy");
		expect(routes[0]?.sourceRecordId).toBe("portion-21");
		expect(routes[0]?.description).toContain("https://r.example");
	});
});

describe("brusselsIcrAdapter", () => {
	const FIXTURE = JSON.stringify({
		features: [
			{
				geometry: {
					type: "MultiLineString",
					coordinates: [
						[
							[4.35, 50.85],
							[4.36, 50.86],
						],
					],
				},
				properties: { icr: "3", type: "Radial / Radiale" },
			},
			{
				geometry: {
					type: "LineString",
					coordinates: [
						[4.36, 50.86],
						[4.37, 50.87],
					],
				},
				properties: { icr: "3", type: "Radial / Radiale" },
			},
			{
				geometry: {
					type: "LineString",
					coordinates: [
						[4.4, 50.8],
						[4.41, 50.81],
					],
				},
				properties: { icr: "A", type: "Ring / Ring" },
			},
		],
	});

	it("groups segments per ICR number and stitches them", () => {
		const routes = brusselsIcrAdapter.parse(FIXTURE);
		expect(routes.map((r) => r.sourceRecordId).sort()).toEqual(["icr-3", "icr-a"]);
		const icr3 = routes.find((r) => r.sourceRecordId === "icr-3");
		expect(icr3?.name).toBe("Gewestelijke fietsroute ICR 3 (Radiale)");
		expect(icr3?.geometry).toHaveLength(3);
	});
});
