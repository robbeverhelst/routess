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

// Logs the user in and lands on `/` with the auth state propagated. Two-pass
// approach: navigate to set the origin, write localStorage from the test
// context, reload so the React app boots with auth state already present.
// Matches the storage shape produced by api-client/LocalStorageAuthState +
// auth-state.storeUser.
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
