import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { PersonalAccessToken } from "src/entities/personal-access-token.entity";
import { Route } from "src/entities/route.entity";
import { User } from "src/entities/user.entity";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, generateTestJWT, withRequestContext } from "../utils";

// Mints a PAT through the live API surface (which is what the
// Settings UI does) rather than seeding the DB directly, so each test
// exercises the same plaintext-once contract a real consumer sees.
async function mintPat(
	app: INestApplication,
	cookieJwt: string,
	body: { label: string; scope: "read" | "write"; expiresAt?: string },
): Promise<{ id: number; token: string }> {
	const res = await supertest(app.getHttpServer())
		.post("/api/v1/auth/tokens")
		.set("Authorization", `Bearer ${cookieJwt}`)
		.send(body)
		.expect(201);
	return { id: res.body.id, token: res.body.token };
}

describe("Personal Access Tokens Integration Tests", () => {
	let app: INestApplication;
	let orm: MikroORM;
	let user: User;
	let adminUser: User;
	let cookieJwt: string;
	let adminCookieJwt: string;

	beforeAll(async () => {
		app = await createTestApp();
		orm = app.get(MikroORM);
	});

	beforeEach(async () => {
		await clearDatabase(app);

		user = orm.em.create(User, {
			email: "pat-test@example.com",
			name: "PAT Test User",
			googleId: "google-pat-test",
			avatar: "https://example.com/pat.jpg",
		});
		adminUser = orm.em.create(User, {
			email: "pat-admin@example.com",
			name: "PAT Admin",
			googleId: "google-pat-admin",
			avatar: "https://example.com/admin.jpg",
			role: "admin",
		});
		await orm.em.persist([user, adminUser]).flush();

		cookieJwt = await generateTestJWT(user.id, user.email, app);
		adminCookieJwt = await generateTestJWT(adminUser.id, adminUser.email, app);
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	describe("POST /v1/auth/tokens (mint)", () => {
		it("mints a read PAT and returns the plaintext once", async () => {
			const res = await supertest(app.getHttpServer())
				.post("/api/v1/auth/tokens")
				.set("Authorization", `Bearer ${cookieJwt}`)
				.send({ label: "laptop", scope: "read" })
				.expect(201);

			expect(res.body.token).toMatch(/^routess_pat_[A-Za-z0-9_-]+$/);
			expect(res.body.scope).toBe("read");
			expect(res.body.label).toBe("laptop");

			// Plaintext is not stored. Looking the row up by id should not
			// expose the plaintext anywhere on the entity.
			await withRequestContext(app, async () => {
				const row = await orm.em.findOne(PersonalAccessToken, { id: res.body.id });
				expect(row).toBeTruthy();
				expect(row?.tokenHash).toBeDefined();
				expect(row?.tokenHash).not.toContain(res.body.token);
			});
		});

		it("rejects PAT minting when authenticated with a PAT (no self-replication)", async () => {
			const { token } = await mintPat(app, cookieJwt, { label: "first", scope: "write" });

			await supertest(app.getHttpServer())
				.post("/api/v1/auth/tokens")
				.set("Authorization", `Bearer ${token}`)
				.send({ label: "second", scope: "read" })
				.expect(401);
		});

		it("validates required fields", async () => {
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/tokens")
				.set("Authorization", `Bearer ${cookieJwt}`)
				.send({ label: "", scope: "read" })
				.expect(400);

			await supertest(app.getHttpServer())
				.post("/api/v1/auth/tokens")
				.set("Authorization", `Bearer ${cookieJwt}`)
				.send({ label: "ok", scope: "godmode" })
				.expect(400);
		});
	});

	describe("GET /v1/auth/tokens (list)", () => {
		it("returns the user's active tokens without plaintext", async () => {
			await mintPat(app, cookieJwt, { label: "a", scope: "read" });
			await mintPat(app, cookieJwt, { label: "b", scope: "write" });

			const res = await supertest(app.getHttpServer())
				.get("/api/v1/auth/tokens")
				.set("Authorization", `Bearer ${cookieJwt}`)
				.expect(200);

			expect(Array.isArray(res.body)).toBe(true);
			expect(res.body).toHaveLength(2);
			for (const row of res.body) {
				expect(row).not.toHaveProperty("token");
				expect(row).not.toHaveProperty("tokenHash");
			}
		});

		it("only lists tokens belonging to the calling user", async () => {
			await mintPat(app, cookieJwt, { label: "mine", scope: "read" });
			await mintPat(app, adminCookieJwt, { label: "theirs", scope: "read" });

			const res = await supertest(app.getHttpServer())
				.get("/api/v1/auth/tokens")
				.set("Authorization", `Bearer ${cookieJwt}`)
				.expect(200);

			expect(res.body).toHaveLength(1);
			expect(res.body[0].label).toBe("mine");
		});

		it("read PAT may list tokens", async () => {
			const { token } = await mintPat(app, cookieJwt, { label: "lister", scope: "read" });

			const res = await supertest(app.getHttpServer())
				.get("/api/v1/auth/tokens")
				.set("Authorization", `Bearer ${token}`)
				.expect(200);

			expect(res.body).toHaveLength(1);
			expect(res.body[0].label).toBe("lister");
			expect(res.body[0]).not.toHaveProperty("token");
		});
	});

	describe("DELETE /v1/auth/tokens/:id (revoke)", () => {
		it("revokes the token and stops accepting it", async () => {
			const { id, token } = await mintPat(app, cookieJwt, { label: "transient", scope: "read" });

			await supertest(app.getHttpServer()).get("/api/v1/routes").set("Authorization", `Bearer ${token}`).expect(200);

			await supertest(app.getHttpServer())
				.delete(`/api/v1/auth/tokens/${id}`)
				.set("Authorization", `Bearer ${cookieJwt}`)
				.expect(200);

			await supertest(app.getHttpServer()).get("/api/v1/routes").set("Authorization", `Bearer ${token}`).expect(401);
		});

		it("is idempotent on a token already revoked", async () => {
			const { id } = await mintPat(app, cookieJwt, { label: "transient", scope: "read" });

			await supertest(app.getHttpServer())
				.delete(`/api/v1/auth/tokens/${id}`)
				.set("Authorization", `Bearer ${cookieJwt}`)
				.expect(200);

			await supertest(app.getHttpServer())
				.delete(`/api/v1/auth/tokens/${id}`)
				.set("Authorization", `Bearer ${cookieJwt}`)
				.expect(200);
		});

		it("write PAT may revoke another token without confirmation", async () => {
			const { token: writeToken } = await mintPat(app, cookieJwt, { label: "manager", scope: "write" });
			const { id: victimId, token: victimToken } = await mintPat(app, cookieJwt, { label: "stale", scope: "read" });

			await supertest(app.getHttpServer())
				.delete(`/api/v1/auth/tokens/${victimId}`)
				.set("Authorization", `Bearer ${writeToken}`)
				.expect(200);

			await supertest(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", `Bearer ${victimToken}`)
				.expect(401);
		});

		it("read PAT may not revoke tokens", async () => {
			const { token: readToken } = await mintPat(app, cookieJwt, { label: "read-only", scope: "read" });
			const { id } = await mintPat(app, cookieJwt, { label: "other", scope: "read" });

			await supertest(app.getHttpServer())
				.delete(`/api/v1/auth/tokens/${id}`)
				.set("Authorization", `Bearer ${readToken}`)
				.expect(403);
		});

		it("PAT self-revocation requires X-Routess-Confirm", async () => {
			const { id, token } = await mintPat(app, cookieJwt, { label: "self", scope: "write" });

			const res = await supertest(app.getHttpServer())
				.delete(`/api/v1/auth/tokens/${id}`)
				.set("Authorization", `Bearer ${token}`)
				.expect(428);
			expect(res.body.code).toBe("PRECONDITION_REQUIRED");
			expect(res.body.details?.impact).toContain(`${id}`);

			await supertest(app.getHttpServer())
				.delete(`/api/v1/auth/tokens/${id}`)
				.set("Authorization", `Bearer ${token}`)
				.set("X-Routess-Confirm", "true")
				.expect(200);

			await supertest(app.getHttpServer()).get("/api/v1/routes").set("Authorization", `Bearer ${token}`).expect(401);
		});
	});

	describe("Scope enforcement", () => {
		it("read PAT may GET /routes but not PATCH or DELETE", async () => {
			const { token: readToken } = await mintPat(app, cookieJwt, { label: "read-only", scope: "read" });

			const route = orm.em.create(Route, {
				name: "scope-test",
				user: user.id,
				waypoints: [
					{ coord: [4.35, 50.85], type: "routed" as const },
					{ coord: [4.36, 50.86], type: "routed" as const },
				],
			});
			await orm.em.persist(route).flush();

			await supertest(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", `Bearer ${readToken}`)
				.expect(200);

			await supertest(app.getHttpServer())
				.patch(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${readToken}`)
				.send({ name: "renamed" })
				.expect(403);

			await supertest(app.getHttpServer())
				.delete(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${readToken}`)
				.set("X-Routess-Confirm", "true")
				.expect(403);
		});

		it("write PAT may PATCH metadata", async () => {
			const { token: writeToken } = await mintPat(app, cookieJwt, { label: "write", scope: "write" });

			const route = orm.em.create(Route, {
				name: "before",
				user: user.id,
				waypoints: [
					{ coord: [4.35, 50.85], type: "routed" as const },
					{ coord: [4.36, 50.86], type: "routed" as const },
				],
			});
			await orm.em.persist(route).flush();

			const res = await supertest(app.getHttpServer())
				.patch(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${writeToken}`)
				.send({ name: "after" })
				.expect(200);

			expect(res.body.name).toBe("after");
		});

		it("write PAT may POST /routes (#170)", async () => {
			const { token } = await mintPat(app, cookieJwt, { label: "write", scope: "write" });

			const res = await supertest(app.getHttpServer())
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${token}`)
				.send({
					name: "from agent",
					waypoints: [
						{ coord: [4.35, 50.85], type: "routed" },
						{ coord: [4.36, 50.86], type: "routed" },
					],
				})
				.expect(201);

			expect(res.body.name).toBe("from agent");
			expect(res.body.visibility).toBe("private");
		});

		it("read PAT may not POST /routes", async () => {
			const { token } = await mintPat(app, cookieJwt, { label: "read-only", scope: "read" });

			await supertest(app.getHttpServer())
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${token}`)
				.send({
					name: "from agent",
					waypoints: [
						{ coord: [4.35, 50.85], type: "routed" },
						{ coord: [4.36, 50.86], type: "routed" },
					],
				})
				.expect(403);
		});
	});

	describe("Optional-auth ref endpoints (PAT-as-Bearer)", () => {
		it("read PAT may fetch its owner's private route by id, and its GPX", async () => {
			const { token } = await mintPat(app, cookieJwt, { label: "read-only", scope: "read" });

			const route = orm.em.create(Route, {
				name: "private-detail",
				user: user.id,
				visibility: "private",
				waypoints: [
					{ coord: [4.35, 50.85], type: "routed" as const },
					{ coord: [4.36, 50.86], type: "routed" as const },
				],
			});
			await orm.em.persist(route).flush();

			// Anonymous and PAT-less callers cannot see the private route.
			await supertest(app.getHttpServer()).get(`/api/v1/routes/${route.id}`).expect(404);

			const res = await supertest(app.getHttpServer())
				.get(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			expect(res.body.name).toBe("private-detail");

			const gpx = await supertest(app.getHttpServer())
				.get(`/api/v1/routes/${route.id}/gpx`)
				.set("Authorization", `Bearer ${token}`)
				.expect(200);
			expect(gpx.headers["content-type"]).toContain("gpx");
		});

		it("PAT of another user cannot fetch the private route", async () => {
			const { token: strangerToken } = await mintPat(app, adminCookieJwt, { label: "stranger", scope: "write" });

			const route = orm.em.create(Route, {
				name: "still-private",
				user: user.id,
				visibility: "private",
				waypoints: [
					{ coord: [4.35, 50.85], type: "routed" as const },
					{ coord: [4.36, 50.86], type: "routed" as const },
				],
			});
			await orm.em.persist(route).flush();

			await supertest(app.getHttpServer())
				.get(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${strangerToken}`)
				.expect(404);
		});
	});

	describe("Confirmation header", () => {
		it("DELETE /routes/:id without confirm returns 412 with impact description", async () => {
			const { token } = await mintPat(app, cookieJwt, { label: "write", scope: "write" });

			const route = orm.em.create(Route, {
				name: "delete-me",
				user: user.id,
				waypoints: [
					{ coord: [4.35, 50.85], type: "routed" as const },
					{ coord: [4.36, 50.86], type: "routed" as const },
				],
			});
			await orm.em.persist(route).flush();

			const res = await supertest(app.getHttpServer())
				.delete(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${token}`)
				.expect(428);

			expect(res.body.code).toBe("PRECONDITION_REQUIRED");
			expect(res.body.details?.impact).toContain(`Delete route ${route.id}`);
		});

		it("DELETE /routes/:id with X-Routess-Confirm succeeds", async () => {
			const { token } = await mintPat(app, cookieJwt, { label: "write", scope: "write" });

			const route = orm.em.create(Route, {
				name: "delete-me",
				user: user.id,
				waypoints: [
					{ coord: [4.35, 50.85], type: "routed" as const },
					{ coord: [4.36, 50.86], type: "routed" as const },
				],
			});
			await orm.em.persist(route).flush();

			await supertest(app.getHttpServer())
				.delete(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${token}`)
				.set("X-Routess-Confirm", "true")
				.expect(200);
		});

		it("PATCH /routes/:id with visibility=public requires confirm", async () => {
			const { token } = await mintPat(app, cookieJwt, { label: "write", scope: "write" });

			const route = orm.em.create(Route, {
				name: "private-by-default",
				user: user.id,
				waypoints: [
					{ coord: [4.35, 50.85], type: "routed" as const },
					{ coord: [4.36, 50.86], type: "routed" as const },
				],
			});
			await orm.em.persist(route).flush();

			await supertest(app.getHttpServer())
				.patch(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${token}`)
				.send({ visibility: "public" })
				.expect(428);

			await supertest(app.getHttpServer())
				.patch(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${token}`)
				.set("X-Routess-Confirm", "true")
				.send({ visibility: "public" })
				.expect(200);
		});

		it("POST /routes with visibility=public requires confirm", async () => {
			const { token } = await mintPat(app, cookieJwt, { label: "write", scope: "write" });

			const body = {
				name: "public from birth",
				visibility: "public",
				waypoints: [
					{ coord: [4.35, 50.85], type: "routed" },
					{ coord: [4.36, 50.86], type: "routed" },
				],
			};

			const res = await supertest(app.getHttpServer())
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${token}`)
				.send(body)
				.expect(428);
			expect(res.body.code).toBe("PRECONDITION_REQUIRED");

			await supertest(app.getHttpServer())
				.post("/api/v1/routes")
				.set("Authorization", `Bearer ${token}`)
				.set("X-Routess-Confirm", "true")
				.send(body)
				.expect(201);
		});

		it("PATCH that does not change visibility to public is not gated", async () => {
			const { token } = await mintPat(app, cookieJwt, { label: "write", scope: "write" });

			const route = orm.em.create(Route, {
				name: "rename-me",
				user: user.id,
				waypoints: [
					{ coord: [4.35, 50.85], type: "routed" as const },
					{ coord: [4.36, 50.86], type: "routed" as const },
				],
			});
			await orm.em.persist(route).flush();

			await supertest(app.getHttpServer())
				.patch(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${token}`)
				.send({ name: "renamed" })
				.expect(200);
		});

		it("cookie sessions bypass the confirmation gate", async () => {
			const route = orm.em.create(Route, {
				name: "delete-via-cookie",
				user: user.id,
				waypoints: [
					{ coord: [4.35, 50.85], type: "routed" as const },
					{ coord: [4.36, 50.86], type: "routed" as const },
				],
			});
			await orm.em.persist(route).flush();

			await supertest(app.getHttpServer())
				.delete(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${cookieJwt}`)
				.expect(200);
		});
	});

	describe("Admin and account-deletion block", () => {
		it("admin PAT cannot reach /v1/admin/* even with admin role", async () => {
			const { token } = await mintPat(app, adminCookieJwt, { label: "admin pat", scope: "write" });

			await supertest(app.getHttpServer())
				.get("/api/v1/admin/stats/overview")
				.set("Authorization", `Bearer ${token}`)
				.expect(401);
		});

		it("PAT cannot delete the user account", async () => {
			const { token } = await mintPat(app, cookieJwt, { label: "self-destruct", scope: "write" });

			await supertest(app.getHttpServer())
				.delete("/api/v1/users/me")
				.set("Authorization", `Bearer ${token}`)
				.set("X-Routess-Confirm", "true")
				.expect(403);
		});
	});

	describe("Bogus tokens", () => {
		it("rejects a non-PAT bearer that does not parse as JWT", async () => {
			await supertest(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", "Bearer not-a-real-token")
				.expect(401);
		});

		it("rejects a well-formed PAT that does not exist", async () => {
			await supertest(app.getHttpServer())
				.get("/api/v1/routes")
				.set("Authorization", "Bearer routess_pat_fake_value_that_will_never_match_any_db_row")
				.expect(401);
		});
	});
});
