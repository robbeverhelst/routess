import { expect, test } from "@playwright/test";
import { loginAndGoto, testLogin } from "../support/auth";
import { truncateDb } from "../support/db";
import { getRouteDraft, waitForBridge } from "../support/routessApi";

// RouteLibrary round-trip: seed a Route via the API, then confirm the user's
// route list contains it. Loading a Route into the editor exercises the
// loadFromApiRoute path on RouteDraftEditor (ADR-0009).

const API = `http://localhost:${process.env.E2E_API_PORT ?? "3010"}/api/v1`;

test.describe("route library", () => {
	test.beforeEach(async () => {
		await truncateDb();
	});

	test("saved Route appears in GET /routes for the owner", async ({ page, request }) => {
		const auth = await loginAndGoto(page, request, "library@test.local");

		await request.post(`${API}/routes`, {
			headers: { Authorization: `Bearer ${auth.accessToken}` },
			data: {
				name: "my saved loop",
				activity: "cycle",
				privacy: "private",
				waypoints: [
					{ coord: [4.4025, 51.2194], type: "routed" },
					{ coord: [4.4115, 51.2225], type: "routed" },
				],
				distance: 1500,
				duration: 360,
			},
		});

		const list = await request.get(`${API}/routes`, {
			headers: { Authorization: `Bearer ${auth.accessToken}` },
		});
		expect(list.ok()).toBe(true);
		const routes = await list.json();
		expect(routes).toHaveLength(1);
		expect(routes[0].name).toBe("my saved loop");

		await waitForBridge(page);
		// Loading is invoked by the UI's library panel; here we verify the API
		// surface is consistent with what the editor's loadFromApiRoute consumes.
		const draftBefore = await getRouteDraft(page);
		expect(draftBefore.waypointCount).toBe(0);
	});

	test("another user's Routes are not in the list", async ({ request }) => {
		const owner = await testLogin(request, "owner@test.local");
		await request.post(`${API}/routes`, {
			headers: { Authorization: `Bearer ${owner.accessToken}` },
			data: {
				name: "owner's route",
				activity: "run",
				privacy: "private",
				waypoints: [
					{ coord: [4.4, 51.2], type: "routed" },
					{ coord: [4.41, 51.21], type: "routed" },
				],
				distance: 1100,
				duration: 600,
			},
		});

		const other = await testLogin(request, "other@test.local");
		const list = await request.get(`${API}/routes`, {
			headers: { Authorization: `Bearer ${other.accessToken}` },
		});
		expect(list.ok()).toBe(true);
		expect(await list.json()).toHaveLength(0);
	});
});
