import { buildLibraryRoutePayload, routeNameFromImport } from "@/features/routing/services/importToLibrary";

describe("routeNameFromImport", () => {
	it("prefers the GPX route name", () => {
		expect(routeNameFromImport("Kanaalroute Gent", "ride.gpx")).toBe("Kanaalroute Gent");
	});

	it("falls back to the file name without extension", () => {
		expect(routeNameFromImport(undefined, "morning-ride.gpx")).toBe("morning-ride");
		expect(routeNameFromImport("  ", "morning-ride.gpx")).toBe("morning-ride");
	});

	it("falls back to a generic name when nothing usable exists", () => {
		expect(routeNameFromImport(undefined, undefined)).toBe("Imported route");
		expect(routeNameFromImport(undefined, ".gpx")).toBe("Imported route");
	});
});

describe("buildLibraryRoutePayload", () => {
	const parsed = {
		name: "Morning ride",
		waypoints: [
			{ coord: [4.3517, 50.8503] as [number, number], type: "routed" as const, name: "Start" },
			{ coord: [4.4025, 51.2194] as [number, number] },
		],
		trackPoints: [
			[4.3517, 50.8503] as [number, number],
			[4.36, 50.9] as [number, number],
			[4.4025, 51.2194] as [number, number],
		],
	};

	it("persists track geometry and computes distance from it", () => {
		const payload = buildLibraryRoutePayload(parsed, "ride.gpx", "cycle");

		expect(payload.name).toBe("Morning ride");
		expect(payload.geometry).toEqual(parsed.trackPoints);
		expect(payload.distance).toBeGreaterThan(40_000);
		expect(payload.activity).toBe("cycle");
		expect(payload.visibility).toBe("private");
	});

	it("defaults untyped waypoints to routed and keeps names", () => {
		const payload = buildLibraryRoutePayload(parsed, "ride.gpx", undefined);

		expect(payload.waypoints).toEqual([
			{ coord: [4.3517, 50.8503], type: "routed", name: "Start" },
			{ coord: [4.4025, 51.2194], type: "routed" },
		]);
		expect(payload.activity).toBeUndefined();
	});

	it("omits geometry without a track and measures over waypoints instead", () => {
		const payload = buildLibraryRoutePayload({ waypoints: parsed.waypoints }, "ride.gpx", undefined);

		expect(payload.geometry).toBeUndefined();
		expect(payload.distance).toBeGreaterThan(0);
		expect(payload.name).toBe("ride");
	});
});
