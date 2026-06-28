import { describe, expect, mock, test } from "bun:test";
import { ApiDomainError, ApiHttpError } from "../errors";
import type { AuthStateManager, HttpClient } from "../types";
import { ApiClient } from "./ApiClient";

function spyAuthStateManager() {
	return {
		getToken: mock(() => null),
		setToken: mock(() => undefined),
		clearToken: mock(() => undefined),
		refreshToken: mock(() => undefined),
		clearAuthState: mock(() => undefined),
	} satisfies AuthStateManager;
}

// Stub that fails every verb with the supplied error, mimicking FetchHttpClient
// on a non-ok response.
function failingHttpClient(error: Error): HttpClient {
	const reject = () => Promise.reject(error);
	return {
		get: reject,
		getWithHeaders: reject,
		post: reject,
		put: reject,
		patch: reject,
		delete: reject,
	} as unknown as HttpClient;
}

describe("ApiClient auth-failure handling", () => {
	test("clears auth state when an expired session returns a coded 401 domain error", async () => {
		// This is exactly what the API's GlobalExceptionFilter emits and what
		// FetchHttpClient throws for an expired/invalidated session.
		const error = new ApiDomainError({
			statusCode: 401,
			code: "UNAUTHORIZED",
			message: "Session expired or user not found",
		});
		const auth = spyAuthStateManager();
		const client = new ApiClient({
			baseUrl: "http://test",
			httpClient: failingHttpClient(error),
			authStateManager: auth,
		});

		await expect(client.getProfile()).rejects.toThrow();

		expect(auth.clearAuthState).toHaveBeenCalledTimes(1);
		expect(auth.clearToken).toHaveBeenCalledTimes(1);
	});

	test("does NOT clear auth on a 403 forbidden (valid user, restricted route)", async () => {
		const error = new ApiDomainError({
			statusCode: 403,
			code: "FORBIDDEN",
			message: "Insufficient role",
		});
		const auth = spyAuthStateManager();
		const client = new ApiClient({
			baseUrl: "http://test",
			httpClient: failingHttpClient(error),
			authStateManager: auth,
		});

		await expect(client.adminGetOverview()).rejects.toThrow();

		expect(auth.clearAuthState).not.toHaveBeenCalled();
	});

	test("still clears auth on a raw ApiHttpError 401 (uncoded body)", async () => {
		const error = new ApiHttpError("API Error: 401 Unauthorized", 401);
		const auth = spyAuthStateManager();
		const client = new ApiClient({
			baseUrl: "http://test",
			httpClient: failingHttpClient(error),
			authStateManager: auth,
		});

		await expect(client.getProfile()).rejects.toThrow();

		expect(auth.clearAuthState).toHaveBeenCalledTimes(1);
	});

	test("does NOT clear auth on an unrelated 404", async () => {
		const error = new ApiDomainError({
			statusCode: 404,
			code: "NOT_FOUND",
			message: "Route not found",
		});
		const auth = spyAuthStateManager();
		const client = new ApiClient({
			baseUrl: "http://test",
			httpClient: failingHttpClient(error),
			authStateManager: auth,
		});

		await expect(client.getRoute(123)).rejects.toThrow();

		expect(auth.clearAuthState).not.toHaveBeenCalled();
		expect(auth.clearToken).not.toHaveBeenCalled();
	});
});
