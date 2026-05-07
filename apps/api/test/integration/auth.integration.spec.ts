import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";
import { User } from "src/entities/user.entity";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth, withRequestContext } from "../utils";

describe("Auth Integration Tests", () => {
	let app: INestApplication;
	let orm: MikroORM;
	let mockVerifyIdToken: jest.Mock;

	beforeAll(async () => {
		// Setup OAuth2Client mock by overriding the prototype
		mockVerifyIdToken = jest.fn();

		// Override the prototype method directly
		OAuth2Client.prototype.verifyIdToken = mockVerifyIdToken;

		app = await createTestApp();
		orm = app.get(MikroORM);
	});

	beforeEach(async () => {
		await clearDatabase(app);
		mockVerifyIdToken.mockClear();
	});

	afterAll(async () => {
		await closeTestApp(app);
		jest.restoreAllMocks();
	});

	describe("POST /auth/google", () => {
		it("should create a new user when valid Google token is provided", async () => {
			// Mock Google OAuth verification
			const mockGooglePayload = {
				sub: "google-user-123",
				email: "test@example.com",
				name: "Test User",
				picture: "https://example.com/picture.jpg",
			};

			// Set up the mock response
			mockVerifyIdToken.mockResolvedValue({
				getPayload: () => mockGooglePayload,
			});

			const response = await supertest(app.getHttpServer())
				.post("/api/v1/auth/google")
				.send({ credential: "mock-google-token" })
				.expect(201);

			expect(response.body).toHaveProperty("accessToken");
			expect(response.body).toHaveProperty("user");
			expect(response.body.user.email).toBe("test@example.com");

			// Verify user was created in database
			await withRequestContext(app, async () => {
				const user = await orm.em.findOne(User, { email: "test@example.com" });
				expect(user).toBeDefined();
				expect(user?.googleId).toBe("google-user-123");
			});
		});

		it("should return existing user when Google user already exists", async () => {
			// Create existing user
			let existingUserId: number;
			await withRequestContext(app, async () => {
				const existingUser = orm.em.create(User, {
					email: "existing@example.com",
					name: "Existing User",
					googleId: "google-existing-123",
					avatar: "https://example.com/existing.jpg",
				});
				await orm.em.persistAndFlush(existingUser);
				existingUserId = existingUser.id;
			});

			const mockGooglePayload = {
				sub: "google-existing-123",
				email: "existing@example.com",
				name: "Existing User",
				picture: "https://example.com/existing.jpg",
			};

			mockVerifyIdToken.mockResolvedValue({
				getPayload: () => mockGooglePayload,
			});

			const response = await supertest(app.getHttpServer())
				.post("/api/v1/auth/google")
				.send({ credential: "mock-google-token" })
				.expect(201);

			expect(existingUserId).toBeDefined();
			expect(response.body.user.id).toBe(existingUserId);

			// Verify only one user exists
			await withRequestContext(app, async () => {
				const userCount = await orm.em.count(User);
				expect(userCount).toBe(1);
			});
		});

		it("should fail with invalid Google token", async () => {
			// Use a more controlled error approach that doesn't throw during test execution
			mockVerifyIdToken.mockImplementation(() => {
				return Promise.reject(new Error("Invalid token"));
			});

			const response = await supertest(app.getHttpServer())
				.post("/api/v1/auth/google")
				.send({ credential: "invalid-token" });

			expect(response.status).toBe(401);
		});

		it("should fail without credential", async () => {
			await supertest(app.getHttpServer()).post("/api/v1/auth/google").send({}).expect(400);
		});
	});

	describe("JWT Authentication", () => {
		let validToken: string;

		beforeEach(async () => {
			// Create test user
			const { accessToken } = await createTestUserWithAuth(app, {
				email: "jwt-test@example.com",
				name: "JWT Test User",
				googleId: "google-jwt-test",
				avatar: "https://example.com/jwt-test.jpg",
			});

			validToken = accessToken;
		});

		it("should access protected route with valid JWT", async () => {
			await supertest(app.getHttpServer())
				.get("/api/v1/users/me")
				.set("Authorization", `Bearer ${validToken}`)
				.expect(200);
		});

		it("should fail to access protected route without JWT", async () => {
			await supertest(app.getHttpServer()).get("/api/v1/users/me").expect(401);
		});

		it("should fail to access protected route with invalid JWT", async () => {
			await supertest(app.getHttpServer())
				.get("/api/v1/users/me")
				.set("Authorization", "Bearer invalid-token")
				.expect(401);
		});
	});
});
