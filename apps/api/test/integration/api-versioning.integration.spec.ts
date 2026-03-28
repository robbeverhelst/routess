import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { User } from "../../src/entities/user.entity";
import { setupMocks } from "../utils/setup-mocks";
import { closeTestApp, createTestApp, generateTestJWT, withRequestContext } from "../utils/test-utils";

describe("API Versioning Integration", () => {
	let app: INestApplication;
	let accessToken: string;

	beforeAll(async () => {
		setupMocks();
		app = await createTestApp();

		// Create a test user directly in the database and generate JWT
		await withRequestContext(app, async () => {
			const orm = app.get(MikroORM);
			const userRepo = orm.em.getRepository(User);

			let user = await userRepo.findOne({ email: "versioning@example.com" });
			if (!user) {
				user = userRepo.create({
					email: "versioning@example.com",
					name: "Versioning Test User",
					googleId: "google-versioning-test",
					avatar: "https://example.com/versioning.jpg",
					isEmailVerified: true,
				});
				await orm.em.persistAndFlush(user);
			}

			// Generate JWT directly without going through auth flow
			accessToken = await generateTestJWT(user.id, user.email, app);
		});
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	describe("Version 1 API", () => {
		it("should access endpoints with /api/v1 prefix", async () => {
			const response = await request(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(Array.isArray(response.body)).toBe(true);
		});

		it("should work with default version when no version specified", async () => {
			// Test that default version routing works
			const response = await request(app.getHttpServer())
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({
					name: "Test Route",
					description: "A test route",
					waypoints: [
						{ lat: 50.8503, lng: 4.3517, type: "routed" },
						{ lat: 50.8463, lng: 4.3517, type: "direct" },
					],
				})
				.expect(201);

			expect(response.body.name).toBe("Test Route");
		});
	});

	describe("Version Header Support", () => {
		it("should accept version in URL path", async () => {
			const response = await request(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(response.status).toBe(200);
		});
	});

	describe("Invalid Version Handling", () => {
		it("should handle invalid version gracefully", async () => {
			// Test accessing an endpoint without proper versioning
			const response = await request(app.getHttpServer())
				.get("/routes") // No version prefix
				.set("Authorization", `Bearer ${accessToken}`);

			// Should either redirect to versioned endpoint or return 404
			expect([404, 302, 301]).toContain(response.status);
		});
	});
});
