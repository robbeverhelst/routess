import { MikroORM, RequestContext } from "@mikro-orm/core";
import { type INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import compression from "compression";
import helmet from "helmet";
import { AppModule } from "src/app.module";
import { GlobalExceptionFilter } from "../../src/common/filters/global-exception.filter";
import { User } from "../../src/entities/user.entity";

export async function createTestApp(): Promise<INestApplication> {
	process.env.NODE_ENV = "test";
	process.env.DB_NAME = "routess_db_test"; // Use test database
	process.env.GOOGLE_CLIENT_ID = "test-google-client-id"; // Mock Google Client ID
	process.env.JWT_SECRET = "test-secret-key"; // Ensure JWT secret is set

	const moduleFixture: TestingModule = await Test.createTestingModule({
		imports: [AppModule],
	}).compile();

	const app = moduleFixture.createNestApplication();

	// Apply middleware like in main.ts
	app.use(
		compression({
			filter: (req, res) => {
				if (req.headers["x-no-compression"]) {
					return false;
				}
				return compression.filter(req, res);
			},
			threshold: 1024,
		}),
	);

	app.use(
		helmet({
			contentSecurityPolicy: {
				directives: {
					defaultSrc: ["'self'"],
					styleSrc: ["'self'", "'unsafe-inline'"],
					scriptSrc: ["'self'"],
					imgSrc: ["'self'", "data:", "https:"],
				},
			},
			crossOriginEmbedderPolicy: false,
		}),
	);

	// Enable API versioning
	app.enableVersioning({
		type: VersioningType.URI,
		defaultVersion: "1",
		prefix: "api/v",
	});

	app.useGlobalFilters(new GlobalExceptionFilter());

	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			transform: true,
			forbidNonWhitelisted: true,
			transformOptions: {
				enableImplicitConversion: true,
			},
		}),
	);

	app.enableCors({
		origin: process.env.FRONTEND_URL || "http://localhost:3001",
	});

	await app.init();
	return app;
}

export async function clearDatabase(app: INestApplication) {
	const orm = app.get(MikroORM);
	await RequestContext.create(orm.em, async () => {
		const generator = orm.getSchemaGenerator();
		await generator.refreshDatabase();
	});
}

export async function closeTestApp(app: INestApplication) {
	await app.close();
}

export function generateTestJWT(userId: number, email: string, app: INestApplication): string {
	const jwtService = app.get(JwtService);
	return jwtService.sign({ sub: userId, email });
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
		await orm.em.persistAndFlush(user);

		accessToken = generateTestJWT(user.id, user.email, app);
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
