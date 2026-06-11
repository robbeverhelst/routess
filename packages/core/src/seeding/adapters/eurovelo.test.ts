import { describe, expect, it } from "bun:test";
import { EUROVELO_SOURCE, euroVeloAdapter } from "./eurovelo";

// Minimal but representative EuroVelo-shaped GPX: metadata name, a named track
// with a few trkpts, attribute order varied to prove the parser is tolerant.
const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="geoPHP" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>01: Canterbury – Dover (Partially Developed + Not Signed)</name>
    <desc>Partially Developed + Not Signed</desc>
    <trkseg>
      <trkpt lat="51.0500" lon="3.7200"></trkpt>
      <trkpt lon="3.7400" lat="51.0600"></trkpt>
      <trkpt lat="51.0700" lon="3.7600"></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const CONTEXT = { label: "EuroVelo 5 - Via Romea (Francigena)" };

describe("euroVeloAdapter", () => {
	it("declares a green ODbL source", () => {
		expect(EUROVELO_SOURCE.status).toBe("green");
		expect(EUROVELO_SOURCE.license).toBe("ODbL-1.0");
		expect(EUROVELO_SOURCE.attribution).toContain("EuroVelo");
	});

	it("parses an ECF stage track into one normalized SeedRoute", () => {
		const routes = euroVeloAdapter.parse(FIXTURE, CONTEXT);
		expect(routes).toHaveLength(1);
		const route = routes[0];
		expect(route?.name).toBe("EuroVelo 5 - Via Romea (Francigena), stage 01: Canterbury – Dover");
		expect(route?.description).toContain("Partially Developed");
		expect(route?.tags).toContain("ev5");
		expect(route?.activity).toBe("cycle");
		expect(route?.geometry).toHaveLength(3);
		// [lng, lat] order preserved regardless of attribute order in the source.
		expect(route?.geometry[0]).toEqual([3.72, 51.05]);
		expect(route?.geometry[1]).toEqual([3.74, 51.06]);
	});

	it("derives a stable sourceRecordId from route + stage, immune to status changes", () => {
		const a = euroVeloAdapter.parse(FIXTURE, CONTEXT)[0]?.sourceRecordId;
		const renamed = FIXTURE.replace("(Partially Developed + Not Signed)", "(Developed + Signed)");
		const b = euroVeloAdapter.parse(renamed, CONTEXT)[0]?.sourceRecordId;
		expect(a).toBe(b);
		expect(a).toBe("eurovelo-5-via-romea-francigena-stage-01");
	});

	it("falls back to the raw track name without a label", () => {
		const route = euroVeloAdapter.parse(FIXTURE)[0];
		// toRouteSlug caps at 40 chars; without a label the raw name is the id.
		expect(route?.sourceRecordId).toBe("01-canterbury-dover-partially-developed");
	});

	it("computes a positive distance in meters", () => {
		const route = euroVeloAdapter.parse(FIXTURE, CONTEXT)[0];
		expect(route?.distance).toBeGreaterThan(0);
	});

	it("drops tracks with fewer than two points", () => {
		const thin = `<gpx><trk><name>Stub</name><trkseg><trkpt lat="51" lon="3"></trkpt></trkseg></trk></gpx>`;
		expect(euroVeloAdapter.parse(thin)).toHaveLength(0);
	});
});
