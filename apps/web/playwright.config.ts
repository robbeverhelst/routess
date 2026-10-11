import { defineConfig, devices } from "@playwright/test";

// Browser E2E for the web app. The API and Stripe are faked per test
// (e2e/fake-routess.ts), so the suite needs only the built web app. It runs
// against `vite preview` of a production build: the dev server's first-load
// dependency optimisation reloads the page mid-test.
const PORT = Number(process.env.E2E_WEB_PORT ?? 4317);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	timeout: 60_000,
	expect: { timeout: 10_000 },
	reporter: "list",
	use: {
		baseURL: BASE_URL,
		locale: "en-GB",
		timezoneId: "Europe/Brussels",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		// The PWA service worker would answer requests the fakes must see.
		serviceWorkers: "block",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: `bunx vite build && bunx vite preview --port ${PORT} --strictPort`,
		url: BASE_URL,
		reuseExistingServer: !process.env.CI,
		timeout: 300_000,
	},
});
