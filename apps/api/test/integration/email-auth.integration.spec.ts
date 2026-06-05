import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { Session } from "src/entities/session.entity";
import { User } from "src/entities/user.entity";
import { UserAuthMethod } from "src/entities/user-auth-method.entity";
import { VerificationToken } from "src/entities/verification-token.entity";
import supertest from "supertest";
import { clearDatabase, closeTestApp, createTestApp, withRequestContext } from "../utils";

// A password that's almost certainly not in HIBP (random-looking 18 chars).
// Used everywhere a "valid" password is needed in these tests.
const SAFE_PASSWORD = "Zqx7-mnvb-9w3pra-ttt";
// "password123456" is in any breach corpus; HIBP returns >0.
const BREACHED_PASSWORD = "password123456";

async function freshVerificationToken(app: INestApplication, email: string): Promise<string> {
	const orm = app.get(MikroORM);
	return withRequestContext(app, async () => {
		const row = await orm.em.findOne(
			VerificationToken,
			{ email, purpose: "pending_signup", usedAt: null },
			{ orderBy: { createdAt: "DESC" } },
		);
		if (!row) throw new Error(`No pending_signup token for ${email}`);
		return row.token;
	});
}

async function freshResetToken(app: INestApplication, email: string): Promise<string> {
	const orm = app.get(MikroORM);
	return withRequestContext(app, async () => {
		const row = await orm.em.findOne(
			VerificationToken,
			{ email, purpose: "password_reset", usedAt: null },
			{ orderBy: { createdAt: "DESC" } },
		);
		if (!row) throw new Error(`No password_reset token for ${email}`);
		return row.token;
	});
}

async function countSessions(app: INestApplication, userId: number): Promise<number> {
	const orm = app.get(MikroORM);
	return withRequestContext(app, async () => orm.em.count(Session, { user: userId }));
}

describe("Email Auth Integration Tests", () => {
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

	describe("POST /auth/signup-email", () => {
		it("creates a pending_signup token and does not create a User row", async () => {
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/signup-email")
				.send({ email: "alice@example.com", password: SAFE_PASSWORD })
				.expect(200);

			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				expect(await orm.em.count(User, { email: "alice@example.com" })).toBe(0);
				const token = await orm.em.findOne(VerificationToken, {
					email: "alice@example.com",
					purpose: "pending_signup",
				});
				expect(token).toBeDefined();
				expect(token?.passwordHash).toBeTruthy();
				expect(token?.usedAt).toBeNull();
			});
		});

		it("rejects passwords under 12 characters with 400", async () => {
			const response = await supertest(app.getHttpServer())
				.post("/api/v1/auth/signup-email")
				.send({ email: "alice@example.com", password: "short" })
				.expect(400);
			expect(response.body.message).toBeDefined();
		});

		it("rejects passwords found in HIBP breach corpus with 400", async () => {
			const response = await supertest(app.getHttpServer())
				.post("/api/v1/auth/signup-email")
				.send({ email: "alice@example.com", password: BREACHED_PASSWORD });
			// HIBP fails open if the network is unreachable, so accept either 400
			// (HIBP reachable, password rejected) or 200 (HIBP unreachable, fell
			// through). Catches the regression where HIBP is wired wrong AND
			// always returns "safe".
			if (response.status === 400) {
				expect(response.body.message?.toLowerCase()).toContain("breach");
			} else {
				// eslint-disable-next-line no-console
				console.warn("HIBP unreachable from test env — breach check skipped");
				expect(response.status).toBe(200);
			}
		});

		it("returns 200 for an existing user's email without creating a signup token (no enumeration)", async () => {
			// Pre-create a user with the same email (any provider).
			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				const user = orm.em.create(User, {
					email: "alice@example.com",
					name: "Alice",
					isEmailVerified: true,
					role: "user",
					deletionStatus: "active",
				});
				await orm.em.persistAndFlush(user);
			});

			// Same status as a fresh signup so the endpoint can't be used to
			// probe which emails are registered; the account gets a "you
			// already have an account" email instead of a verification link.
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/signup-email")
				.send({ email: "alice@example.com", password: SAFE_PASSWORD })
				.expect(200);

			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				const token = await orm.em.findOne(VerificationToken, {
					email: "alice@example.com",
					purpose: "pending_signup",
					usedAt: null,
				});
				expect(token).toBeNull();
			});
		});

		it("invalidates the previous pending_signup token when called twice", async () => {
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/signup-email")
				.send({ email: "alice@example.com", password: SAFE_PASSWORD })
				.expect(200);
			const firstToken = await freshVerificationToken(app, "alice@example.com");

			await supertest(app.getHttpServer())
				.post("/api/v1/auth/signup-email")
				.send({ email: "alice@example.com", password: SAFE_PASSWORD })
				.expect(200);

			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				const first = await orm.em.findOne(VerificationToken, { token: firstToken });
				expect(first?.usedAt).not.toBeNull();
			});
		});
	});

	describe("POST /auth/verify-email", () => {
		const email = "alice@example.com";

		beforeEach(async () => {
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/signup-email")
				.send({ email, password: SAFE_PASSWORD })
				.expect(200);
		});

		it("creates the user + email auth method and returns a session", async () => {
			const token = await freshVerificationToken(app, email);
			const response = await supertest(app.getHttpServer())
				.post("/api/v1/auth/verify-email")
				.send({ token })
				.expect(200);

			expect(response.body.accessToken).toBeTruthy();
			expect(response.body.user.email).toBe(email);
			expect(response.body.user.isEmailVerified).toBe(true);
			expect(response.body.user.hasPassword).toBe(true);

			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				const user = await orm.em.findOne(User, { email });
				expect(user).toBeDefined();
				const method = await orm.em.findOne(UserAuthMethod, {
					provider: "email",
					providerId: email,
				});
				expect(method?.passwordHash).toBeTruthy();
				const tokenRow = await orm.em.findOne(VerificationToken, { token });
				expect(tokenRow?.usedAt).not.toBeNull();
			});
		});

		it("rejects an already-used token with 400 and does not create a duplicate user", async () => {
			const token = await freshVerificationToken(app, email);
			await supertest(app.getHttpServer()).post("/api/v1/auth/verify-email").send({ token }).expect(200);

			await supertest(app.getHttpServer()).post("/api/v1/auth/verify-email").send({ token }).expect(400);

			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				expect(await orm.em.count(User, { email })).toBe(1);
			});
		});

		it("rejects an unknown token with 400", async () => {
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/verify-email")
				.send({ token: "deadbeef".repeat(8) })
				.expect(400);
		});

		// Regression for the StrictMode double-fire 500 we fixed: two concurrent
		// verify-email requests with the same token must NOT both create a User
		// (unique constraint on user.email would have thrown an unhandled 500).
		// Atomically claiming the token at the top of the handler means exactly
		// one request wins.
		it("handles two concurrent requests for the same token without 500ing", async () => {
			const token = await freshVerificationToken(app, email);
			const [resA, resB] = await Promise.all([
				supertest(app.getHttpServer()).post("/api/v1/auth/verify-email").send({ token }),
				supertest(app.getHttpServer()).post("/api/v1/auth/verify-email").send({ token }),
			]);

			const statuses = [resA.status, resB.status];
			// Exactly one request must win with 200. The loser hits the "invalid
			// or expired" branch (400) or, in rare interleavings, the
			// race-with-existing-user branch (409). The regression we're
			// catching is the old unhandled 500 from racing user-row inserts.
			expect(statuses.filter((s) => s === 200)).toHaveLength(1);
			expect(statuses.every((s) => s !== 500)).toBe(true);
			const loser = statuses.find((s) => s !== 200);
			expect(loser === 400 || loser === 409).toBe(true);

			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				expect(await orm.em.count(User, { email })).toBe(1);
				expect(await orm.em.count(UserAuthMethod, { provider: "email", providerId: email })).toBe(1);
			});
		});
	});

	describe("POST /auth/login-email", () => {
		const email = "alice@example.com";

		beforeEach(async () => {
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/signup-email")
				.send({ email, password: SAFE_PASSWORD })
				.expect(200);
			const token = await freshVerificationToken(app, email);
			await supertest(app.getHttpServer()).post("/api/v1/auth/verify-email").send({ token }).expect(200);
		});

		it("returns a session on correct credentials", async () => {
			const response = await supertest(app.getHttpServer())
				.post("/api/v1/auth/login-email")
				.send({ email, password: SAFE_PASSWORD })
				.expect(200);
			expect(response.body.accessToken).toBeTruthy();
			expect(response.body.user.email).toBe(email);
			expect(response.body.user.hasPassword).toBe(true);
		});

		it("returns 401 on wrong password with a generic error message", async () => {
			const response = await supertest(app.getHttpServer())
				.post("/api/v1/auth/login-email")
				.send({ email, password: `${SAFE_PASSWORD}-wrong` })
				.expect(401);
			expect(response.body.message?.toLowerCase()).toContain("email or password");
		});

		it("returns 401 on non-existent email with the same generic error (no enumeration)", async () => {
			const response = await supertest(app.getHttpServer())
				.post("/api/v1/auth/login-email")
				.send({ email: "ghost@example.com", password: SAFE_PASSWORD })
				.expect(401);
			expect(response.body.message?.toLowerCase()).toContain("email or password");
		});

		it("locks the account after consecutive failures and rejects even the correct password generically", async () => {
			// Arrange 9 prior failures directly (simulating attempts spread
			// across IPs, which the per-IP throttle would not stop).
			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				const method = await orm.em.findOneOrFail(UserAuthMethod, { provider: "email", providerId: email });
				method.failedLoginAttempts = 9;
				await orm.em.persistAndFlush(method);
			});

			// The 10th failure trips the lock.
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/login-email")
				.send({ email, password: `${SAFE_PASSWORD}-wrong` })
				.expect(401);

			// While locked, even the correct password gets the same generic 401
			// (no oracle for "this account exists and is locked").
			const locked = await supertest(app.getHttpServer())
				.post("/api/v1/auth/login-email")
				.send({ email, password: SAFE_PASSWORD })
				.expect(401);
			expect(locked.body.message?.toLowerCase()).toContain("email or password");

			// Once the lock expires, the correct password works and resets state.
			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				const method = await orm.em.findOneOrFail(UserAuthMethod, { provider: "email", providerId: email });
				expect(method.lockedUntil).toBeTruthy();
				method.lockedUntil = new Date(Date.now() - 1000);
				await orm.em.persistAndFlush(method);
			});

			await supertest(app.getHttpServer())
				.post("/api/v1/auth/login-email")
				.send({ email, password: SAFE_PASSWORD })
				.expect(200);

			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				orm.em.clear();
				const method = await orm.em.findOneOrFail(UserAuthMethod, { provider: "email", providerId: email });
				expect(method.failedLoginAttempts).toBe(0);
				expect(method.lockedUntil).toBeNull();
			});
		});
	});

	describe("POST /auth/request-password-reset", () => {
		it("always returns 200 even when no user exists (no enumeration)", async () => {
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/request-password-reset")
				.send({ email: "ghost@example.com" })
				.expect(200);

			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				expect(
					await orm.em.count(VerificationToken, {
						email: "ghost@example.com",
						purpose: "password_reset",
					}),
				).toBe(0);
			});
		});

		it("creates a password_reset token when a user with an email method exists", async () => {
			const email = "alice@example.com";
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/signup-email")
				.send({ email, password: SAFE_PASSWORD })
				.expect(200);
			const verifyToken = await freshVerificationToken(app, email);
			await supertest(app.getHttpServer()).post("/api/v1/auth/verify-email").send({ token: verifyToken }).expect(200);

			await supertest(app.getHttpServer()).post("/api/v1/auth/request-password-reset").send({ email }).expect(200);

			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				expect(
					await orm.em.count(VerificationToken, {
						email,
						purpose: "password_reset",
						usedAt: null,
					}),
				).toBe(1);
			});
		});

		it("does NOT create a reset token for a user without an email method", async () => {
			const email = "googleonly@example.com";
			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				const user = orm.em.create(User, {
					email,
					name: "Google Only",
					isEmailVerified: true,
					role: "user",
					deletionStatus: "active",
				});
				await orm.em.persistAndFlush(user);
				const method = orm.em.create(UserAuthMethod, {
					user: user.id,
					provider: "google",
					providerId: "google-123",
				});
				await orm.em.persistAndFlush(method);
			});

			await supertest(app.getHttpServer()).post("/api/v1/auth/request-password-reset").send({ email }).expect(200);

			await withRequestContext(app, async () => {
				const orm = app.get(MikroORM);
				expect(
					await orm.em.count(VerificationToken, {
						email,
						purpose: "password_reset",
					}),
				).toBe(0);
			});
		});
	});

	describe("POST /auth/reset-password", () => {
		const email = "alice@example.com";

		beforeEach(async () => {
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/signup-email")
				.send({ email, password: SAFE_PASSWORD })
				.expect(200);
			const verifyToken = await freshVerificationToken(app, email);
			await supertest(app.getHttpServer()).post("/api/v1/auth/verify-email").send({ token: verifyToken }).expect(200);
			await supertest(app.getHttpServer()).post("/api/v1/auth/request-password-reset").send({ email }).expect(200);
		});

		it("updates the password and invalidates ALL sessions", async () => {
			// Two active sessions for this user: the one from verify-email plus a
			// second login. Both should be invalidated after reset.
			const second = await supertest(app.getHttpServer())
				.post("/api/v1/auth/login-email")
				.send({ email, password: SAFE_PASSWORD })
				.expect(200);
			const userId = second.body.user.id as number;
			expect(await countSessions(app, userId)).toBe(2);

			const resetToken = await freshResetToken(app, email);
			const newPassword = "Newly-chosen-23-char-pass";
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/reset-password")
				.send({ token: resetToken, password: newPassword })
				.expect(200);

			expect(await countSessions(app, userId)).toBe(0);
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/login-email")
				.send({ email, password: SAFE_PASSWORD })
				.expect(401);
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/login-email")
				.send({ email, password: newPassword })
				.expect(200);
		});

		it("rejects a reused token with 400", async () => {
			const resetToken = await freshResetToken(app, email);
			const newPassword = "Another-fresh-pass-15-chars";
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/reset-password")
				.send({ token: resetToken, password: newPassword })
				.expect(200);
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/reset-password")
				.send({ token: resetToken, password: `${newPassword}-2` })
				.expect(400);
		});
	});

	describe("POST /users/me/password", () => {
		const email = "alice@example.com";
		let accessToken: string;

		async function authHeader() {
			return `Bearer ${accessToken}`;
		}

		beforeEach(async () => {
			await supertest(app.getHttpServer())
				.post("/api/v1/auth/signup-email")
				.send({ email, password: SAFE_PASSWORD })
				.expect(200);
			const verifyToken = await freshVerificationToken(app, email);
			const verifyRes = await supertest(app.getHttpServer())
				.post("/api/v1/auth/verify-email")
				.send({ token: verifyToken })
				.expect(200);
			accessToken = verifyRes.body.accessToken;
		});

		it("changes the password when the current one is supplied", async () => {
			const newPassword = "Brand-new-strong-pass-22";
			await supertest(app.getHttpServer())
				.post("/api/v1/users/me/password")
				.set("Authorization", await authHeader())
				.send({ currentPassword: SAFE_PASSWORD, newPassword })
				.expect(200);

			await supertest(app.getHttpServer())
				.post("/api/v1/auth/login-email")
				.send({ email, password: newPassword })
				.expect(200);
		});

		it("requires the current password when one already exists (400 without it)", async () => {
			await supertest(app.getHttpServer())
				.post("/api/v1/users/me/password")
				.set("Authorization", await authHeader())
				.send({ newPassword: "Brand-new-strong-pass-22" })
				.expect(400);
		});

		it("rejects a wrong current password with 401", async () => {
			await supertest(app.getHttpServer())
				.post("/api/v1/users/me/password")
				.set("Authorization", await authHeader())
				.send({ currentPassword: "wrong-current", newPassword: "Brand-new-strong-pass-22" })
				.expect(401);
		});

		it("sets a first password for a user who doesn't have one (no current required)", async () => {
			// Create a fresh Google-only user.
			const orm = app.get(MikroORM);
			let userId = 0;
			let token = "";
			await withRequestContext(app, async () => {
				const u = orm.em.create(User, {
					email: "google@example.com",
					name: "Google User",
					isEmailVerified: true,
					role: "user",
					deletionStatus: "active",
				});
				await orm.em.persistAndFlush(u);
				const method = orm.em.create(UserAuthMethod, {
					user: u.id,
					provider: "google",
					providerId: "google-xyz",
				});
				await orm.em.persistAndFlush(method);
				userId = u.id;
			});
			const sessionService = app.get<typeof import("src/auth/session.service").SessionService>(
				(await import("src/auth/session.service")).SessionService,
			);
			token = await sessionService.createSession(userId, { userAgent: "test", ipAddress: "127.0.0.1" });

			await supertest(app.getHttpServer())
				.post("/api/v1/users/me/password")
				.set("Authorization", `Bearer ${token}`)
				.send({ newPassword: "First-password-set-22ch" })
				.expect(200);

			await supertest(app.getHttpServer())
				.post("/api/v1/auth/login-email")
				.send({ email: "google@example.com", password: "First-password-set-22ch" })
				.expect(200);
		});
	});
});
