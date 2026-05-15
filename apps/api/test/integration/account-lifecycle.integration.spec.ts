import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Route } from "src/entities/route.entity";
import { Session } from "src/entities/session.entity";
import { User } from "src/entities/user.entity";
import { UserAuthMethod } from "src/entities/user-auth-method.entity";
import { UsersService } from "src/users/users.service";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth, withRequestContext } from "../utils";

async function expireDeletionFor(app: INestApplication, userId: number, daysAgo: number) {
	const orm = app.get(MikroORM);
	const cutoff = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
	await orm.em
		.getConnection()
		.execute(`update "user" set "deletion_requested_at" = ? where "id" = ?`, [cutoff, userId]);
}

describe("Account Lifecycle Integration Tests", () => {
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

	describe("DELETE /users/me", () => {
		it("sets deletion_status to pending_hard_delete and timestamps deletion_requested_at", async () => {
			const { user, accessToken } = await createTestUserWithAuth(app, { email: "alice@example.com" });
			await supertest(app.getHttpServer())
				.delete("/api/v1/users/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				const after = await orm.em.findOne(User, { id: user.id }, { filters: { softDelete: false } });
				expect(after?.deletionStatus).toBe("pending_hard_delete");
				expect(after?.deletionRequestedAt).toBeInstanceOf(Date);
				expect(after?.deletedAt).toBeInstanceOf(Date);
			});
		});

		it("soft-deletes the user's routes and invalidates active sessions", async () => {
			const { user, accessToken } = await createTestUserWithAuth(app, { email: "alice@example.com" });
			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				const route = orm.em.create(Route, {
					name: "Test route",
					user: user.id,
					waypoints: [
						{ coord: [0, 0], type: "routed" },
						{ coord: [1, 1], type: "routed" },
					],
					visibility: "private",
					tags: [],
				});
				await orm.em.persistAndFlush(route);
			});

			await supertest(app.getHttpServer())
				.delete("/api/v1/users/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				// With soft-delete filter on (default), the routes are hidden.
				expect(await orm.em.count(Route, { user: user.id })).toBe(0);
				// With the filter off, they're still there with deletedAt set.
				const all = await orm.em.find(Route, { user: user.id }, { filters: { softDelete: false } });
				expect(all).toHaveLength(1);
				expect(all[0]?.deletedAt).toBeInstanceOf(Date);
				// Sessions are revoked (soft-deleted).
				const activeSessions = await orm.em.count(Session, { user: user.id });
				expect(activeSessions).toBe(0);
			});
		});

		it("the same JWT no longer authenticates after delete", async () => {
			const { accessToken } = await createTestUserWithAuth(app, { email: "alice@example.com" });
			await supertest(app.getHttpServer())
				.delete("/api/v1/users/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);
			await supertest(app.getHttpServer())
				.get("/api/v1/users/me")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(401);
		});
	});

	describe("POST /users/me/cancel-deletion", () => {
		it("restores the user's routes and clears pending status", async () => {
			const { user, accessToken: initialToken } = await createTestUserWithAuth(app, { email: "alice@example.com" });
			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				const route = orm.em.create(Route, {
					name: "Test route",
					user: user.id,
					waypoints: [
						{ coord: [0, 0], type: "routed" },
						{ coord: [1, 1], type: "routed" },
					],
					visibility: "private",
					tags: [],
				});
				await orm.em.persistAndFlush(route);
			});
			await supertest(app.getHttpServer())
				.delete("/api/v1/users/me")
				.set("Authorization", `Bearer ${initialToken}`)
				.expect(200);

			// Re-issue a session manually — in real life this is via Google relogin
			// or email login (whichever the user used originally). The auth-service
			// flow that clears user.deletedAt during relogin is covered separately;
			// for this test we just need a valid token to call cancel-deletion.
			const newToken = await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				await orm.em.getConnection().execute(`update "user" set "deleted_at" = null where "id" = ?`, [user.id]);
				const { SessionService } = await import("src/auth/session.service");
				return app.get(SessionService).createSession(user.id, { userAgent: "test", ipAddress: "127.0.0.1" });
			});

			const cancelRes = await supertest(app.getHttpServer())
				.post("/api/v1/users/me/cancel-deletion")
				.set("Authorization", `Bearer ${newToken}`)
				.expect(200);
			expect(cancelRes.body.deletionStatus).toBe("active");
			expect(cancelRes.body.deletionRequestedAt).toBeNull();

			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				const after = await orm.em.findOne(User, { id: user.id });
				expect(after?.deletionStatus).toBe("active");
				expect(after?.deletionRequestedAt ?? null).toBeNull();
				expect(after?.deletedAt ?? null).toBeNull();
				expect(await orm.em.count(Route, { user: user.id })).toBe(1);
			});
		});

		it("is a no-op for a user not in pending state", async () => {
			const { accessToken } = await createTestUserWithAuth(app, { email: "alice@example.com" });
			const res = await supertest(app.getHttpServer())
				.post("/api/v1/users/me/cancel-deletion")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);
			expect(res.body.deletionStatus).toBe("active");
		});
	});

	describe("UsersService.hardDeleteExpiredAccounts", () => {
		it("permanently removes users past the 30-day grace window and leaves not-yet-expired ones alone", async () => {
			const orm = app.get(MikroORM);
			const usersService = app.get(UsersService);

			const { user: aliceExpired } = await createTestUserWithAuth(app, {
				email: "expired@example.com",
			});
			const { user: bobInWindow } = await createTestUserWithAuth(app, {
				email: "in-window@example.com",
			});
			const { user: charlieActive } = await createTestUserWithAuth(app, {
				email: "active@example.com",
			});

			// Attach a route + auth method to alice so we can prove the cascade.
			await withRequestContext(app, async () => {
				const route = orm.em.create(Route, {
					name: "Alice route",
					user: aliceExpired.id,
					waypoints: [
						{ coord: [0, 0], type: "routed" },
						{ coord: [1, 1], type: "routed" },
					],
					visibility: "private",
					tags: [],
				});
				const method = orm.em.create(UserAuthMethod, {
					user: aliceExpired.id,
					provider: "email",
					providerId: "expired@example.com",
					passwordHash: "doesntmatter",
				});
				await orm.em.persistAndFlush([route, method]);
			});

			// Alice and Bob both initiated deletion; only Alice is past the grace.
			await usersService.remove(aliceExpired.id);
			await usersService.remove(bobInWindow.id);
			await expireDeletionFor(app, aliceExpired.id, 31);
			await expireDeletionFor(app, bobInWindow.id, 7);

			const purged = await withRequestContext(app, async () => usersService.hardDeleteExpiredAccounts());
			expect(purged).toBe(1);

			await withRequestContext(app, async () => {
				const orm2 = app.get(MikroORM);
				// Alice is gone everywhere.
				expect(await orm2.em.count(User, { id: aliceExpired.id }, { filters: { softDelete: false } })).toBe(0);
				expect(await orm2.em.count(Route, { user: aliceExpired.id }, { filters: { softDelete: false } })).toBe(0);
				expect(await orm2.em.count(UserAuthMethod, { user: aliceExpired.id }, { filters: { softDelete: false } })).toBe(
					0,
				);
				// Bob is still around, still pending.
				const bob = await orm2.em.findOne(User, { id: bobInWindow.id }, { filters: { softDelete: false } });
				expect(bob?.deletionStatus).toBe("pending_hard_delete");
				// Charlie was never affected.
				const charlie = await orm2.em.findOne(User, { id: charlieActive.id });
				expect(charlie?.deletionStatus).toBe("active");
			});
		});

		it("returns 0 when no accounts are eligible", async () => {
			const usersService = app.get(UsersService);
			const purged = await withRequestContext(app, async () => usersService.hardDeleteExpiredAccounts());
			expect(purged).toBe(0);
		});
	});
});
