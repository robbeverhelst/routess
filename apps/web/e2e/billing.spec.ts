import { expect, type Page, test } from "@playwright/test";

import { CHECKOUT_ORIGIN, E2E_USER, FakeRoutess } from "./fake-routess";

// The Pro year pass journey (ADR 0039) in a real browser: daily quota →
// paywall → Stripe Checkout (test-mode fake) → Pro active with its end date,
// and the one-time OG grant announced after login.

const TIME_ZONE = "Europe/Brussels";

// The day the app shows for an expiry: Intl long date in the UI language.
function shownDay(date: Date | null, language = "en"): string {
	if (!date) throw new Error("expected an expiry date");
	return new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: TIME_ZONE }).format(date);
}

async function setUp(page: Page, options: ConstructorParameters<typeof FakeRoutess>[1] = {}) {
	const baseURL = test.info().project.use.baseURL;
	if (!baseURL) throw new Error("baseURL is not configured");
	const fake = new FakeRoutess(new URL(baseURL).origin, options);
	await fake.install(page.context());
	return fake;
}

async function signIn(page: Page) {
	await page.getByRole("button", { name: /^(Sign in with email|Aanmelden met e-mail)$/ }).click();
	await page.locator("input[type=email]").fill(E2E_USER.email);
	await page.locator("input[type=password]").fill(E2E_USER.password);
	await page.locator("input[type=password]").press("Enter");
	await expect(page.locator("input[type=password]")).toHaveCount(0);
}

async function openPlanAndBilling(page: Page) {
	await page.goto("/");
	await page.getByRole("button", { name: "Settings", exact: true }).first().click();
	const plan = page.getByText("Plan & billing", { exact: true });
	await plan.scrollIntoViewIfNeeded();
	await expect(plan).toBeVisible();
}

test("free quota hit → paywall → Stripe Checkout → Pro active with its end date", async ({ page }) => {
	const fake = await setUp(page, { generationsUsed: 3, webhookDelayReads: 1 });
	await page.goto("/");
	await signIn(page);

	// The fourth generated route of the day is over the Free allowance.
	await page.getByRole("button", { name: "Generate loop" }).click();
	await page.getByRole("button", { name: "Generate", exact: true }).click();
	await expect(page.getByText("You've used today's 3 generated routes.")).toBeVisible();
	await page.getByRole("button", { name: "Get more with Pro" }).click();

	// The paywall: why it shows, the price, the comparison, the methods.
	await expect(page).toHaveURL(/\/upgrade\?from=quota/);
	await expect(
		page.getByRole("heading", { name: "Unlimited saves, knooppunt routes, navigation and more" }),
	).toBeVisible();
	await expect(page.getByText("You've used today's 3 generated routes. Pro gives you 50 a day.")).toBeVisible();
	await expect(page.getByTestId("upgrade-price")).toHaveText("€29.99");
	await expect(page.getByText("No subscription", { exact: true })).toBeVisible();
	const comparison = page.getByRole("table");
	await expect(comparison.getByRole("columnheader", { name: /Your plan\s*Free/ })).toBeVisible();
	await expect(comparison.getByRole("row", { name: /Generated routes a day\s*3\s*50/ })).toBeVisible();
	await expect(comparison.getByRole("row", { name: /Saved routes\s*5\s*Unlimited/ })).toBeVisible();
	const methods = page.getByRole("list", { name: "Pay with" });
	await expect(methods.getByRole("listitem")).toHaveText(["Bancontact", "iDEAL", "Card"]);

	// Hosted Checkout in test mode.
	await page.getByRole("button", { name: "Buy a year of Pro · €29.99" }).click();
	await expect(page).toHaveURL(new RegExp(`^${CHECKOUT_ORIGIN}/c/pay/cs_test_`));
	await expect(page.getByText("TEST MODE")).toBeVisible();
	await expect(page.getByTestId("checkout-amount")).toHaveText("€29.99");
	await page.getByLabel("iDEAL").check();
	await page.getByRole("button", { name: "Pay €29.99" }).click();

	// Back from Stripe: the page waits for the webhook, then shows Pro.
	await expect(page).toHaveURL(/\/upgrade\?checkout=success/);
	await expect(page.getByText("Thanks! Activating your pass.")).toBeVisible();
	const proStatus = page.getByTestId("pro-status");
	await expect(proStatus).toContainText("Pro is active");
	expect(fake.payments).toEqual([{ sessionId: expect.stringMatching(/^cs_test_/), method: "ideal", amount: 2999 }]);
	await expect(proStatus).toContainText(`Pro until ${shownDay(fake.proExpiresAt)}`);
	await expect(proStatus).toContainText("365 days left");
	await expect(page.getByRole("button", { name: "Add a year of Pro" })).toBeVisible();

	// Settings → Plan & billing shows the same end date.
	await openPlanAndBilling(page);
	await expect(page.getByTestId("billing-plan-sub")).toHaveText(
		`Pro until ${shownDay(fake.proExpiresAt)} · 365 days left`,
	);
	await expect(page.getByText("50 a day")).toBeVisible();
});

test("a cancelled checkout charges nothing and stays on Free", async ({ page }) => {
	const fake = await setUp(page);
	await page.goto("/");
	await signIn(page);
	await page.goto("/upgrade");

	await page.getByRole("button", { name: "Buy a year of Pro · €29.99" }).click();
	await expect(page).toHaveURL(new RegExp(`^${CHECKOUT_ORIGIN}/`));
	await page.getByRole("link", { name: "Back to Routess" }).click();

	await expect(page).toHaveURL(/\/upgrade\?checkout=cancelled/);
	await expect(page.getByText("Checkout cancelled. Nothing was charged.")).toBeVisible();
	await expect(page.getByTestId("pro-status")).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Buy a year of Pro · €29.99" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Continue with Free" })).toBeVisible();
	expect(fake.payments).toEqual([]);
	expect(fake.plan).toBe("free");
});

test("the OG grant is announced after the next login, and granted only once", async ({ page }) => {
	const fake = await setUp(page, { preLaunchAccount: true });
	await page.goto("/");
	await signIn(page);

	// The login applied the grant; the banner names when it ends.
	const ogUntil = fake.ogGrantExpiresAt;
	const banner = page.getByTestId("og-grant-banner");
	await expect(banner).toContainText("3 months of Pro, on us");
	await expect(banner).toContainText(`Your account has Pro until ${shownDay(ogUntil)}.`);
	await banner.getByRole("button", { name: "Dismiss" }).click();
	await expect(banner).toHaveCount(0);

	// Dismissed stays dismissed.
	await page.reload();
	await expect(page.getByRole("button", { name: "Generate loop" })).toBeVisible();
	await expect(page.getByTestId("og-grant-banner")).toHaveCount(0);

	// Sign in again: no second grant, the same end date, no banner.
	await page.evaluate(() => localStorage.removeItem("user"));
	await page.reload();
	await page.getByRole("button", { name: "Sign in", exact: true }).click();
	await signIn(page);
	await expect(page.getByRole("button", { name: "Generate loop" })).toBeVisible();
	await expect(page.getByTestId("og-grant-banner")).toHaveCount(0);

	// The paywall and settings show the granted Pro time.
	await page.goto("/upgrade");
	await expect(page.getByTestId("pro-status")).toContainText(`Pro until ${shownDay(ogUntil)}`);
	await expect(page.getByTestId("pro-status")).toContainText("includes your early-user months");
	await openPlanAndBilling(page);
	await expect(
		page.getByText(
			`Thanks for being an early Routess user: your account got 3 months of Pro, until ${shownDay(ogUntil)}.`,
		),
	).toBeVisible();
});

test("the OG banner leads to the paywall and does not come back", async ({ page }) => {
	await setUp(page, { preLaunchAccount: true });
	await page.goto("/");
	await signIn(page);

	await page.getByTestId("og-grant-banner").getByRole("button", { name: "See what's in Pro" }).click();
	await expect(page).toHaveURL(/\/upgrade$/);
	await expect(page.getByTestId("pro-status")).toContainText("Pro is active");
	await page.goto("/");
	await expect(page.getByRole("button", { name: "Generate loop" })).toBeVisible();
	await expect(page.getByTestId("og-grant-banner")).toHaveCount(0);
});

test("the paywall speaks Dutch", async ({ page }) => {
	await setUp(page);
	await page.addInitScript(() => localStorage.setItem("routingAppLanguage", "nl"));
	await page.goto("/upgrade");

	// Signed out, the paywall asks to sign in first, in place.
	await page.getByRole("button", { name: "Meld je aan om te kopen" }).click();
	await signIn(page);

	await expect(
		page.getByRole("heading", { name: "Onbeperkt bewaren, knooppuntroutes, navigatie en meer" }),
	).toBeVisible();
	await expect(page.getByText("Geen abonnement", { exact: true })).toBeVisible();
	await expect(page.getByTestId("upgrade-price")).toHaveText(/€\s?29,99/);
	await expect(page.getByRole("list", { name: "Betaal met" }).getByRole("listitem")).toHaveText([
		"Bancontact",
		"iDEAL",
		"Kaart",
	]);
	await expect(page.getByRole("button", { name: /^Koop een jaar Pro/ })).toBeVisible();
	await expect(page.getByRole("button", { name: "Verder met Gratis" })).toBeVisible();
});

test("a free account sees each gate's Pro state, and Go Pro opens checkout", async ({ page }) => {
	await setUp(page, { savedRoutes: 4 });
	await page.goto("/");
	await signIn(page);

	await page.getByRole("button", { name: "Library", exact: true }).first().click();
	await expect(page.getByTestId("saved-route-count")).toHaveText("4 of 5 saved");
	await page.getByRole("tab", { name: "Collections" }).click();
	const lock = page.getByTestId("pro-lock-collections");
	await expect(lock).toContainText("Creating collections and adding routes to them is part of Pro.");

	await lock.getByRole("button", { name: "Go Pro" }).click();
	await expect(page.getByText("TEST MODE")).toBeVisible();
});
