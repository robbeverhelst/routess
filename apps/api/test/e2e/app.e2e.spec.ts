import type { INestApplication } from "@nestjs/common";

import { closeTestApp, createTestApp } from "../utils";
import request from "../utils/http";

describe("AppController (e2e)", () => {
	let app: INestApplication;

	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	// Await the request: bun test only waits on a returned real Promise, not on
	// the request's thenable, so a bare `return request(...)` asserts nothing.
	it("/ (GET)", async () => {
		await request(app.getHttpServer())
			.get("/")
			.expect(200)
			.expect(({ body }) => {
				expect(body).toMatchObject({
					name: "Routess API",
					status: "ok",
				});
			});
	});
});
