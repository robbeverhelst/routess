import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Route } from "src/entities/route.entity";
import { RouteShare } from "src/entities/route-share.entity";
import { User } from "src/entities/user.entity";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, generateTestJWT } from "../utils";

describe("Social Integration Tests", () => {
	let app: INestApplication;
	let orm: MikroORM;
	let alice: User;
	let bob: User;
	let carol: User;
	let aliceToken: string;
	let bobToken: string;

	const makeRoute = (user: User, name: string, visibility: "private" | "unlisted" | "public", publishedAt?: Date) =>
		orm.em.create(Route, {
			name,
			visibility,
			tags: [],
			favourite: false,
			distance: 10000,
			elevationGain: 100,
			waypoints: [
				{ coord: [13.405, 52.52], type: "routed" },
				{ coord: [13.406, 52.521], type: "routed" },
			],
			publishedAt: visibility === "public" ? (publishedAt ?? new Date()) : undefined,
			user,
		});

	beforeAll(async () => {
		app = await createTestApp();
		orm = app.get(MikroORM);
	});

	beforeEach(async () => {
		await clearDatabase(app);
		alice = orm.em.create(User, { email: "alice@example.com", name: "Alice Anders", handle: "alice" });
		bob = orm.em.create(User, { email: "bob@example.com", name: "Bob Brouwer", handle: "bob" });
		carol = orm.em.create(User, { email: "carol@example.com", name: "Carol Claes", handle: "carol" });
		await orm.em.persistAndFlush([alice, bob, carol]);
		aliceToken = await generateTestJWT(alice.id, alice.email, app);
		bobToken = await generateTestJWT(bob.id, bob.email, app);
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	const api = () => supertest(app.getHttpServer());

	describe("handle generation", () => {
		it("assigns a random fallback handle when none is provided", async () => {
			const user = orm.em.create(User, { email: "nohandle@example.com", name: "No Handle" });
			await orm.em.persistAndFlush(user);
			expect(user.handle).toMatch(/^user-[0-9a-f]{8}$/);
		});
	});

	describe("GET /profiles/:handle", () => {
		it("returns the public projection with stats over public routes only", async () => {
			await orm.em.persistAndFlush([
				makeRoute(bob, "Public 1", "public"),
				makeRoute(bob, "Public 2", "public"),
				makeRoute(bob, "Hidden", "private"),
				makeRoute(bob, "Unlisted", "unlisted"),
			]);

			const res = await api().get("/api/v1/profiles/bob").expect(200);
			expect(res.body.handle).toBe("bob");
			expect(res.body.name).toBe("Bob Brouwer");
			expect(res.body.stats.publicRoutes).toBe(2);
			expect(res.body.stats.totalDistance).toBe(20000);
			expect(res.body.isFollowing).toBeNull();
			expect(res.body.routes).toHaveLength(2);
			// No private fields leak.
			expect(res.body.email).toBeUndefined();
			expect(res.body.id).toBeUndefined();
		});

		it("404s on unknown handles", async () => {
			await api().get("/api/v1/profiles/ghost").expect(404);
		});

		it("reports isFollowing for authenticated viewers", async () => {
			await api().post("/api/v1/social/follows/bob").set("Authorization", `Bearer ${aliceToken}`).expect(204);
			const res = await api().get("/api/v1/profiles/bob").set("Authorization", `Bearer ${aliceToken}`).expect(200);
			expect(res.body.isFollowing).toBe(true);
			expect(res.body.stats.followers).toBe(1);
		});
	});

	describe("follow / unfollow", () => {
		it("is idempotent and rejects self-follows", async () => {
			await api().post("/api/v1/social/follows/bob").set("Authorization", `Bearer ${aliceToken}`).expect(204);
			await api().post("/api/v1/social/follows/bob").set("Authorization", `Bearer ${aliceToken}`).expect(204);
			await api().post("/api/v1/social/follows/alice").set("Authorization", `Bearer ${aliceToken}`).expect(400);

			const res = await api().get("/api/v1/social/follows").set("Authorization", `Bearer ${aliceToken}`).expect(200);
			expect(res.body.following).toHaveLength(1);
			expect(res.body.following[0].handle).toBe("bob");

			await api().delete("/api/v1/social/follows/bob").set("Authorization", `Bearer ${aliceToken}`).expect(204);
			await api().delete("/api/v1/social/follows/bob").set("Authorization", `Bearer ${aliceToken}`).expect(204);
		});

		it("requires authentication", async () => {
			await api().post("/api/v1/social/follows/bob").expect(401);
		});
	});

	describe("GET /social/feed", () => {
		it("returns public routes of followed profiles, newest published first", async () => {
			const older = makeRoute(bob, "Older", "public", new Date("2026-05-01T10:00:00Z"));
			const newer = makeRoute(bob, "Newer", "public", new Date("2026-06-01T10:00:00Z"));
			await orm.em.persistAndFlush([
				older,
				newer,
				makeRoute(bob, "Private", "private"),
				makeRoute(bob, "Unlisted", "unlisted"),
				makeRoute(carol, "Carols", "public"),
			]);

			const res = await api().get("/api/v1/social/feed").set("Authorization", `Bearer ${aliceToken}`).expect(200);
			expect(res.body).toHaveLength(0); // follows nobody yet

			await api().post("/api/v1/social/follows/bob").set("Authorization", `Bearer ${aliceToken}`).expect(204);
			const res2 = await api().get("/api/v1/social/feed").set("Authorization", `Bearer ${aliceToken}`).expect(200);
			expect(res2.body.map((i: { name: string }) => i.name)).toEqual(["Newer", "Older"]);
			expect(res2.body[0].author.handle).toBe("bob");
			expect(res2.headers["x-total-count"]).toBe("2");
		});

		it("drops routes flipped back to private, instantly", async () => {
			const route = makeRoute(bob, "Now you see me", "public");
			await orm.em.persistAndFlush([route]);
			await api().post("/api/v1/social/follows/bob").set("Authorization", `Bearer ${aliceToken}`).expect(204);

			let res = await api().get("/api/v1/social/feed").set("Authorization", `Bearer ${aliceToken}`).expect(200);
			expect(res.body).toHaveLength(1);

			await api()
				.patch(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${bobToken}`)
				.send({ visibility: "private" })
				.expect(200);

			res = await api().get("/api/v1/social/feed").set("Authorization", `Bearer ${aliceToken}`).expect(200);
			expect(res.body).toHaveLength(0);
		});

		it("does not bump publishedAt on re-publish", async () => {
			const route = makeRoute(bob, "Republished", "public", new Date("2026-01-01T10:00:00Z"));
			await orm.em.persistAndFlush([route]);

			await api()
				.patch(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${bobToken}`)
				.send({ visibility: "private" })
				.expect(200);
			await api()
				.patch(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${bobToken}`)
				.set("X-Routess-Confirm", "true")
				.send({ visibility: "public" })
				.expect(200);

			orm.em.clear();
			const reloaded = await orm.em.findOneOrFail(Route, { id: route.id });
			expect(reloaded.publishedAt?.toISOString()).toBe("2026-01-01T10:00:00.000Z");
		});

		it("stamps publishedAt on the first transition to public", async () => {
			const route = makeRoute(bob, "Fresh", "private");
			await orm.em.persistAndFlush([route]);
			expect(route.publishedAt).toBeUndefined();

			await api()
				.patch(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${bobToken}`)
				.set("X-Routess-Confirm", "true")
				.send({ visibility: "public" })
				.expect(200);

			orm.em.clear();
			const reloaded = await orm.em.findOneOrFail(Route, { id: route.id });
			expect(reloaded.publishedAt).toBeInstanceOf(Date);
		});
	});

	describe("route shares", () => {
		it("shares an unlisted route and surfaces it in the inbox", async () => {
			const route = makeRoute(bob, "Sunday Gravel", "unlisted");
			await orm.em.persistAndFlush([route]);

			const share = await api()
				.post("/api/v1/social/shares")
				.set("Authorization", `Bearer ${bobToken}`)
				.send({ routeId: route.id, recipientHandle: "alice", message: "For Sunday!" })
				.expect(201);
			expect(share.body.sender.handle).toBe("bob");
			expect(share.body.route.name).toBe("Sunday Gravel");
			expect(share.body.unavailable).toBe(false);
			// Unlisted routes are only reachable via the share token (#247), so
			// the server-computed slugId must use the token form, not the id.
			expect(share.body.route.slugId).toBe(`sunday-gravel-${route.shareToken}`);

			const unread = await api()
				.get("/api/v1/social/shares/unread-count")
				.set("Authorization", `Bearer ${aliceToken}`)
				.expect(200);
			expect(unread.body.unread).toBe(1);

			const inbox = await api()
				.get("/api/v1/social/shares/inbox")
				.set("Authorization", `Bearer ${aliceToken}`)
				.expect(200);
			expect(inbox.body).toHaveLength(1);
			expect(inbox.body[0].message).toBe("For Sunday!");

			await api()
				.post(`/api/v1/social/shares/${share.body.id}/read`)
				.set("Authorization", `Bearer ${aliceToken}`)
				.expect(204);
			const unread2 = await api()
				.get("/api/v1/social/shares/unread-count")
				.set("Authorization", `Bearer ${aliceToken}`)
				.expect(200);
			expect(unread2.body.unread).toBe(0);
		});

		it("rejects sharing your own private route with a coded 409", async () => {
			const route = makeRoute(bob, "Secret", "private");
			await orm.em.persistAndFlush([route]);
			const res = await api()
				.post("/api/v1/social/shares")
				.set("Authorization", `Bearer ${bobToken}`)
				.send({ routeId: route.id, recipientHandle: "alice" })
				.expect(409);
			expect(res.body.code).toBe("CONFLICT");
			expect(res.body.details.reason).toBe("route_private");
		});

		it("404s when sharing someone else's private route (no existence leak)", async () => {
			const route = makeRoute(bob, "Secret", "private");
			await orm.em.persistAndFlush([route]);
			await api()
				.post("/api/v1/social/shares")
				.set("Authorization", `Bearer ${aliceToken}`)
				.send({ routeId: route.id, recipientHandle: "carol" })
				.expect(404);
		});

		it("rejects sharing with yourself", async () => {
			const route = makeRoute(bob, "Loop", "public");
			await orm.em.persistAndFlush([route]);
			await api()
				.post("/api/v1/social/shares")
				.set("Authorization", `Bearer ${bobToken}`)
				.send({ routeId: route.id, recipientHandle: "bob" })
				.expect(400);
		});

		it("shows shares of routes flipped back to private as unavailable (live reference)", async () => {
			const route = makeRoute(bob, "Ephemeral", "public");
			await orm.em.persistAndFlush([route]);
			await api()
				.post("/api/v1/social/shares")
				.set("Authorization", `Bearer ${bobToken}`)
				.send({ routeId: route.id, recipientHandle: "alice" })
				.expect(201);

			await api()
				.patch(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${bobToken}`)
				.send({ visibility: "private" })
				.expect(200);

			const inbox = await api()
				.get("/api/v1/social/shares/inbox")
				.set("Authorization", `Bearer ${aliceToken}`)
				.expect(200);
			expect(inbox.body).toHaveLength(1);
			expect(inbox.body[0].unavailable).toBe(true);
			expect(inbox.body[0].route).toBeNull();
		});

		it("saves a copy with lineage, kept provenance, and private visibility", async () => {
			const route = makeRoute(bob, "Copy me", "public");
			route.provenance = "gpx-import";
			await orm.em.persistAndFlush([route]);
			const share = await api()
				.post("/api/v1/social/shares")
				.set("Authorization", `Bearer ${bobToken}`)
				.send({ routeId: route.id, recipientHandle: "alice" })
				.expect(201);

			const copy = await api()
				.post(`/api/v1/social/shares/${share.body.id}/copy`)
				.set("Authorization", `Bearer ${aliceToken}`)
				.expect(201);
			expect(copy.body.name).toBe("Copy me");
			expect(copy.body.visibility).toBe("private");
			expect(copy.body.provenance).toBe("gpx-import");
			expect(copy.body.user.id).toBe(alice.id);

			orm.em.clear();
			const saved = await orm.em.findOneOrFail(Route, { id: copy.body.id });
			expect(saved.copiedFromRouteId).toBe(route.id);
			expect(saved.copiedFromUserId).toBe(bob.id);
		});

		it("refuses to copy an unavailable share", async () => {
			const route = makeRoute(bob, "Gone", "public");
			await orm.em.persistAndFlush([route]);
			const share = await api()
				.post("/api/v1/social/shares")
				.set("Authorization", `Bearer ${bobToken}`)
				.send({ routeId: route.id, recipientHandle: "alice" })
				.expect(201);
			await api()
				.patch(`/api/v1/routes/${route.id}`)
				.set("Authorization", `Bearer ${bobToken}`)
				.send({ visibility: "private" })
				.expect(200);
			await api()
				.post(`/api/v1/social/shares/${share.body.id}/copy`)
				.set("Authorization", `Bearer ${aliceToken}`)
				.expect(409);
		});

		it("rate-limits share emails per sender-recipient pair", async () => {
			const route = makeRoute(bob, "Emailed", "public");
			const route2 = makeRoute(bob, "Emailed 2", "public");
			await orm.em.persistAndFlush([route, route2]);
			const first = await api()
				.post("/api/v1/social/shares")
				.set("Authorization", `Bearer ${bobToken}`)
				.send({ routeId: route.id, recipientHandle: "alice" })
				.expect(201);
			const second = await api()
				.post("/api/v1/social/shares")
				.set("Authorization", `Bearer ${bobToken}`)
				.send({ routeId: route2.id, recipientHandle: "alice" })
				.expect(201);

			orm.em.clear();
			const firstShare = await orm.em.findOneOrFail(RouteShare, { id: first.body.id });
			const secondShare = await orm.em.findOneOrFail(RouteShare, { id: second.body.id });
			expect(firstShare.emailedAt).toBeInstanceOf(Date);
			expect(secondShare.emailedAt).toBeFalsy();
		});
	});

	describe("GET /social/users/search", () => {
		it("prefix-matches handle and name, excluding yourself", async () => {
			const res = await api()
				.get("/api/v1/social/users/search?q=bo")
				.set("Authorization", `Bearer ${aliceToken}`)
				.expect(200);
			expect(res.body.map((u: { handle: string }) => u.handle)).toEqual(["bob"]);

			const self = await api()
				.get("/api/v1/social/users/search?q=alice")
				.set("Authorization", `Bearer ${aliceToken}`)
				.expect(200);
			expect(self.body).toHaveLength(0);

			const short = await api()
				.get("/api/v1/social/users/search?q=b")
				.set("Authorization", `Bearer ${aliceToken}`)
				.expect(200);
			expect(short.body).toHaveLength(0);
		});
	});

	describe("PATCH /users/me handle change", () => {
		it("changes the handle and frees the old one", async () => {
			await api()
				.patch("/api/v1/users/me")
				.set("Authorization", `Bearer ${aliceToken}`)
				.send({ handle: "alice-rides" })
				.expect(200);
			await api().get("/api/v1/profiles/alice-rides").expect(200);
			await api().get("/api/v1/profiles/alice").expect(404);
		});

		it("rejects invalid and reserved handles", async () => {
			await api()
				.patch("/api/v1/users/me")
				.set("Authorization", `Bearer ${aliceToken}`)
				.send({ handle: "Has Spaces" })
				.expect(400);
			await api()
				.patch("/api/v1/users/me")
				.set("Authorization", `Bearer ${aliceToken}`)
				.send({ handle: "admin" })
				.expect(400);
		});

		it("409s on a taken handle", async () => {
			await api()
				.patch("/api/v1/users/me")
				.set("Authorization", `Bearer ${aliceToken}`)
				.send({ handle: "bob" })
				.expect(409);
		});
	});
});
