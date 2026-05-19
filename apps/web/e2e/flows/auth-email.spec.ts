import { expect, type Page, test } from "@playwright/test";
import { seedUserWithPassword } from "../support/auth";
import { truncateDb } from "../support/db";

// Real email+password sign-in flow against the live auth UI. Seeds the User
// via `/test/seed-user` (bypasses the email-verification round-trip) so the
// spec can exercise the actual `Sign in with email → fill → submit → bridge`
// path through `/auth/login-email` end-to-end.

const PASSWORD = "correct-horse-battery-staple";

async function openEmailForm(page: Page): Promise<void> {
	// Pre-seed: English locale (so role selectors match) + mark onboarding
	// (the WelcomeScreen / "You're in. Let's set you up.") as already completed,
	// so the post-login redirect goes straight to MapWithRouting and the
	// E2E bridge mounts.
	await page.addInitScript(() => {
		window.localStorage.setItem("routingAppLanguage", "en");
		window.localStorage.setItem(
			"routess-redesign-ui",
			JSON.stringify({ state: { welcomeCompleted: true }, version: 0 }),
		);
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

		const loginResponsePromise = page.waitForResponse(
			(r) => r.url().includes("/auth/login-email") && r.request().method() === "POST",
			{ timeout: 15_000 },
		);
		await fillAndSubmit(page, email, PASSWORD);
		const loginResp = await loginResponsePromise;
		expect(loginResp.status()).toBe(200);
		const body = (await loginResp.json()) as { accessToken: string; user: { email: string } };
		expect(body.accessToken).toBeTruthy();
		expect(body.user.email).toBe(email);

		// The server also sets an HttpOnly session cookie; that's how the app
		// stays authenticated. localStorage.user is set by the UI handler;
		// localStorage.access_token may or may not be present depending on the
		// api-client config — we don't depend on either here.
		await expect
			.poll(async () => page.evaluate(() => localStorage.getItem("user")), { timeout: 5_000 })
			.toContain("alice@test.local");
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
