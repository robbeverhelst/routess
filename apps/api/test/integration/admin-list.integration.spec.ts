import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Route } from "src/entities/route.entity";
import { User } from "src/entities/user.entity";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, generateTestJWT } from "../utils";

describe("Admin List Sorting & Filtering", () => {
	let app: INestApplication;
	let orm: MikroORM;
	let adminToken: string;

	const get = (path: string) =>
		supertest(app.getHttpServer()).get(`/api/v1${path}`).set("Authorization", `Bearer ${adminToken}`);

	beforeAll(async () => {
		app = await createTestApp();
		orm = app.get(MikroORM);
	});

	beforeEach(async () => {
		await clearDatabase(app);
		orm.em.clear();

		// Explicit createdAt: rows written in one flush otherwise share a
		// timestamp, and "newest first" would depend on insert order.
		const admin = orm.em.create(User, {
			email: "zoe@example.com",
			name: "Zoe Admin",
			googleId: "google-admin",
			isEmailVerified: true,
			role: "admin",
			createdAt: new Date("2026-01-01T00:00:00Z"),
		});
		const alice = orm.em.create(User, {
			email: "alice@example.com",
			name: "Alice Member",
			googleId: "google-alice",
			isEmailVerified: true,
			createdAt: new Date("2026-02-01T00:00:00Z"),
		});
		const bob = orm.em.create(User, {
			email: "bob@example.com",
			name: "Bob Member",
			googleId: "google-bob",
			isEmailVerified: false,
			createdAt: new Date("2026-03-01T00:00:00Z"),
		});
		await orm.em.persist([admin, alice, bob]).flush();

		orm.em.create(Route, {
			name: "Alpine climb",
			user: alice,
			activity: "cycle",
			visibility: "public",
			waypoints: [{ coord: [13.405, 52.52], type: "routed" }],
			distance: 42000,
			createdAt: new Date("2026-01-01T00:00:00Z"),
		});
		orm.em.create(Route, {
			name: "Beach jog",
			user: bob,
			activity: "run",
			waypoints: [{ coord: [13.415, 52.53], type: "routed" }],
			distance: 5000,
			createdAt: new Date("2026-02-01T00:00:00Z"),
		});
		orm.em.create(Route, {
			name: "City stroll",
			user: alice,
			activity: "walk",
			waypoints: [{ coord: [13.425, 52.54], type: "routed" }],
			createdAt: new Date("2026-03-01T00:00:00Z"),
		});
		await orm.em.flush();

		adminToken = await generateTestJWT(admin.id, admin.email, app);
		orm.em.clear();
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	describe("GET /admin/users", () => {
		it("defaults to newest first", async () => {
			const res = await get("/admin/users").expect(200);
			expect(res.body.items.map((u: { email: string }) => u.email)).toEqual([
				"bob@example.com",
				"alice@example.com",
				"zoe@example.com",
			]);
		});

		it("sorts by email ascending", async () => {
			const res = await get("/admin/users?sort=email&dir=asc").expect(200);
			expect(res.body.items.map((u: { email: string }) => u.email)).toEqual([
				"alice@example.com",
				"bob@example.com",
				"zoe@example.com",
			]);
		});

		it("sorts by routeCount, a computed column", async () => {
			const res = await get("/admin/users?sort=routeCount&dir=desc").expect(200);
			expect(res.body.items.map((u: { routeCount: number }) => u.routeCount)).toEqual([2, 1, 0]);
		});

		it("puts users who were never active last, in both directions", async () => {
			// Only the admin has a session, so only it has a lastActiveAt. It must
			// lead in both directions; the two nulls sink regardless of dir.
			for (const dir of ["asc", "desc"]) {
				const res = await get(`/admin/users?sort=lastActiveAt&dir=${dir}`).expect(200);
				const items = res.body.items as Array<{ email: string; lastActiveAt: string | null }>;
				expect(items[0].email).toBe("zoe@example.com");
				expect(items[0].lastActiveAt).not.toBeNull();
				expect(items.slice(1).map((u) => u.lastActiveAt)).toEqual([null, null]);
			}
		});

		it("falls back to the default sort for an unknown column", async () => {
			const res = await get("/admin/users?sort=password&dir=asc").expect(200);
			expect(res.body.items.map((u: { email: string }) => u.email)).toEqual([
				"bob@example.com",
				"alice@example.com",
				"zoe@example.com",
			]);
		});

		it("filters by role", async () => {
			const res = await get("/admin/users?role=admin").expect(200);
			expect(res.body.total).toBe(1);
			expect(res.body.items[0].email).toBe("zoe@example.com");
		});

		it("filters by verified state", async () => {
			const unverified = await get("/admin/users?verified=false").expect(200);
			expect(unverified.body.items.map((u: { email: string }) => u.email)).toEqual(["bob@example.com"]);

			const verified = await get("/admin/users?verified=true").expect(200);
			expect(verified.body.total).toBe(2);
		});

		it("combines search with a filter", async () => {
			const res = await get("/admin/users?search=example.com&role=user&sort=name&dir=asc").expect(200);
			expect(res.body.items.map((u: { name: string }) => u.name)).toEqual(["Alice Member", "Bob Member"]);
		});
	});

	describe("GET /admin/routes", () => {
		it("sorts by name ascending", async () => {
			const res = await get("/admin/routes?sort=name&dir=asc").expect(200);
			expect(res.body.items.map((r: { name: string }) => r.name)).toEqual(["Alpine climb", "Beach jog", "City stroll"]);
		});

		it("sorts by distance and keeps routes without one last", async () => {
			const res = await get("/admin/routes?sort=distance&dir=desc").expect(200);
			expect(res.body.items.map((r: { distance: number | null }) => r.distance)).toEqual([42000, 5000, null]);
		});

		it("sorts by owner email", async () => {
			const res = await get("/admin/routes?sort=owner&dir=asc").expect(200);
			const owners = res.body.items.map((r: { owner: { email: string } }) => r.owner.email);
			expect(owners).toEqual(["alice@example.com", "alice@example.com", "bob@example.com"]);
		});

		it("filters by a single activity", async () => {
			const res = await get("/admin/routes?activity=run").expect(200);
			expect(res.body.total).toBe(1);
			expect(res.body.items[0].name).toBe("Beach jog");
		});

		it("filters by several activities", async () => {
			const res = await get("/admin/routes?activity=cycle,walk&sort=name&dir=asc").expect(200);
			expect(res.body.items.map((r: { name: string }) => r.name)).toEqual(["Alpine climb", "City stroll"]);
		});

		it("ignores unknown activity values", async () => {
			const res = await get("/admin/routes?activity=skydive").expect(200);
			expect(res.body.total).toBe(3);
		});

		it("combines an activity filter with a visibility filter", async () => {
			const res = await get("/admin/routes?activity=cycle&visibility=public").expect(200);
			expect(res.body.items.map((r: { name: string }) => r.name)).toEqual(["Alpine climb"]);
		});
	});
});
