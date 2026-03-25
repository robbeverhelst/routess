import type { INestApplication } from "@nestjs/common";
import supertest from "supertest";
import type { User } from "../../src/entities/user.entity";
import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth } from "../utils";

describe("User Flows E2E Tests", () => {
	let app: INestApplication;

	beforeAll(async () => {
		app = await createTestApp();
	});

	beforeEach(async () => {
		await clearDatabase(app);
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	describe("Complete User Journey: Sign up → Create Route → View Routes → Delete Route", () => {
		it("should complete full user journey", async () => {
			// Step 1: Create test user and get access token
			const { user, accessToken } = await createTestUserWithAuth(app, {
				email: "e2e@example.com",
				name: "E2E Test User",
				googleId: "google-e2e-user",
				avatar: "https://example.com/e2e.jpg",
			});

			expect(accessToken).toBeDefined();
			expect(user.email).toBe("e2e@example.com");

			// Step 2: User creates their first route
			const routeData = {
				name: "My Morning Run",
				description: "Daily running route through the park",
				waypoints: [
					{ lat: 52.52, lng: 13.405, timestamp: new Date().toISOString(), type: "routed" },
					{ lat: 52.522, lng: 13.407, timestamp: new Date().toISOString(), type: "routed" },
					{ lat: 52.524, lng: 13.409, timestamp: new Date().toISOString(), type: "routed" },
				],
				distance: 3500,
				duration: 1200,
				elevationGain: 25,
				startAddress: "Alexanderplatz, Berlin",
				endAddress: "Brandenburg Gate, Berlin",
			};

			const createRouteResponse = await supertest(app.getHttpServer())
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${accessToken}`)
				.send(routeData)
				.expect(201);

			const createdRoute = createRouteResponse.body;
			expect(createdRoute.name).toBe("My Morning Run");
			expect(createdRoute.user.id).toBe(user.id);

			// Step 3: User views their routes
			const routesListResponse = await supertest(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(routesListResponse.body).toHaveLength(1);
			expect(routesListResponse.body[0].id).toBe(createdRoute.id);

			// Step 4: User views specific route details
			const routeDetailResponse = await supertest(app.getHttpServer())
				.get(`/api/v1/routes/${createdRoute.id}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(routeDetailResponse.body.waypoints).toHaveLength(3);

			// Step 5: User updates their route
			const updateData = {
				name: "My Evening Run",
				description: "Changed to evening schedule",
			};

			const updateResponse = await supertest(app.getHttpServer())
				.patch(`/api/v1/routes/${createdRoute.id}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.send(updateData)
				.expect(200);

			expect(updateResponse.body.name).toBe("My Evening Run");

			// Step 6: User deletes their route
			await supertest(app.getHttpServer())
				.delete(`/api/v1/routes/${createdRoute.id}`)
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Step 7: Verify route is deleted (soft delete)
			const finalRoutesResponse = await supertest(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(finalRoutesResponse.body).toHaveLength(0);
		});
	});

	describe("Multi-User Collaboration Flow", () => {
		it("should handle multiple users with separate route collections", async () => {
			// Create two users
			const users: User[] = [];
			const tokens: string[] = [];

			for (let i = 1; i <= 2; i++) {
				const { user, accessToken } = await createTestUserWithAuth(app, {
					email: `user${i}@example.com`,
					name: `User ${i}`,
					googleId: `google-user-${i}`,
					avatar: `https://example.com/user${i}.jpg`,
				});
				users.push(user);
				tokens.push(accessToken);
			}

			// Each user creates routes
			const routeIds = [];

			for (let i = 0; i < 2; i++) {
				const routeResponse = await supertest(app.getHttpServer())
					.post("/api/v1/routes")
					.set("Authorization", `Bearer ${tokens[i]}`)
					.send({
						name: `User ${i + 1} Route`,
						waypoints: [
							{ lat: 52.52 + i * 0.01, lng: 13.405 + i * 0.01, type: "routed" },
							{ lat: 52.53 + i * 0.01, lng: 13.415 + i * 0.01, type: "routed" },
						],
						distance: 1000 * (i + 1),
						duration: 600 * (i + 1),
					})
					.expect(201);

				routeIds.push(routeResponse.body.id);
			}

			// Verify each user can only see their own routes
			for (let i = 0; i < 2; i++) {
				const routesResponse = await supertest(app.getHttpServer())
					.get("/api/v1/routes")
					.set("Authorization", `Bearer ${tokens[i]}`)
					.expect(200);

				expect(routesResponse.body).toHaveLength(1);
				expect(routesResponse.body[0].name).toBe(`User ${i + 1} Route`);
			}

			// Verify users cannot access each other's routes
			await supertest(app.getHttpServer())
				.get(`/api/v1/routes/${routeIds[0]}`)
				.set("Authorization", `Bearer ${tokens[1]}`)
				.expect(404);

			await supertest(app.getHttpServer())
				.get(`/api/v1/routes/${routeIds[1]}`)
				.set("Authorization", `Bearer ${tokens[0]}`)
				.expect(404);
		});
	});

	describe("Error Recovery Flow", () => {
		it("should handle various error scenarios gracefully", async () => {
			// Attempt to access protected endpoints without auth
			await supertest(app.getHttpServer()).get("/api/v1/routes").expect(401);

			await supertest(app.getHttpServer()).post("/api/v1/routes").send({ name: "Unauthorized Route" }).expect(401);

			// Create a user and get token
			const { accessToken } = await createTestUserWithAuth(app, {
				email: "error@example.com",
				name: "Error Test User",
				googleId: "google-error-test",
				avatar: "https://example.com/error.jpg",
			});

			// Try to create invalid routes
			const invalidRoutes = [
				{
					/* empty object */
				},
				{ name: "" }, // Empty name
				{ name: "No waypoints" }, // Missing waypoints
				{ name: "Invalid waypoints", waypoints: "not-an-array" },
				{ name: "Empty waypoints", waypoints: [] },
			];

			for (const invalidRoute of invalidRoutes) {
				await supertest(app.getHttpServer())
					.post("/api/v1/routes")
					.set("Authorization", `Bearer ${accessToken}`)
					.send(invalidRoute)
					.expect(400);
			}

			// Try to access non-existent resources
			await supertest(app.getHttpServer())
				.get("/api/v1/routes/999999")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(404);

			await supertest(app.getHttpServer())
				.patch("/api/v1/routes/999999")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ name: "Updated" })
				.expect(404);

			await supertest(app.getHttpServer())
				.delete("/api/v1/routes/999999")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(404);
		});
	});

	describe("Performance and Load Testing Scenarios", () => {
		it("should handle bulk route creation and retrieval", async () => {
			// Create user
			const { accessToken } = await createTestUserWithAuth(app, {
				email: "perf@example.com",
				name: "Performance Test User",
				googleId: "google-perf-test",
				avatar: "https://example.com/perf.jpg",
			});

			// Create 10 routes sequentially to avoid connection issues
			for (let i = 0; i < 10; i++) {
				const routeData = {
					name: `Route ${i + 1}`,
					description: `Performance test route ${i + 1}`,
					waypoints: Array.from({ length: 5 }, (_, j) => ({
						lat: 52.52 + j * 0.001,
						lng: 13.405 + j * 0.001,
						timestamp: new Date(Date.now() + j * 1000).toISOString(),
						type: "routed",
					})),
					distance: 1000 + i * 100,
					duration: 600 + i * 60,
				};

				const result = await supertest(app.getHttpServer())
					.post("/api/v1/routes")
					.set("Authorization", `Bearer ${accessToken}`)
					.send(routeData)
					.expect(201);

				expect(result.body.name).toBe(`Route ${i + 1}`);
			}

			// Retrieve all routes
			const startTime = Date.now();
			const routesResponse = await supertest(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			const responseTime = Date.now() - startTime;
			expect(routesResponse.body).toHaveLength(10);
			expect(responseTime).toBeLessThan(1000); // Should respond within 1 second

			// Verify pagination would be needed in real scenario
			// (This is where you'd implement and test pagination)
		});
	});
});
