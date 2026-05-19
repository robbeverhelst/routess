import { expect, test } from "@playwright/test";
import { loginViaEmailUI } from "../support/auth";
import { truncateDb } from "../support/db";

// Smoke: the full stack is wired and a user can sign in. Intentionally does
// not assert anything that depends on Mapbox loading (the WebGL pipeline is
// flaky in headless chromium); the deeper map-dependent flows live in their
// own specs and are gated separately.

test.describe("smoke", () => {
	test.beforeEach(async () => {
		await truncateDb();
	});

	test("app boots, user can sign in", async ({ page, request }) => {
		await loginViaEmailUI(page, request, "smoke@test.local");
		const storedUser = await page.evaluate(() => localStorage.getItem("user"));
		expect(storedUser).toContain("smoke@test.local");
	});
});
