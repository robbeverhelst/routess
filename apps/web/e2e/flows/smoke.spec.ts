import { expect, test } from "@playwright/test";
import { loginAndGoto } from "../support/auth";
import { truncateDb } from "../support/db";
import { waitForBridge } from "../support/routessApi";

test.describe("smoke", () => {
	test.beforeEach(async () => {
		await truncateDb();
	});

	test("app boots, bridge is exposed", async ({ page, request }) => {
		await loginAndGoto(page, request, "smoke@test.local");
		await waitForBridge(page);
		const ready = await page.evaluate(() => window.__routess?.isReady() === true);
		expect(ready).toBe(true);
	});
});
