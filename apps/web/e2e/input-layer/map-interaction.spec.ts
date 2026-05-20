import { expect, test } from "@playwright/test";
import { loginViaEmailUI } from "../support/auth";
import { truncateDb } from "../support/db";
import { getRouteDraft, waitForBridge } from "../support/routessApi";
import { clickAtMapPixel, rightClickAtMapPixel } from "../support/stable-map";

// Real pixel-event coverage of the map input layer (ADR-0019). Pinned to a
// fixed center/zoom so click targets are deterministic; assertions are on
// invariants (Waypoint count, control suppression) rather than specific
// lng/lat that would drift with Mapbox's projection details.

test.describe("map input layer with real Mapbox", () => {
	test.beforeEach(async ({ page, request }) => {
		await truncateDb();
		await loginViaEmailUI(page, request, "map-input@test.local");
		await page.locator("canvas.mapboxgl-canvas").waitFor({ state: "visible", timeout: 30_000 });
		await page.waitForFunction(() => typeof window.__routess !== "undefined", undefined, { timeout: 30_000 });
	});

	test("click on the map canvas adds a Waypoint", async ({ page }) => {
		await waitForBridge(page);
		await clickAtMapPixel(page, 300, 300);
		await page.waitForFunction(() => (window.__routess?.getRouteDraft().waypoints.length ?? 0) > 0, undefined, {
			timeout: 5_000,
		});
		const draft = await getRouteDraft(page);
		expect(draft.waypointCount).toBe(1);
	});

	test("click on the zoom-in control does NOT add a Waypoint", async ({ page }) => {
		await waitForBridge(page);
		await page.getByRole("button", { name: /zoom in/i }).click();
		// Give the event loop a tick to propagate any erroneous map click.
		await page.waitForTimeout(200);
		const draft = await getRouteDraft(page);
		expect(draft.waypointCount).toBe(0);
	});

	test("map context menu adds a direct Waypoint after a routed Waypoint", async ({ page }) => {
		await waitForBridge(page);
		await clickAtMapPixel(page, 250, 250);
		await page.waitForFunction(() => (window.__routess?.getRouteDraft().waypoints.length ?? 0) >= 1);
		await rightClickAtMapPixel(page, 390, 250);
		await page.getByRole("button", { name: /add direct waypoint/i }).click();
		await page.waitForFunction(() => (window.__routess?.getRouteDraft().waypoints.length ?? 0) >= 2);
		const draft = await getRouteDraft(page);
		expect(draft.waypointCount).toBe(2);
		expect(draft.waypoints.map((w) => w.type)).toEqual(["routed", "direct"]);
	});
});
