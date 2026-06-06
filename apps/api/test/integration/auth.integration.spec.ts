import { MikroORM } from "@mikro-orm/core";
import { type INestApplication, UnauthorizedException } from "@nestjs/common";
import {
	GOOGLE_IDENTITY_VERIFIER,
	type GoogleIdentity,
	type GoogleIdentityVerifier,
} from "src/auth/google-identity-verifier";
import { User } from "src/entities/user.entity";
import { UserAuthMethod } from "src/entities/user-auth-method.entity";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth, withRequestContext } from "../utils";

class FakeGoogleVerifier implements GoogleIdentityVerifier {
	private next: GoogleIdentity | Error | null = null;

	resolveNext(identity: GoogleIdentity) {
		this.next = identity;
	}

	rejectNext(error: Error) {
		this.next = error;
	}

	clear() {
		this.next = null;
	}

	async verify(): Promise<GoogleIdentity> {
		if (this.next instanceof Error) throw this.next;
		if (!this.next) throw new UnauthorizedException("Failed to authenticate with Google");
		return this.next;
	}
}

describe("Auth Integration Tests", () => {
	let app: INestApplication;
	let orm: MikroORM;
	let verifier: FakeGoogleVerifier;

	beforeAll(async () => {
		verifier = new FakeGoogleVerifier();
		app = await createTestApp({
			configure: (builder) => builder.overrideProvider(GOOGLE_IDENTITY_VERIFIER).useValue(verifier),
		});
		orm = app.get(MikroORM);
	});

	beforeEach(async () => {
		await clearDatabase(app);
		verifier.clear();
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	describe("POST /auth/google", () => {
		it("should create a new user when valid Google token is provided", async () => {
			verifier.resolveNext({
				googleId: "google-user-123",
				email: "test@example.com",
				name: "Test User",
				picture: "https://example.com/picture.jpg",
			});

			const response = await supertest(app.getHttpServer())
				.post("/api/v1/auth/google")
				.send({ code: "mock-google-code" })
				.expect(201);

			expect(response.body).toHaveProperty("accessToken");
			expect(response.body).toHaveProperty("user");
			expect(response.body.user.email).toBe("test@example.com");

			// Verify user was created in database with a Google auth method.
			// Provider-specific identifiers live on UserAuthMethod (not User) since
			// the auth refactor in #134.
			await withRequestContext(app, async () => {
				const user = await orm.em.findOne(User, { email: "test@example.com" });
				expect(user).toBeDefined();
				const method = await orm.em.findOne(UserAuthMethod, { provider: "google", providerId: "google-user-123" });
				expect(method).toBeDefined();
				expect((method?.user as unknown as { id: number } | undefined)?.id).toBe(user?.id);
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
				await orm.em.persist(existingUser).flush();
				existingUserId = existingUser.id;
			});

			verifier.resolveNext({
				googleId: "google-existing-123",
				email: "existing@example.com",
				name: "Existing User",
				picture: "https://example.com/existing.jpg",
			});

			const response = await supertest(app.getHttpServer())
				.post("/api/v1/auth/google")
				.send({ code: "mock-google-code" })
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
			verifier.rejectNext(new UnauthorizedException("Failed to authenticate with Google"));

			const response = await supertest(app.getHttpServer()).post("/api/v1/auth/google").send({ code: "invalid-code" });

			expect(response.status).toBe(401);
		});

		it("should fail without code", async () => {
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
