import { MikroORM, RequestContext } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule, type TestingModuleBuilder } from "@nestjs/testing";
import { ThrottlerStorage } from "@nestjs/throttler";
import { configureApplication } from "../../src/app/app-setup";
import { SessionService } from "../../src/auth/session.service";
import { getAppConfig, loadEnvironment } from "../../src/config/app-config";
import { User } from "../../src/entities/user.entity";
import { initializeOpenTelemetry } from "../../src/telemetry/tracing";

type TestAppOptions = {
	configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
};

export async function createTestApp(options: TestAppOptions = {}): Promise<INestApplication> {
	process.env.NODE_ENV = "test";
	process.env.DB_NAME = "routess_db_test"; // Use test database
	process.env.GOOGLE_CLIENT_ID = "test-google-client-id"; // Mock Google Client ID
	process.env.JWT_SECRET = "test-secret-key"; // Ensure JWT secret is set
	process.env.SWAGGER_ENABLED = "false";
	process.env.METRICS_ENABLED = "true";

	loadEnvironment();
	initializeOpenTelemetry(getAppConfig());
	const { AppModule } = await import("../../src/app.module");

	const builder = Test.createTestingModule({
		imports: [AppModule],
	});
	const configuredBuilder = options.configure ? options.configure(builder) : builder;
	const moduleFixture: TestingModule = await configuredBuilder.compile();

	const app = moduleFixture.createNestApplication();
	configureApplication(app, getAppConfig());

	await app.init();
	await clearDatabase(app);
	return app;
}

export async function clearDatabase(app: INestApplication) {
	const orm = app.get(MikroORM);
	await RequestContext.create(orm.em, async () => {
		await orm.schema.refresh();
	});
	// Rate-limit buckets are in-memory and would otherwise accumulate across
	// tests within one app instance, making test outcomes order-dependent.
	const throttlerStorage = app.get<{ storage: Map<string, unknown> }>(ThrottlerStorage, { strict: false });
	throttlerStorage?.storage?.clear();
}

export async function closeTestApp(app: INestApplication) {
	await app.close();
}

export async function generateTestJWT(userId: number, _email: string, app: INestApplication): Promise<string> {
	const sessionService = app.get(SessionService);
	return sessionService.createSession(userId, {
		userAgent: "bun-test",
		ipAddress: "127.0.0.1",
	});
}

export async function createTestUserWithAuth(
	app: INestApplication,
	userData: Partial<{
		email: string;
		name: string;
		googleId: string;
		avatar: string;
		isEmailVerified: boolean;
	}> = {},
): Promise<{ user: User; accessToken: string }> {
	const defaultUserData = {
		email: "test@example.com",
		name: "Test User",
		googleId: "google-test-user",
		avatar: "https://example.com/test.jpg",
		isEmailVerified: true,
		...userData,
	};

	let user: User | undefined;
	let accessToken: string | undefined;

	await withRequestContext(app, async () => {
		const orm = app.get(MikroORM);
		const userRepo = orm.em.getRepository(User);

		user = userRepo.create(defaultUserData);
		await orm.em.persist(user).flush();

		accessToken = await generateTestJWT(user.id, user.email, app);
	});

	if (!user || !accessToken) {
		throw new Error("Failed to create test user and access token");
	}

	return { user, accessToken };
}

export async function withRequestContext<T>(app: INestApplication, callback: () => Promise<T>): Promise<T> {
	const orm = app.get(MikroORM);
	return RequestContext.create(orm.em, callback);
}
