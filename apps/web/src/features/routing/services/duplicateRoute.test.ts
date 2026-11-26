import { describe, expect, it } from "bun:test";

import type { ApiRoute } from "@routess/api-client";

import { duplicateRouteRequest } from "./duplicateRoute";

const route = (overrides: Partial<ApiRoute>) =>
	({
		id: 7,
		name: "Canal ride",
		activity: "cycle",
		visibility: "public",
		tags: ["canal"],
		waypoints: [
			{ coord: [3.717, 51.054], type: "routed" },
			{ coord: [3.724, 51.056], type: "routed" },
		],
		distance: 900,
		provenance: "valhalla",
		...overrides,
	}) as ApiRoute;

describe("duplicateRouteRequest", () => {
	it("names the ExternalRoute of a fork instead of sending Provenance external-fork", () => {
		const request = duplicateRouteRequest(
			route({ provenance: "external-fork", forkedFrom: { externalRouteId: 42, license: "CC-BY-4.0" } }),
		);

		expect(request.forkedFromExternalRouteId).toBe(42);
		expect(request).not.toHaveProperty("provenance");
	});

	it.each(["gpx-import", "mapbox-legacy", "generation"] as const)("keeps Provenance %s", (provenance) => {
		const request = duplicateRouteRequest(route({ provenance }));

		expect(request.provenance).toBe(provenance);
		expect(request).not.toHaveProperty("forkedFromExternalRouteId");
	});

	it("copies the geometry and metrics under a copy name", () => {
		const source = route({});

		expect(duplicateRouteRequest(source)).toMatchObject({
			name: "Canal ride (copy)",
			tags: ["canal"],
			waypoints: source.waypoints,
			distance: 900,
		});
	});
});
