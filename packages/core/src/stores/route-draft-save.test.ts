import { describe, expect, it } from "bun:test";

import type { Coordinate } from "../types";
import { draftSaveFields, draftToCreateRequest, type RouteDraftSaveState, routeOriginFields } from "./route-draft-save";

const PATH: Coordinate[] = [
	[3.7, 51.05],
	[3.75, 51.07],
];

const DRAFT: RouteDraftSaveState = {
	waypoints: [
		{ coord: PATH[0], type: "routed" },
		{ coord: PATH[1], type: "routed" },
	],
	routePath: PATH,
	distanceMeters: 4200,
	durationSeconds: 900,
	elevationGain: 12.6,
	routingPreferences: { surfacePreference: "mixed", avoidFerries: true, avoidHighways: false },
	creationSource: "manual",
	forkedFromExternalRouteId: null,
	provenance: null,
};

describe("draftToCreateRequest", () => {
	it("sends the geometry, rounded metrics and preferences of a manual draft, with no Provenance", () => {
		expect(draftToCreateRequest(DRAFT)).toEqual({
			waypoints: DRAFT.waypoints,
			geometry: PATH,
			distance: 4200,
			duration: 900,
			elevationGain: 13,
			routingPreferences: DRAFT.routingPreferences,
		});
	});

	it("marks a generated draft with Provenance generation", () => {
		expect(draftToCreateRequest({ ...DRAFT, creationSource: "generated" }).provenance).toBe("generation");
	});

	it("names the ExternalRoute of a forked draft instead of a Provenance", () => {
		const request = draftToCreateRequest({ ...DRAFT, creationSource: "imported", forkedFromExternalRouteId: 42 });

		expect(request.forkedFromExternalRouteId).toBe(42);
		expect(request.provenance).toBeUndefined();
	});

	it("keeps the Provenance of the Route or file the draft was loaded from", () => {
		expect(draftToCreateRequest({ ...DRAFT, creationSource: "imported", provenance: "gpx-import" }).provenance).toBe(
			"gpx-import",
		);
		expect(draftToCreateRequest({ ...DRAFT, provenance: "mapbox-legacy" }).provenance).toBe("mapbox-legacy");
	});

	it("names the ExternalRoute of a fork even when the draft also has a Provenance", () => {
		const request = draftToCreateRequest({ ...DRAFT, provenance: "gpx-import", forkedFromExternalRouteId: 42 });

		expect(request).toMatchObject({ forkedFromExternalRouteId: 42 });
		expect(request).not.toHaveProperty("provenance");
	});

	it("leaves out a RoutePath too short to draw and preferences the draft lacks", () => {
		const request = draftToCreateRequest({ ...DRAFT, routePath: [PATH[0]], routingPreferences: null });

		expect(request).not.toHaveProperty("geometry");
		expect(request).not.toHaveProperty("routingPreferences");
	});
});

describe("draftSaveFields", () => {
	it("falls back to zero distance, unknown elevation and no duration while they are unknown", () => {
		const fields = draftSaveFields({ ...DRAFT, distanceMeters: null, durationSeconds: null, elevationGain: undefined });

		expect(fields.distance).toBe(0);
		expect(fields.duration).toBeUndefined();
		// An unknown elevation gain is saved as unknown, not as a flat 0.
		expect(fields.elevationGain).toBeNull();
	});
});

describe("routeOriginFields", () => {
	it("names a fork's ExternalRoute and never sends Provenance external-fork", () => {
		expect(routeOriginFields({ provenance: "external-fork", forkedFromExternalRouteId: 42 })).toEqual({
			forkedFromExternalRouteId: 42,
		});
		expect(routeOriginFields({ provenance: "external-fork" })).toEqual({});
	});

	it("keeps any other Provenance", () => {
		expect(routeOriginFields({ provenance: "gpx-import" })).toEqual({ provenance: "gpx-import" });
	});
});
