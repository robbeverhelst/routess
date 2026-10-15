import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { routeBoundingBox } from "@routess/core";
import { EmailService, type WeeklyDigestArgs } from "src/email/email.service";
import { Route } from "src/entities/route.entity";
import { User } from "src/entities/user.entity";
import { createUnsubscribeToken } from "src/weekly-digest/unsubscribe-token";
import { WeeklyDigestService } from "src/weekly-digest/weekly-digest.service";
import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth, withRequestContext } from "../utils";
import request from "../utils/http";

const GHENT: [number, number][] = [
	[3.72, 51.05],
	[3.74, 51.06],
];
const MADRID: [number, number][] = [
	[-3.7, 40.41],
	[-3.68, 40.42],
];

describe("WeeklyDigest", () => {
	let app: INestApplication;
	let orm: MikroORM;
	let sent: { to: string; args: WeeklyDigestArgs }[];

	beforeAll(async () => {
		app = await createTestApp();
		orm = app.get(MikroORM);
		jest.spyOn(app.get(EmailService), "sendWeeklyDigestEmail").mockImplementation(async (to, args) => {
			sent.push({ to, args });
		});
	});

	beforeEach(async () => {
		await clearDatabase(app);
		sent = [];
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	async function seedRoute(
		userId: number,
		name: string,
		geometry: [number, number][],
		extra: Partial<Route> = {},
	): Promise<void> {
		await withRequestContext(app, async () => {
			const box = routeBoundingBox(geometry);
			const route = orm.em.create(Route, {
				name,
				user: userId,
				waypoints: geometry.map((coord) => ({ coord, type: "routed" as const })),
				geometry,
				tags: [],
				activity: "cycle",
				distance: 42_000,
				bboxMinLat: box?.minLat,
				bboxMaxLat: box?.maxLat,
				bboxMinLng: box?.minLng,
				bboxMaxLng: box?.maxLng,
				...extra,
			});
			await orm.em.persist(route).flush();
		});
	}

	async function setUser(userId: number, patch: Partial<User>): Promise<void> {
		await withRequestContext(app, async () => {
			await orm.em.nativeUpdate(User, { id: userId }, patch);
		});
	}

	async function seedArea() {
		const author = await createTestUserWithAuth(app, { email: "author@example.com", googleId: "g-author" });
		for (const name of ["Leie loop", "Scheldt ride", "Kastelen", "Rabot ride"]) {
			await seedRoute(author.user.id, name, GHENT, { visibility: "public", publishedAt: new Date() });
		}
		await seedRoute(author.user.id, "Madrid ride", MADRID, { visibility: "public", publishedAt: new Date() });
	}

	const run = () => withRequestContext(app, () => app.get(WeeklyDigestService).run());

	it("mails only opted-in users, with three nearby routes that are not their own", async () => {
		await seedArea();
		const optedIn = await createTestUserWithAuth(app, { email: "in@example.com", googleId: "g-in" });
		const notOptedIn = await createTestUserWithAuth(app, { email: "out@example.com", googleId: "g-out" });
		await seedRoute(optedIn.user.id, "My own Ghent loop", GHENT, { visibility: "public", publishedAt: new Date() });
		await seedRoute(notOptedIn.user.id, "Their Ghent loop", GHENT);
		await setUser(optedIn.user.id, { weeklyDigestOptInAt: new Date() });

		const result = await run();

		expect(sent.map((s) => s.to)).toEqual(["in@example.com"]);
		expect(result).toMatchObject({ considered: 1, sent: 1 });
		const names = sent[0].args.routes.map((r) => r.name);
		expect(names).toHaveLength(3);
		expect(names).not.toContain("My own Ghent loop");
		expect(names).not.toContain("Madrid ride");
		expect(sent[0].args.unsubscribeUrl).toContain("/api/v1/email/unsubscribe?token=");
	});

	it("does not mail the same user twice in a week, and picks new routes the week after", async () => {
		await seedArea();
		const { user } = await createTestUserWithAuth(app, { email: "in@example.com", googleId: "g-in" });
		await seedRoute(user.id, "Mine", GHENT);
		await setUser(user.id, { weeklyDigestOptInAt: new Date() });

		await run();
		await run();
		expect(sent).toHaveLength(1);

		await setUser(user.id, { weeklyDigestLastSentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) });
		await run();
		expect(sent).toHaveLength(2);
		const first = sent[0].args.routes.map((r) => r.name);
		expect(sent[1].args.routes.map((r) => r.name).filter((n) => first.includes(n))).toEqual([]);
	});

	it("skips opted-in users without a planned area, unverified or pending deletion", async () => {
		await seedArea();
		const noRoutes = await createTestUserWithAuth(app, { email: "a@example.com", googleId: "g-a" });
		const unverified = await createTestUserWithAuth(app, {
			email: "b@example.com",
			googleId: "g-b",
			isEmailVerified: false,
		});
		const deleting = await createTestUserWithAuth(app, { email: "c@example.com", googleId: "g-c" });
		await seedRoute(unverified.user.id, "Mine", GHENT);
		await seedRoute(deleting.user.id, "Mine", GHENT);
		for (const u of [noRoutes, unverified, deleting]) {
			await setUser(u.user.id, { weeklyDigestOptInAt: new Date() });
		}
		await setUser(deleting.user.id, { deletionStatus: "pending_hard_delete" });

		const result = await run();
		expect(sent).toEqual([]);
		expect(result).toMatchObject({ considered: 1, skippedNoArea: 1 });
	});

	it("records and withdraws consent through PATCH /users/me", async () => {
		const { user, accessToken } = await createTestUserWithAuth(app);
		const auth = { Authorization: `Bearer ${accessToken}` };

		const before = await request(app.getHttpServer()).get("/api/v1/users/me").set(auth).expect(200);
		expect(before.body.weeklyDigest).toBe(false);

		const on = await request(app.getHttpServer())
			.patch("/api/v1/users/me")
			.set(auth)
			.send({ weeklyDigest: true })
			.expect(200);
		expect(on.body.weeklyDigest).toBe(true);
		const stored = await withRequestContext(app, () => orm.em.fork().findOneOrFail(User, { id: user.id }));
		expect(stored.weeklyDigestOptInAt).toBeInstanceOf(Date);

		const off = await request(app.getHttpServer())
			.patch("/api/v1/users/me")
			.set(auth)
			.send({ weeklyDigest: false })
			.expect(200);
		expect(off.body.weeklyDigest).toBe(false);
	});

	it("unsubscribes with one click via the signed link, and rejects a forged one", async () => {
		const { user } = await createTestUserWithAuth(app);
		await setUser(user.id, {
			weeklyDigestOptInAt: new Date(),
			weeklyDigestLastSentAt: new Date(),
			weeklyDigestSentSlugIds: ["a-1"],
		});
		const token = createUnsubscribeToken("test-secret-key", user.id);
		const forged = createUnsubscribeToken("wrong-secret", user.id);

		const page = await request(app.getHttpServer()).get(`/api/v1/email/unsubscribe?token=${token}`).expect(200);
		expect(page.text).toContain('method="post"');
		// GET alone (a mail scanner prefetching the link) must not unsubscribe.
		let stored = await withRequestContext(app, () => orm.em.fork().findOneOrFail(User, { id: user.id }));
		expect(stored.weeklyDigestOptInAt).toBeInstanceOf(Date);

		await request(app.getHttpServer()).post(`/api/v1/email/unsubscribe?token=${forged}`).expect(400);
		await request(app.getHttpServer())
			.post(`/api/v1/email/unsubscribe?token=${token}`)
			.set("Content-Type", "application/x-www-form-urlencoded")
			.send("List-Unsubscribe=One-Click")
			.expect(200);
		stored = await withRequestContext(app, () => orm.em.fork().findOneOrFail(User, { id: user.id }));
		expect(stored.weeklyDigestOptInAt).toBeNull();
		expect(stored.weeklyDigestLastSentAt).toBeNull();
		expect(stored.weeklyDigestSentSlugIds).toBeNull();
	});
});
