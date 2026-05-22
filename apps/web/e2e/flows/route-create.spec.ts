import { expect, test } from "@playwright/test";
import { loginViaEmailUI } from "../support/auth";
import { truncateDb } from "../support/db";
import { getRouteDraft, waitForBridge, waitForRouteCalculated } from "../support/routessApi";
import { clickAtMapPixel, rightClickAtMapPixel } from "../support/stable-map";

// Hand-drawn Route flow: place Waypoints through real map canvas clicks and
// verify RouteDraft state plus persistence.
async function loginAndWaitForRealMap(
	page: Parameters<typeof loginViaEmailUI>[0],
	request: Parameters<typeof loginViaEmailUI>[1],
	email: string,
) {
	await loginViaEmailUI(page, request, email);
	await page.locator("canvas.mapboxgl-canvas").waitFor({ state: "visible", timeout: 30_000 });
	await waitForBridge(page);
}

async function addDirectWaypointViaMapContextMenu(page: Parameters<typeof clickAtMapPixel>[0], dx: number, dy: number) {
	await rightClickAtMapPixel(page, dx, dy);
	await page.getByRole("button", { name: /add direct waypoint/i }).click();
}

test.describe("hand-drawn route with real Mapbox", () => {
	test.beforeEach(async () => {
		await truncateDb();
	});

	test("place 3 direct Waypoints via map context menu, RoutePath calculated, metrics populated", async ({
		page,
		request,
	}) => {
		await loginAndWaitForRealMap(page, request, "creator@test.local");

		await addDirectWaypointViaMapContextMenu(page, 250, 250);
		await addDirectWaypointViaMapContextMenu(page, 320, 250);
		await addDirectWaypointViaMapContextMenu(page, 390, 250);

		await waitForRouteCalculated(page);

		const draft = await getRouteDraft(page);
		expect(draft.waypoints).toHaveLength(3);
		expect(draft.hasRoute).toBe(true);
		expect(draft.distanceMeters ?? 0).toBeGreaterThan(0);
		expect(draft.durationSeconds ?? 0).toBeGreaterThan(0);
		expect(draft.waypoints.map((w) => w.type)).toEqual(["direct", "direct", "direct"]);
	});

	test("left-click 3 spots draws a road-following routed path", async ({ page, request }) => {
		await loginAndWaitForRealMap(page, request, "routed@test.local");

		await clickAtMapPixel(page, 250, 250);
		await clickAtMapPixel(page, 320, 250);
		await clickAtMapPixel(page, 390, 250);

		await waitForRouteCalculated(page);

		const draft = await getRouteDraft(page);
		expect(draft.waypoints).toHaveLength(3);
		expect(draft.waypoints.map((w) => w.type)).toEqual(["routed", "routed", "routed"]);
		expect(draft.hasRoute).toBe(true);
		// A straight line between 3 waypoints has 3 coords. A road-following
		// route has many more (one coord per turn/curve). 10 is a conservative
		// floor that still proves Mapbox Directions returned a real path.
		expect(draft.routePathLength).toBeGreaterThan(10);
		expect(draft.distanceMeters ?? 0).toBeGreaterThan(0);
		expect(draft.durationSeconds ?? 0).toBeGreaterThan(0);
	});

	test("routed start + direct segments populate RoutePath with both Types", async ({ page, request }) => {
		await loginAndWaitForRealMap(page, request, "mixed@test.local");

		await clickAtMapPixel(page, 250, 250);
		await addDirectWaypointViaMapContextMenu(page, 320, 250);
		await addDirectWaypointViaMapContextMenu(page, 390, 250);

		await waitForRouteCalculated(page);

		const draft = await getRouteDraft(page);
		expect(draft.waypoints.map((w) => w.type)).toEqual(["routed", "direct", "direct"]);
		expect(draft.hasRoute).toBe(true);
	});

	test("save round-trips through the real Save route UI", async ({ page, request }) => {
		await loginAndWaitForRealMap(page, request, "persist@test.local");

		await addDirectWaypointViaMapContextMenu(page, 250, 250);
		await addDirectWaypointViaMapContextMenu(page, 320, 250);
		await waitForRouteCalculated(page);

		await page.getByRole("button", { name: /^save$/i }).click();
		await page.getByPlaceholder("Schelde loop, long").fill("spec route");
		const saveResponse = page.waitForResponse(
			(r) => r.url().includes("/api/v1/routes") && r.request().method() === "POST",
			{ timeout: 15_000 },
		);
		await page.getByRole("button", { name: /save route/i }).click();
		const response = await saveResponse;
		expect(response.status()).toBe(201);
		const body = await response.json();
		expect(body.name).toBe("spec route");
		expect(body.waypoints).toHaveLength(2);
		expect(body.waypoints[0].type).toBe("direct");
		expect(body.waypoints[1].type).toBe("direct");
	});
});
