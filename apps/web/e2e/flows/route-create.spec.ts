import { expect, test } from "@playwright/test";
import { loginAndGoto } from "../support/auth";
import { truncateDb } from "../support/db";
import { applyHar } from "../support/har";
import { addWaypoint, getRouteDraft, waitForBridge, waitForRouteCalculated } from "../support/routessApi";

// Hand-drawn Route flow: place Waypoints via the editor handle (ADR-0019),
// verify RouteDraft state and persistence through the api-client (which is the
// directFlags ↔ type seam called out in CONTEXT.md).
//
// Externals (Mapbox Map Matching, Mapbox Terrain RGB) are HAR-replayed per
// ADR-0017. The HAR file is recorded once via `bun e2e:record`.

const HAR = "fixtures/har/hand-drawn-route-3-waypoints.har";

test.describe("hand-drawn route", () => {
	test.beforeEach(async ({ page }) => {
		await truncateDb();
		await applyHar(page, HAR);
	});

	test("place 3 routed Waypoints, RoutePath calculated, metrics populated", async ({ page, request }) => {
		await loginAndGoto(page, request, "creator@test.local");
		await waitForBridge(page);

		await addWaypoint(page, 4.4025, 51.2194, "routed");
		await addWaypoint(page, 4.4115, 51.2225, "routed");
		await addWaypoint(page, 4.4205, 51.2256, "routed");

		await waitForRouteCalculated(page);

		const draft = await getRouteDraft(page);
		expect(draft.waypoints).toHaveLength(3);
		expect(draft.hasRoute).toBe(true);
		expect(draft.distanceMeters ?? 0).toBeGreaterThan(0);
		expect(draft.durationSeconds ?? 0).toBeGreaterThan(0);
		for (const wp of draft.waypoints) {
			expect(wp.type).toBe("routed");
		}
	});

	test("mixed routed + direct segments populate RoutePath with both Types", async ({ page, request }) => {
		await loginAndGoto(page, request, "mixed@test.local");
		await waitForBridge(page);

		await addWaypoint(page, 4.4025, 51.2194, "routed");
		await addWaypoint(page, 4.4115, 51.2225, "direct");
		await addWaypoint(page, 4.4205, 51.2256, "routed");

		await waitForRouteCalculated(page);

		const draft = await getRouteDraft(page);
		expect(draft.waypoints.map((w) => w.type)).toEqual(["routed", "direct", "routed"]);
		expect(draft.hasRoute).toBe(true);
	});

	test("save round-trips through api-client (directFlags ↔ type adapter)", async ({ page, request }) => {
		const auth = await loginAndGoto(page, request, "persist@test.local");
		await waitForBridge(page);

		await addWaypoint(page, 4.4025, 51.2194, "routed");
		await addWaypoint(page, 4.4115, 51.2225, "direct");
		await waitForRouteCalculated(page);

		const draft = await getRouteDraft(page);

		const created = await request.post(`http://localhost:${process.env.E2E_API_PORT ?? "3010"}/api/v1/routes`, {
			headers: { Authorization: `Bearer ${auth.accessToken}` },
			data: {
				name: "spec route",
				activity: "cycle",
				privacy: "private",
				waypoints: draft.waypoints.map((w) => ({ coord: w.coord, type: w.type })),
				distance: draft.distanceMeters ?? undefined,
				duration: draft.durationSeconds ?? undefined,
			},
		});
		expect(created.ok()).toBe(true);
		const body = await created.json();
		expect(body.waypoints).toHaveLength(2);
		expect(body.waypoints[0].type).toBe("routed");
		expect(body.waypoints[1].type).toBe("direct");
	});
});
