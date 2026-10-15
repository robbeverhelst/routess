import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Route } from "src/entities/route.entity";
import { User } from "src/entities/user.entity";
import { clearDatabase, closeTestApp, createTestApp, generateTestJWT } from "../utils";
import request from "../utils/http";

describe("Routes Integration Tests", () => {
	let app: INestApplication;
	let orm: MikroORM;
	let testUser: User;
	let otherUser: User;
	let authToken: string;
	let otherAuthToken: string;

	beforeAll(async () => {
		app = await createTestApp();
		orm = app.get(MikroORM);
	});

	beforeEach(async () => {
		await clearDatabase(app);

		// Create test users
		testUser = orm.em.create(User, {
			email: "test@example.com",
			name: "Test User",
			googleId: "google-test-123",
			avatar: "https://example.com/test.jpg",
		});

		otherUser = orm.em.create(User, {
			email: "other@example.com",
			name: "Other User",
			googleId: "google-other-123",
			avatar: "https://example.com/other.jpg",
		});

		await orm.em.persist([testUser, otherUser]).flush();

		// Generate auth tokens
		authToken = await generateTestJWT(testUser.id, testUser.email, app);
		otherAuthToken = await generateTestJWT(otherUser.id, otherUser.email, app);
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	describe("POST /routes", () => {
		it("should create a new route for authenticated user", async () => {
			const routeData = {
				name: "Test Route",
				description: "A test route description",
				waypoints: [
					{ coord: [13.405, 52.52], timestamp: new Date().toISOString(), type: "routed" },
					{ coord: [13.406, 52.521], timestamp: new Date().toISOString(), type: "routed" },
				],
				distance: 1500,
				// duration: 900,
				elevationGain: 50,
				startAddress: "Berlin, Germany",
				endAddress: "Berlin, Germany",
			};

			const response = await request(app.getHttpServer())
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${authToken}`)
				.send(routeData)
				.expect(201);

			expect(response.body).toHaveProperty("id");
			expect(response.body.name).toBe(routeData.name);
			expect(response.body.user.id).toBe(testUser.id);
			expect(response.body.waypoints).toHaveLength(2);

			// Verify in database
			const route = await orm.em.findOne(Route, { id: response.body.id });
			expect(route).toBeDefined();
			expect(route?.user.id).toBe(testUser.id);
		});

		it("should fail to create route without authentication", async () => {
			const routeData = {
				name: "Test Route",
				waypoints: [{ coord: [13.405, 52.52], type: "routed" }],
			};

			await request(app.getHttpServer()).post("/api/v1/routes").send(routeData).expect(401);
		});

		it("should validate required fields", async () => {
			const invalidRoute = {
				description: "Missing required name field",
			};

			await request(app.getHttpServer())
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${authToken}`)
				.send(invalidRoute)
				.expect(400);
		});

		it("should require type field for waypoints", async () => {
			const routeWithoutType = {
				name: "Test Route",
				waypoints: [{ coord: [13.405, 52.52] }], // Missing required 'type' field
			};

			await request(app.getHttpServer())
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${authToken}`)
				.send(routeWithoutType)
				.expect(400);
		});
	});

	// Claiming a device's LocalRoutes on sign-in replays POST /routes with
	// each LocalRoute's id as clientRef; a replay must never duplicate.
	describe("POST /routes with a clientRef", () => {
		const claimBody = (clientRef: string, name = "Morning loop") => ({
			name,
			clientRef,
			waypoints: [
				{ coord: [13.405, 52.52], type: "routed" },
				{ coord: [13.406, 52.521], type: "routed" },
			],
			distance: 1500,
		});
		const post = (token: string, body: object) =>
			request(app.getHttpServer()).post("/api/v1/routes").set("Authorization", `Bearer ${token}`).send(body);
		const countRoutes = (user: User) => orm.em.fork().count(Route, { user: user.id });

		it("creates the route once when the same claim is sent twice", async () => {
			const clientRef = crypto.randomUUID();
			const first = await post(authToken, claimBody(clientRef)).expect(201);
			const second = await post(authToken, claimBody(clientRef, "Renamed on the device")).expect(201);

			expect(second.body.id).toBe(first.body.id);
			expect(second.body.name).toBe("Morning loop");
			expect(await countRoutes(testUser)).toBe(1);
		});

		it("creates the route once when the same claim races itself", async () => {
			const clientRef = crypto.randomUUID();
			const responses = await Promise.all([
				post(authToken, claimBody(clientRef)),
				post(authToken, claimBody(clientRef)),
			]);

			expect(responses.map((r) => r.status)).toEqual([201, 201]);
			expect(new Set(responses.map((r) => r.body.id)).size).toBe(1);
			expect(await countRoutes(testUser)).toBe(1);
		});

		it("scopes clientRef to the user", async () => {
			const clientRef = crypto.randomUUID();
			const mine = await post(authToken, claimBody(clientRef)).expect(201);
			const theirs = await post(otherAuthToken, claimBody(clientRef)).expect(201);

			expect(theirs.body.id).not.toBe(mine.body.id);
			expect(theirs.body.user.id).toBe(otherUser.id);
		});

		it("creates distinct routes for distinct claims", async () => {
			await post(authToken, claimBody(crypto.randomUUID(), "One")).expect(201);
			await post(authToken, claimBody(crypto.randomUUID(), "Two")).expect(201);

			expect(await countRoutes(testUser)).toBe(2);
		});

		it("rejects a clientRef that is not a UUID", async () => {
			await post(authToken, claimBody("not-a-uuid")).expect(400);
		});
	});

	describe("GET /routes", () => {
		let userRoute1: Route;
		let userRoute2: Route;
		let otherUserRoute: Route;

		beforeEach(async () => {
			// Create test routes
			userRoute1 = orm.em.create(Route, {
				name: "User Route 1",
				user: testUser,
				waypoints: [{ coord: [13.405, 52.52], type: "routed" }],
				distance: 1000,
				// duration: 600,
			});

			userRoute2 = orm.em.create(Route, {
				name: "User Route 2",
				user: testUser,
				waypoints: [{ coord: [13.415, 52.53], type: "routed" }],
				distance: 2000,
				// duration: 1200,
			});

			otherUserRoute = orm.em.create(Route, {
				name: "Other User Route",
				user: otherUser,
				waypoints: [{ coord: [13.425, 52.54], type: "routed" }],
				distance: 3000,
				// duration: 1800,
			});

			await orm.em.persist([userRoute1, userRoute2, otherUserRoute]).flush();
		});

		it("should return only authenticated user's routes", async () => {
			const response = await request(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body).toHaveLength(2);
			expect(response.body[0].user.id).toBe(testUser.id);
			expect(response.body[1].user.id).toBe(testUser.id);
		});

		it("should not include soft-deleted routes", async () => {
			// Soft delete one route
			userRoute1.deletedAt = new Date();
			await orm.em.flush();

			const response = await request(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body).toHaveLength(1);
			expect(response.body[0].id).toBe(userRoute2.id);
		});

		it("should fail without authentication", async () => {
			await request(app.getHttpServer()).get("/api/v1/routes").expect(401);
		});

		it("should expose the total count and paginate with limit/offset", async () => {
			const firstPage = await request(app.getHttpServer())
				.get("/api/v1/routes?limit=1&offset=0")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(firstPage.headers["x-total-count"]).toBe("2");
			expect(firstPage.body).toHaveLength(1);

			const secondPage = await request(app.getHttpServer())
				.get("/api/v1/routes?limit=1&offset=1")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(secondPage.body).toHaveLength(1);
			expect(secondPage.body[0].id).not.toBe(firstPage.body[0].id);
		});

		it("should reject an out-of-range limit", async () => {
			await request(app.getHttpServer())
				.get("/api/v1/routes?limit=5000")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(400);
		});

		it("should default favourite to false and persist toggling it", async () => {
			const list = await request(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);
			expect(list.body.every((r: { favourite: boolean }) => r.favourite === false)).toBe(true);

			await request(app.getHttpServer())
				.patch(`/api/v1/routes/${userRoute1.id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.send({ favourite: true })
				.expect(200);

			const refreshed = await request(app.getHttpServer())
				.get(`/api/v1/routes/${userRoute1.id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);
			expect(refreshed.body.favourite).toBe(true);
		});
	});

	describe("GET /routes/:id", () => {
		let testRoute: Route;

		beforeEach(async () => {
			testRoute = orm.em.create(Route, {
				name: "Test Route",
				user: testUser,
				waypoints: [{ coord: [13.405, 52.52], type: "routed" }],
				distance: 1000,
				// duration: 600,
			});
			await orm.em.persist(testRoute).flush();
		});

		it("should return route by id for owner", async () => {
			const response = await request(app.getHttpServer())
				.get(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body.id).toBe(testRoute.id);
			expect(response.body.name).toBe("Test Route");
		});

		it("should return 404 for non-owner", async () => {
			await request(app.getHttpServer())
				.get(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${otherAuthToken}`)
				.expect(404);
		});

		it("should return 404 for non-existent route", async () => {
			await request(app.getHttpServer())
				.get("/api/v1/routes/999999")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(404);
		});

		it("should return 404 for soft-deleted route", async () => {
			testRoute.deletedAt = new Date();
			await orm.em.flush();

			await request(app.getHttpServer())
				.get(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(404);
		});
	});

	describe("PATCH /routes/:id", () => {
		let testRoute: Route;

		beforeEach(async () => {
			testRoute = orm.em.create(Route, {
				name: "Original Name",
				description: "Original Description",
				user: testUser,
				waypoints: [{ coord: [13.405, 52.52], type: "routed" }],
				distance: 1000,
				// duration: 600,
			});
			await orm.em.persist(testRoute).flush();
		});

		it("should update route for owner", async () => {
			const updateData = {
				name: "Updated Name",
				description: "Updated Description",
			};

			const response = await request(app.getHttpServer())
				.patch(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.send(updateData)
				.expect(200);

			expect(response.body.name).toBe("Updated Name");
			expect(response.body.description).toBe("Updated Description");

			// Verify in database
			await orm.em.refresh(testRoute);
			expect(testRoute.name).toBe("Updated Name");
		});

		it("should return 404 when non-owner tries to update", async () => {
			await request(app.getHttpServer())
				.patch(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${otherAuthToken}`)
				.send({ name: "Hacked Name" })
				.expect(404);

			// Verify name wasn't changed
			await orm.em.refresh(testRoute);
			expect(testRoute.name).toBe("Original Name");
		});

		it("should validate update data", async () => {
			const invalidUpdate = {
				waypoints: "not-an-array", // Should be array
			};

			await request(app.getHttpServer())
				.patch(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.send(invalidUpdate)
				.expect(400);
		});
	});

	describe("DELETE /routes/:id", () => {
		let testRoute: Route;

		beforeEach(async () => {
			testRoute = orm.em.create(Route, {
				name: "Route to Delete",
				user: testUser,
				waypoints: [{ coord: [13.405, 52.52], type: "routed" }],
				distance: 1000,
				// duration: 600,
			});
			await orm.em.persist(testRoute).flush();
		});

		it("should soft delete route for owner", async () => {
			await request(app.getHttpServer())
				.delete(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			const refreshed = await orm.em.fork().findOne(Route, { id: testRoute.id }, { filters: { softDelete: false } });
			expect(refreshed?.deletedAt).toBeDefined();

			const response = await request(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body).toHaveLength(0);
		});

		it("should return 404 when non-owner tries to delete", async () => {
			await request(app.getHttpServer())
				.delete(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${otherAuthToken}`)
				.expect(404);

			// Verify not deleted
			await orm.em.refresh(testRoute);
			expect(testRoute.deletedAt).toBeNull();
		});

		it("should return 404 for already deleted route", async () => {
			testRoute.deletedAt = new Date();
			await orm.em.flush();

			await request(app.getHttpServer())
				.delete(`/api/v1/routes/${testRoute.id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(404);
		});
	});
});
