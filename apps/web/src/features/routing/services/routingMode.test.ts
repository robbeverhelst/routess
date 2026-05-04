import {
	mapMapboxProfileToValhallaCosting,
	resolveMapboxProfile,
	resolveValhallaCosting,
} from "@/features/routing/services/routingMode";

describe("routingMode", () => {
	it("uses the walking profile for running and walking activities", () => {
		expect(resolveMapboxProfile("Running", "flat")).toBe("mapbox/walking");
		expect(resolveMapboxProfile("Walking", "scenic")).toBe("mapbox/walking");
		expect(resolveValhallaCosting("Walking", "flat")).toBe("pedestrian");
	});

	it("uses the driving profile for flat cycling routes", () => {
		expect(resolveMapboxProfile("Cycling", "flat")).toBe("mapbox/driving");
		expect(resolveValhallaCosting("Cycling", "flat")).toBe("auto");
	});

	it("defaults cycling routes to bicycle costing", () => {
		expect(resolveMapboxProfile("Cycling", "safe")).toBe("mapbox/cycling");
		expect(mapMapboxProfileToValhallaCosting("mapbox/cycling")).toBe("bicycle");
		expect(resolveValhallaCosting("Cycling", "scenic")).toBe("bicycle");
	});
});
