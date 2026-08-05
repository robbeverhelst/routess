import { MikroORM } from "@mikro-orm/core";
import type { INestApplication } from "@nestjs/common";
import { SessionService } from "src/auth/session.service";
import { Session } from "src/entities/session.entity";
import { clearDatabase, closeTestApp, createTestApp, createTestUserWithAuth, withRequestContext } from "../utils";

// The hourly cleanup used to hydrate every expired Session and flush a
// statement each, which is what failed on the hour in #354. It is one bulk
// UPDATE now, and these pin the behaviour that change has to preserve.
describe("SessionService expired-session cleanup", () => {
	let app: INestApplication;
	let orm: MikroORM;

	beforeAll(async () => {
		app = await createTestApp();
		orm = app.get(MikroORM);
	});

	beforeEach(async () => {
		await clearDatabase(app);
	});

	afterAll(async () => {
		await closeTestApp(app);
	});

	async function seedSession(userId: number, jti: string, expiresAt: Date): Promise<void> {
		await withRequestContext(app, async () => {
			const session = orm.em.create(Session, { jti, user: userId, expiresAt });
			await orm.em.persist(session).flush();
		});
	}

	// createTestUserWithAuth opens a real login session of its own; only the
	// ones seeded here carry the "seed-" prefix.
	async function liveSeededJtis(): Promise<string[]> {
		return withRequestContext(app, async () => {
			const rows = await orm.em.fork().find(Session, { jti: { $like: "seed-%" } });
			return rows.map((s) => s.jti).sort();
		});
	}

	it("soft-deletes only sessions that have already expired", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		await seedSession(user.id, "seed-expired-1", new Date(Date.now() - 60_000));
		await seedSession(user.id, "seed-expired-2", new Date(Date.now() - 3_600_000));
		await seedSession(user.id, "seed-still-valid", new Date(Date.now() + 3_600_000));

		const cleaned = await withRequestContext(app, () => app.get(SessionService).cleanupExpiredSessions());

		expect(cleaned).toBe(2);
		// The soft-delete filter on BaseEntity hides the cleaned rows.
		expect(await liveSeededJtis()).toEqual(["seed-still-valid"]);
	});

	// Both replicas run the @Cron at :00 with no leader election. The bulk
	// UPDATE makes that safe: the second pass matches nothing rather than
	// re-revoking rows and double-counting the revocation telemetry.
	it("is idempotent, so concurrent replicas cannot double-count", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		await seedSession(user.id, "seed-expired-1", new Date(Date.now() - 60_000));

		const service = app.get(SessionService);
		expect(await withRequestContext(app, () => service.cleanupExpiredSessions())).toBe(1);
		expect(await withRequestContext(app, () => service.cleanupExpiredSessions())).toBe(0);
		expect(await withRequestContext(app, () => service.cleanupExpiredSessions())).toBe(0);
	});

	it("reports zero when there is nothing to clean", async () => {
		const { user } = await createTestUserWithAuth(app, { email: "alice@example.com" });
		await seedSession(user.id, "seed-still-valid", new Date(Date.now() + 3_600_000));

		expect(await withRequestContext(app, () => app.get(SessionService).cleanupExpiredSessions())).toBe(0);
		expect(await liveSeededJtis()).toEqual(["seed-still-valid"]);
	});
});
