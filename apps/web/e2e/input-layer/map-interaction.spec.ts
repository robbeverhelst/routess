import { expect, test } from "@playwright/test";
import { loginAndGoto } from "../support/auth";
import { truncateDb } from "../support/db";
import { applyHar } from "../support/har";
import { getRouteDraft, waitForBridge } from "../support/routessApi";
import { clickAtMapPixel, STABLE_CENTER, STABLE_ZOOM } from "../support/stable-map";

// Real pixel-event coverage of the map input layer (ADR-0019). Pinned to a
// fixed center/zoom so click targets are deterministic; assertions are on
// invariants (Waypoint count, control suppression) rather than specific
// lng/lat that would drift with Mapbox's projection details.

const HAR = "fixtures/har/map-interaction.har";

test.describe("map input layer", () => {
	test.beforeEach(async ({ page, request }) => {
		await truncateDb();
		await applyHar(page, HAR);
		await loginAndGoto(page, request, "map-input@test.local");
		await page.locator("canvas.mapboxgl-canvas").waitFor({ state: "visible", timeout: 30_000 });
		await page.waitForFunction(() => typeof window.__routess !== "undefined", undefined, { timeout: 30_000 });
		await page.evaluate(
			([lng, lat, zoom]) => {
				const api = window.__routess;
				if (!api) return;
				const map = (api.editor as unknown as { map?: { jumpTo: (o: object) => void } }).map;
				map?.jumpTo({ center: [lng, lat], zoom });
			},
			[STABLE_CENTER.lng, STABLE_CENTER.lat, STABLE_ZOOM] as const,
		);
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
		const zoomIn = page.locator(".mapboxgl-ctrl-zoom-in");
		await zoomIn.click();
		// Give the event loop a tick to propagate any erroneous map click.
		await page.waitForTimeout(200);
		const draft = await getRouteDraft(page);
		expect(draft.waypointCount).toBe(0);
	});

	test("two map clicks add two Waypoints in order", async ({ page }) => {
		await waitForBridge(page);
		await clickAtMapPixel(page, 250, 250);
		await page.waitForFunction(() => (window.__routess?.getRouteDraft().waypoints.length ?? 0) >= 1);
		await clickAtMapPixel(page, 400, 400);
		await page.waitForFunction(() => (window.__routess?.getRouteDraft().waypoints.length ?? 0) >= 2);
		const draft = await getRouteDraft(page);
		expect(draft.waypointCount).toBe(2);
	});
});
