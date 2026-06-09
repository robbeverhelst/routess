import { describe, expect, it } from "bun:test";
import { EUROVELO_SOURCE, euroVeloAdapter } from "./eurovelo";

// Minimal but representative EuroVelo-shaped GPX: metadata name, a named track
// with a few trkpts, attribute order varied to prove the parser is tolerant.
const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ECF" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>EuroVelo network</name></metadata>
  <trk>
    <name>EuroVelo 5 - Via Romea (Francigena)</name>
    <trkseg>
      <trkpt lat="51.0500" lon="3.7200"></trkpt>
      <trkpt lon="3.7400" lat="51.0600"></trkpt>
      <trkpt lat="51.0700" lon="3.7600"></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe("euroVeloAdapter", () => {
	it("declares a green ODbL source", () => {
		expect(EUROVELO_SOURCE.status).toBe("green");
		expect(EUROVELO_SOURCE.license).toBe("ODbL-1.0");
		expect(EUROVELO_SOURCE.attribution).toContain("EuroVelo");
	});

	it("parses a GPX track into one normalized SeedRoute", () => {
		const routes = euroVeloAdapter.parse(FIXTURE);
		expect(routes).toHaveLength(1);
		const route = routes[0];
		expect(route?.name).toBe("EuroVelo 5 - Via Romea (Francigena)");
		expect(route?.activity).toBe("cycle");
		expect(route?.geometry).toHaveLength(3);
		// [lng, lat] order preserved regardless of attribute order in the source.
		expect(route?.geometry[0]).toEqual([3.72, 51.05]);
		expect(route?.geometry[1]).toEqual([3.74, 51.06]);
	});

	it("derives a stable sourceRecordId from the route name", () => {
		const a = euroVeloAdapter.parse(FIXTURE)[0]?.sourceRecordId;
		const b = euroVeloAdapter.parse(FIXTURE)[0]?.sourceRecordId;
		expect(a).toBe(b);
		expect(a).toBe("eurovelo-5-via-romea-francigena");
	});

	it("computes a positive distance in meters", () => {
		const route = euroVeloAdapter.parse(FIXTURE)[0];
		expect(route?.distance).toBeGreaterThan(0);
	});

	it("drops tracks with fewer than two points", () => {
		const thin = `<gpx><trk><name>Stub</name><trkseg><trkpt lat="51" lon="3"></trkpt></trkseg></trk></gpx>`;
		expect(euroVeloAdapter.parse(thin)).toHaveLength(0);
	});
});
