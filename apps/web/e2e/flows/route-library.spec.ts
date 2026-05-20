import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { loginViaEmailUI, testLogin } from "../support/auth";
import { truncateDb } from "../support/db";

const API = `http://localhost:${process.env.E2E_API_PORT ?? "3010"}/api/v1`;

async function createSavedRoute(
	request: APIRequestContext,
	email: string,
	overrides: Partial<{
		name: string;
		activity: "run" | "cycle" | "walk";
		distance: number;
		duration: number;
	}> = {},
) {
	const auth = await testLogin(request, email);
	const response = await request.post(`${API}/routes`, {
		headers: { Authorization: `Bearer ${auth.accessToken}` },
		data: {
			name: overrides.name ?? "my saved loop",
			activity: overrides.activity ?? "cycle",
			visibility: "private",
			waypoints: [
				{ coord: [4.4025, 51.2194], type: "routed" },
				{ coord: [4.4115, 51.2225], type: "routed" },
			],
			distance: overrides.distance ?? 1500,
			duration: overrides.duration ?? 360,
		},
	});
	if (!response.ok()) {
		throw new Error(`Failed to seed saved route: ${response.status()} ${await response.text()}`);
	}
}

async function openLibrary(page: Page) {
	await page.getByTitle("Library").click();
	await expect(page.getByPlaceholder(/search routes/i)).toBeVisible();
}

test.describe("route library UI", () => {
	test.beforeEach(async () => {
		await truncateDb();
	});

	test("signed-in user sees a saved route in the Library panel", async ({ page, request }) => {
		await createSavedRoute(request, "library@test.local", { name: "my saved loop" });
		await loginViaEmailUI(page, request, "library@test.local");

		await openLibrary(page);

		await expect(page.getByText("my saved loop")).toBeVisible();
		await expect(page.getByText("1 route")).toBeVisible();
		await expect(page.getByText("2 wp")).toBeVisible();
	});

	test("search filters the visible route cards", async ({ page, request }) => {
		await createSavedRoute(request, "searcher@test.local", { name: "City coffee loop" });
		await createSavedRoute(request, "searcher@test.local", { name: "Forest climb" });
		await loginViaEmailUI(page, request, "searcher@test.local");

		await openLibrary(page);
		await expect(page.getByText("City coffee loop")).toBeVisible();
		await expect(page.getByText("Forest climb")).toBeVisible();

		await page.getByPlaceholder(/search routes/i).fill("forest");

		await expect(page.getByText("Forest climb")).toBeVisible();
		await expect(page.getByText("City coffee loop")).toBeHidden();
		await expect(page.getByText("1 route")).toBeVisible();
	});

	test("another user's routes stay hidden in the Library panel", async ({ page, request }) => {
		await createSavedRoute(request, "owner@test.local", { name: "owner private route" });
		await loginViaEmailUI(page, request, "other@test.local");

		await page.getByTitle("Library").click();

		await expect(page.getByText("No routes yet")).toBeVisible();
		await expect(page.getByText("owner private route")).toHaveCount(0);
	});
});
