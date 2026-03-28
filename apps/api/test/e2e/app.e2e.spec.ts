import type { INestApplication } from "@nestjs/common";
import supertest from "supertest";
import { closeTestApp, createTestApp } from "../utils";

describe("AppController (e2e)", () => {
	let app: INestApplication;

	beforeAll(async () => {
		app = await createTestApp();
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	it("/ (GET)", () => {
		return supertest(app.getHttpServer())
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
