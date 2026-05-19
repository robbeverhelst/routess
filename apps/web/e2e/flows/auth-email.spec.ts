import { expect, type Page, test } from "@playwright/test";
import { seedUserWithPassword } from "../support/auth";
import { truncateDb } from "../support/db";
import { waitForBridge } from "../support/routessApi";

// Real email+password sign-in flow against the live auth UI. Seeds the User
// via `/test/seed-user` (bypasses the email-verification round-trip) so the
// spec can exercise the actual `Sign in with email → fill → submit → bridge`
// path through `/auth/login-email` end-to-end.

const PASSWORD = "correct-horse-battery-staple";

async function openEmailForm(page: Page): Promise<void> {
	// Pre-set the UI language to English so our role selectors match. The store
	// reads from `routingAppLanguage` on first render
	// (see LocalStorageService.saveLanguageToLocalStorage).
	await page.addInitScript(() => {
		window.localStorage.setItem("routingAppLanguage", "en");
	});
	await page.goto("/");
	await page.getByRole("button", { name: /sign in with email/i }).click();
}

async function fillAndSubmit(page: Page, email: string, password: string): Promise<void> {
	await page.locator('input[type="email"]').fill(email);
	await page.locator('input[type="password"]').fill(password);
	await page.locator('button[type="submit"]').click();
}

test.describe("email auth", () => {
	test.beforeEach(async () => {
		await truncateDb();
	});

	test("seeded user signs in via the real login UI", async ({ page, request }) => {
		const email = "alice@test.local";
		await seedUserWithPassword(request, email, PASSWORD, "Alice");

		await openEmailForm(page);
		await fillAndSubmit(page, email, PASSWORD);

		// Once authenticated, MapWithRouting mounts and the E2E bridge appears.
		await waitForBridge(page);
		const ready = await page.evaluate(() => window.__routess?.isReady() === true);
		expect(ready).toBe(true);
	});

	test("wrong password is rejected and bridge does not appear", async ({ page, request }) => {
		const email = "bob@test.local";
		await seedUserWithPassword(request, email, PASSWORD, "Bob");

		await openEmailForm(page);
		await fillAndSubmit(page, email, "totally-wrong-password");

		// Bridge should never come up because login failed.
		await expect.poll(async () => page.evaluate(() => typeof window.__routess), { timeout: 5_000 }).toBe("undefined");
	});
});
