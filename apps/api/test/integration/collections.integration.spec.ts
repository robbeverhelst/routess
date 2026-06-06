import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Collection } from "src/entities/collection.entity";
import { Route } from "src/entities/route.entity";
import { User } from "src/entities/user.entity";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, generateTestJWT } from "../utils";

describe("Collections Integration Tests", () => {
	let app: INestApplication;
	let orm: MikroORM;
	let testUser: User;
	let otherUser: User;
	let authToken: string;
	let otherAuthToken: string;
	let privateRoute: Route;
	let publicRoute: Route;
	let unlistedRoute: Route;
	let otherUsersRoute: Route;

	const makeRoute = (user: User, name: string, visibility: "private" | "unlisted" | "public") =>
		orm.em.create(Route, {
			name,
			visibility,
			tags: [],
			favourite: false,
			waypoints: [
				{ coord: [13.405, 52.52], type: "routed" },
				{ coord: [13.406, 52.521], type: "routed" },
			],
			user,
		});

	beforeAll(async () => {
		app = await createTestApp();
		orm = app.get(MikroORM);
	});

	beforeEach(async () => {
		await clearDatabase(app);

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
		privateRoute = makeRoute(testUser, "Private Route", "private");
		publicRoute = makeRoute(testUser, "Public Route", "public");
		unlistedRoute = makeRoute(testUser, "Unlisted Route", "unlisted");
		otherUsersRoute = makeRoute(otherUser, "Other's Route", "public");
		await orm.em.persist([testUser, otherUser, privateRoute, publicRoute, unlistedRoute, otherUsersRoute]).flush();

		authToken = await generateTestJWT(testUser.id, testUser.email, app);
		otherAuthToken = await generateTestJWT(otherUser.id, otherUser.email, app);
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	const createCollection = async (body: Record<string, unknown> = {}) => {
		const response = await supertest(app.getHttpServer())
			.post("/api/v1/collections")
			.set("Authorization", `Bearer ${authToken}`)
			.send({ name: "Alps 2026", ...body })
			.expect(201);
		return response.body as { id: number };
	};

	describe("POST /collections", () => {
		it("creates a private collection by default", async () => {
			const response = await supertest(app.getHttpServer())
				.post("/api/v1/collections")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ name: "Alps 2026", description: "Summer trip" })
				.expect(201);

			expect(response.body.name).toBe("Alps 2026");
			expect(response.body.visibility).toBe("private");
			expect(response.body.routeIds).toEqual([]);
			expect(response.body.routeCount).toBe(0);
		});

		it("rejects unauthenticated creation", async () => {
			await supertest(app.getHttpServer()).post("/api/v1/collections").send({ name: "Nope" }).expect(401);
		});

		it("rejects an empty name", async () => {
			await supertest(app.getHttpServer())
				.post("/api/v1/collections")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ name: "" })
				.expect(400);
		});
	});

	describe("GET /collections", () => {
		it("lists only the caller's collections", async () => {
			await createCollection({ name: "Mine" });
			await supertest(app.getHttpServer())
				.post("/api/v1/collections")
				.set("Authorization", `Bearer ${otherAuthToken}`)
				.send({ name: "Theirs" })
				.expect(201);

			const response = await supertest(app.getHttpServer())
				.get("/api/v1/collections")
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			expect(response.body).toHaveLength(1);
			expect(response.body[0].name).toBe("Mine");
		});
	});

	describe("PUT /collections/:id/routes", () => {
		it("sets ordered membership", async () => {
			const { id } = await createCollection();
			const response = await supertest(app.getHttpServer())
				.put(`/api/v1/collections/${id}/routes`)
				.set("Authorization", `Bearer ${authToken}`)
				.send({ routeIds: [unlistedRoute.id, privateRoute.id, publicRoute.id] })
				.expect(200);

			expect(response.body.routeIds).toEqual([unlistedRoute.id, privateRoute.id, publicRoute.id]);
			expect(response.body.routes.map((r: { name: string }) => r.name)).toEqual([
				"Unlisted Route",
				"Private Route",
				"Public Route",
			]);
		});

		it("reorders on subsequent calls", async () => {
			const { id } = await createCollection();
			await supertest(app.getHttpServer())
				.put(`/api/v1/collections/${id}/routes`)
				.set("Authorization", `Bearer ${authToken}`)
				.send({ routeIds: [privateRoute.id, publicRoute.id] })
				.expect(200);

			const response = await supertest(app.getHttpServer())
				.put(`/api/v1/collections/${id}/routes`)
				.set("Authorization", `Bearer ${authToken}`)
				.send({ routeIds: [publicRoute.id, privateRoute.id] })
				.expect(200);

			expect(response.body.routeIds).toEqual([publicRoute.id, privateRoute.id]);
		});

		it("rejects routes owned by someone else", async () => {
			const { id } = await createCollection();
			await supertest(app.getHttpServer())
				.put(`/api/v1/collections/${id}/routes`)
				.set("Authorization", `Bearer ${authToken}`)
				.send({ routeIds: [otherUsersRoute.id] })
				.expect(400);
		});

		it("rejects duplicate route IDs", async () => {
			const { id } = await createCollection();
			await supertest(app.getHttpServer())
				.put(`/api/v1/collections/${id}/routes`)
				.set("Authorization", `Bearer ${authToken}`)
				.send({ routeIds: [publicRoute.id, publicRoute.id] })
				.expect(400);
		});
	});

	describe("GET /collections/:id visibility", () => {
		it("returns 404 for private collections to non-owners and anonymous viewers", async () => {
			const { id } = await createCollection({ name: "Secret" });
			await supertest(app.getHttpServer()).get(`/api/v1/collections/${id}`).expect(404);
			await supertest(app.getHttpServer())
				.get(`/api/v1/collections/${id}`)
				.set("Authorization", `Bearer ${otherAuthToken}`)
				.expect(404);
		});

		it("serves unlisted collections via the share token, omitting private routes; numeric id 404s", async () => {
			const { id, shareToken } = await createCollection({ name: "Shared trip", visibility: "unlisted" });
			await supertest(app.getHttpServer())
				.put(`/api/v1/collections/${id}/routes`)
				.set("Authorization", `Bearer ${authToken}`)
				.send({ routeIds: [privateRoute.id, publicRoute.id, unlistedRoute.id] })
				.expect(200);

			// Sequential ids must not expose unlisted collections to anonymous viewers.
			await supertest(app.getHttpServer()).get(`/api/v1/collections/${id}`).expect(404);

			const response = await supertest(app.getHttpServer()).get(`/api/v1/collections/${shareToken}`).expect(200);
			expect(response.body.routeIds).toEqual([publicRoute.id, unlistedRoute.id]);
			expect(response.body.routeCount).toBe(2);
			expect(response.body.routes.map((r: { name: string }) => r.name)).toEqual(["Public Route", "Unlisted Route"]);
		});

		it("shows owners their private routes inside the collection", async () => {
			const { id } = await createCollection({ visibility: "public" });
			await supertest(app.getHttpServer())
				.put(`/api/v1/collections/${id}/routes`)
				.set("Authorization", `Bearer ${authToken}`)
				.send({ routeIds: [privateRoute.id, publicRoute.id] })
				.expect(200);

			const response = await supertest(app.getHttpServer())
				.get(`/api/v1/collections/${id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);
			expect(response.body.routeIds).toEqual([privateRoute.id, publicRoute.id]);
		});
	});

	describe("PATCH /collections/:id", () => {
		it("renames and changes visibility", async () => {
			const { id } = await createCollection();
			const response = await supertest(app.getHttpServer())
				.patch(`/api/v1/collections/${id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.send({ name: "Renamed", visibility: "unlisted" })
				.expect(200);

			expect(response.body.name).toBe("Renamed");
			expect(response.body.visibility).toBe("unlisted");
		});

		it("404s for non-owners", async () => {
			const { id } = await createCollection();
			await supertest(app.getHttpServer())
				.patch(`/api/v1/collections/${id}`)
				.set("Authorization", `Bearer ${otherAuthToken}`)
				.send({ name: "Hijack" })
				.expect(404);
		});
	});

	describe("DELETE /collections/:id", () => {
		it("soft-deletes the collection without touching its routes", async () => {
			const { id } = await createCollection();
			await supertest(app.getHttpServer())
				.put(`/api/v1/collections/${id}/routes`)
				.set("Authorization", `Bearer ${authToken}`)
				.send({ routeIds: [publicRoute.id] })
				.expect(200);

			await supertest(app.getHttpServer())
				.delete(`/api/v1/collections/${id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(200);

			await supertest(app.getHttpServer())
				.get(`/api/v1/collections/${id}`)
				.set("Authorization", `Bearer ${authToken}`)
				.expect(404);

			orm.em.clear();
			const collection = await orm.em.findOne(Collection, { id }, { filters: { softDelete: false } });
			expect(collection?.deletedAt).toBeDefined();
			const route = await orm.em.findOne(Route, { id: publicRoute.id });
			expect(route).not.toBeNull();
		});
	});
});
