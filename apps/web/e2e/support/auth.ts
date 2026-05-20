import type { APIRequestContext, Page } from "@playwright/test";

const TEST_LOGIN_SECRET = process.env.E2E_TEST_LOGIN_SECRET ?? "";
const API_PORT = process.env.E2E_API_PORT ?? "3010";

interface TestLoginResponse {
	accessToken: string;
	user: { id: number; email: string; name: string; role: string };
}

export async function testLogin(request: APIRequestContext, email: string): Promise<TestLoginResponse> {
	if (!TEST_LOGIN_SECRET) {
		throw new Error("E2E_TEST_LOGIN_SECRET is not set; the API will reject /test/login");
	}
	const response = await request.post(`http://localhost:${API_PORT}/api/v1/test/login`, {
		headers: { "x-test-secret": TEST_LOGIN_SECRET },
		data: { email },
	});
	if (!response.ok()) {
		throw new Error(`/test/login failed: ${response.status()} ${await response.text()}`);
	}
	return response.json();
}

// Seeds a User with an email+password auth method, bypassing the signup-email
// → verify-email round-trip. Used to set up a known account that a spec can
// then log in to via the real `/auth/login-email` endpoint (and the real UI).
export async function seedUserWithPassword(
	request: APIRequestContext,
	email: string,
	password: string,
	name?: string,
): Promise<void> {
	if (!TEST_LOGIN_SECRET) {
		throw new Error("E2E_TEST_LOGIN_SECRET is not set; the API will reject /test/seed-user");
	}
	const response = await request.post(`http://localhost:${API_PORT}/api/v1/test/seed-user`, {
		headers: { "x-test-secret": TEST_LOGIN_SECRET },
		data: { email, password, name },
	});
	if (!response.ok()) {
		throw new Error(`/test/seed-user failed: ${response.status()} ${await response.text()}`);
	}
}

// DEPRECATED. The /test/login backdoor mints a JWT directly but localStorage
// propagation through reload has been unreliable. Prefer loginViaEmailUI which
// exercises the real /auth/login-email path and matches what a user does.
export async function loginAndGoto(
	page: Page,
	request: APIRequestContext,
	email: string,
	path = "/",
): Promise<TestLoginResponse> {
	const auth = await testLogin(request, email);
	await page.goto(path);
	await page.evaluate(
		([token, user]) => {
			window.localStorage.setItem("access_token", token);
			window.localStorage.setItem("user", JSON.stringify(user));
		},
		[auth.accessToken, auth.user] as const,
	);
	await page.reload();
	return auth;
}

const DEFAULT_PASSWORD = "correct-horse-battery-staple";

export async function installE2EUiState(page: Page): Promise<void> {
	await page.addInitScript(() => {
		window.localStorage.setItem("routingAppLanguage", "en");
		window.localStorage.setItem(
			"routess-redesign-ui",
			JSON.stringify({ state: { welcomeCompleted: true }, version: 0 }),
		);
		window.localStorage.setItem(
			"mapLastView",
			JSON.stringify({ longitude: 4.4025, latitude: 51.2194, zoom: 14, bearing: 0, pitch: 30 }),
		);
	});
}

// Real sign-in flow: seeds a User with an email+password auth method (via the
// test backdoor that skips email verification), then drives the actual Sign-in
// UI through `/auth/login-email`. Returns once the API has responded 200.
//
// Pre-seeds two pieces of localStorage:
//   - `routingAppLanguage = "en"` so role/text selectors match
//   - `routess-redesign-ui = { state: { welcomeCompleted: true } }` so the
//     post-login onboarding (`You're in. Let's set you up.`) is skipped
export async function loginViaEmailUI(
	page: Page,
	request: APIRequestContext,
	email: string,
	password: string = DEFAULT_PASSWORD,
	name?: string,
): Promise<void> {
	await seedUserWithPassword(request, email, password, name);
	await installE2EUiState(page);
	await page.goto("/");

	await page.getByRole("button", { name: /sign in with email/i }).click();
	await page.locator('input[type="email"]').fill(email);
	await page.locator('input[type="password"]').fill(password);
	const loginResponse = page.waitForResponse(
		(r) => r.url().includes("/auth/login-email") && r.request().method() === "POST",
		{ timeout: 15_000 },
	);
	await page.locator('button[type="submit"]').click();
	const resp = await loginResponse;
	if (resp.status() !== 200) {
		throw new Error(`Sign-in failed: ${resp.status()} ${await resp.text()}`);
	}
}
