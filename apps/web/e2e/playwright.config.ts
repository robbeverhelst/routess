import { defineConfig, devices } from "@playwright/test";

// Dedicated E2E ports so a developer's `bun dev` (5173/3000) or another
// Conductor workspace doesn't get reused as the API. Override via env if you
// need to point at an already-running stack.
const WEB_PORT = process.env.E2E_WEB_PORT ?? "5183";
const API_PORT = process.env.E2E_API_PORT ?? "3010";

const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${WEB_PORT}`;

// See ADR-0017 (real backend, HAR-replayed externals), ADR-0019 (editor handle),
// ADR-0020 (release-gating + flake discipline).

export default defineConfig({
	testDir: ".",
	timeout: 60_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	workers: process.env.CI ? 1 : 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
	outputDir: "./test-results",
	use: {
		baseURL,
		trace: process.env.E2E_UI ? "on" : "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium-desktop",
			use: {
				...devices["Desktop Chrome"],
			},
		},
		// v1.1: enable mobile project for flow specs only
		// { name: "chromium-mobile", use: devices["iPhone 14"], testMatch: /flows\// },
	],
	webServer: process.env.E2E_NO_WEBSERVER
		? undefined
		: [
				{
					command: "bun run --filter './apps/api' start:e2e",
					url: `http://localhost:${API_PORT}/health`,
					timeout: 120_000,
					reuseExistingServer: false,
					stdout: "pipe",
					stderr: "pipe",
					env: {
						...process.env,
						NODE_ENV: "test",
						LOG_LEVEL: process.env.LOG_LEVEL ?? "silent",
						PORT: API_PORT,
						DB_HOST: "localhost",
						DB_PORT: process.env.E2E_DB_PORT ?? "5432",
						DB_USER: "postgres",
						DB_PASSWORD: "postgres",
						DB_NAME: "routess_db_e2e",
						FRONTEND_URL: `http://localhost:${WEB_PORT}`,
						FRONTEND_URLS: `http://localhost:${WEB_PORT}`,
						JWT_SECRET: "e2e-jwt-secret-not-for-prod",
						GOOGLE_CLIENT_ID: "e2e-google-client-id.apps.googleusercontent.com",
						E2E_TEST_LOGIN_SECRET: process.env.E2E_TEST_LOGIN_SECRET ?? "",
					} as Record<string, string>,
					cwd: "../../..",
				},
				{
					command: `bun run --filter './apps/web' dev`,
					url: baseURL,
					timeout: 120_000,
					reuseExistingServer: false,
					stdout: "pipe",
					stderr: "pipe",
					env: {
						...process.env,
						WEB_PORT,
						VITE_E2E: "true",
						VITE_API_URL: `http://localhost:${API_PORT}`,
						VITE_APP_URL: `http://localhost:${WEB_PORT}`,
						VITE_GOOGLE_CLIENT_ID: "e2e-google-client-id.apps.googleusercontent.com",
						VITE_LOG_LEVEL: process.env.VITE_LOG_LEVEL ?? "none",
					} as Record<string, string>,
					cwd: "../../..",
				},
			],
});
