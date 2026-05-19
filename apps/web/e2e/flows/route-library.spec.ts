import { expect, test } from "@playwright/test";
import { testLogin } from "../support/auth";
import { truncateDb } from "../support/db";

// RouteLibrary API contract: POST and GET /routes round-trip correctly and
// ownership isolation holds. Pure API specs (no browser), exercise the
// directFlags ↔ type adapter in the api-client via the API surface.

const API = `http://localhost:${process.env.E2E_API_PORT ?? "3010"}/api/v1`;

test.describe("route library", () => {
	test.beforeEach(async () => {
		await truncateDb();
	});

	test("saved Route appears in GET /routes for the owner", async ({ request }) => {
		const auth = await testLogin(request, "library@test.local");

		const created = await request.post(`${API}/routes`, {
			headers: { Authorization: `Bearer ${auth.accessToken}` },
			data: {
				name: "my saved loop",
				activity: "cycle",
				visibility: "private",
				waypoints: [
					{ coord: [4.4025, 51.2194], type: "routed" },
					{ coord: [4.4115, 51.2225], type: "routed" },
				],
				distance: 1500,
				duration: 360,
			},
		});
		expect(created.status()).toBe(201);

		const list = await request.get(`${API}/routes`, {
			headers: { Authorization: `Bearer ${auth.accessToken}` },
		});
		expect(list.ok()).toBe(true);
		const routes = await list.json();
		expect(routes).toHaveLength(1);
		expect(routes[0].name).toBe("my saved loop");
		expect(routes[0].waypoints[0].type).toBe("routed");
	});

	test("another user's Routes are not in the list", async ({ request }) => {
		const owner = await testLogin(request, "owner@test.local");
		await request.post(`${API}/routes`, {
			headers: { Authorization: `Bearer ${owner.accessToken}` },
			data: {
				name: "owner's route",
				activity: "run",
				visibility: "private",
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
