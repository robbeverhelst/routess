import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { configureApplication } from "../../src/app/app-setup";
import { getAppConfig, loadEnvironment } from "../../src/config/app-config";
import { initializeOpenTelemetry } from "../../src/telemetry/tracing";
import { setupMocks } from "../utils/setup-mocks";

// Regression test for the MikroORM v7 lazy-connect readiness deadlock: the
// app must report ready right after boot, before any request has touched the
// database. Deliberately avoids createTestApp(), whose schema refresh
// connects the app's ORM and would mask the bug.
describe("Health readiness on a freshly booted app", () => {
	let app: INestApplication;

	beforeAll(async () => {
		setupMocks();
		process.env.NODE_ENV = "test";
		process.env.DB_NAME = "routess_db_test";
		process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
		process.env.JWT_SECRET = "test-secret-key";
		process.env.SWAGGER_ENABLED = "false";

		loadEnvironment();
		initializeOpenTelemetry(getAppConfig());

		// Ensure the test database exists using a throwaway ORM instance so the
		// app's own ORM stays untouched until the readiness probe hits it.
		const { default: config } = await import("../../src/mikro-orm.config");
		const bootstrapOrm = await MikroORM.init(config);
		await bootstrapOrm.schema.ensureDatabase();
		await bootstrapOrm.close(true);

		const { AppModule } = await import("../../src/app.module");
		const moduleFixture = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		configureApplication(app, getAppConfig());
		await app.init();
	});

	afterAll(async () => {
		await app?.close();
	});

	it("returns 200 on /health/ready without prior database traffic", async () => {
		const response = await request(app.getHttpServer()).get("/health/ready").expect(200);

		expect(response.body.status).toBe("ok");
		expect(response.body.details.database.status).toBe("up");
	});

	it("becomes ready even when the lazy connection is not yet established", async () => {
		// Force the not-yet-connected state a fresh production pod boots into:
		// the probe itself must establish the connection, not just report on it.
		const orm = app.get(MikroORM);
		await orm.em.getConnection().close();
		expect(await orm.isConnected()).toBe(false);

		const response = await request(app.getHttpServer()).get("/health/ready").expect(200);

		expect(response.body.details.database.status).toBe("up");
		expect(await orm.isConnected()).toBe(true);
	});
});
