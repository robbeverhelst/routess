import { join } from "node:path";
import { MikroORM } from "@mikro-orm/postgresql";
import { Client } from "pg";
import config from "../../src/mikro-orm.config";

// Migration20261016000000 adds route.client_ref, unique per User, so claiming
// a device's LocalRoutes twice cannot duplicate them; existing Routes keep a
// null client_ref. Runs the real migrator against a throwaway database, like
// admin-audit-migration.
const DB_NAME = "routess_db_client_ref_migration_test";
const PREVIOUS = "Migration20261015000000";
const MIGRATION = "Migration20261016000000";
const MIGRATIONS_PATH = join(__dirname, "../../src/migrations");

function adminClient(): Client {
	return new Client({
		host: process.env.DB_HOST || "localhost",
		port: Number.parseInt(process.env.DB_PORT || "5432", 10),
		user: process.env.DB_USER || "postgres",
		password: process.env.DB_PASSWORD || "postgres",
		database: "postgres",
	});
}

// Only recreated up front: dropping it again in afterAll waits on an immediate
// checkpoint, which can outlast the hook timeout on a slow CI disk.
async function recreateDatabase(): Promise<void> {
	const client = adminClient();
	await client.connect();
	try {
		await client.query(`drop database if exists "${DB_NAME}" with (force)`);
		await client.query(`create database "${DB_NAME}"`);
	} finally {
		await client.end();
	}
}

describe("route clientRef migration", () => {
	let orm: MikroORM;

	beforeAll(async () => {
		await recreateDatabase();
		orm = await MikroORM.init({
			...config,
			dbName: DB_NAME,
			debug: false,
			preferTs: true,
			migrations: { path: MIGRATIONS_PATH, pathTs: MIGRATIONS_PATH, silent: true, snapshot: false },
		});
	});

	afterAll(async () => {
		await orm?.close(true);
	});

	async function hasClientRefColumn(): Promise<boolean> {
		const rows = await orm.em
			.getConnection()
			.execute(`select 1 from information_schema.columns where table_name = 'route' and column_name = 'client_ref'`);
		return rows.length > 0;
	}

	it("keeps existing routes, binds a clientRef once per user, and reverses cleanly", async () => {
		await orm.migrator.up({ to: PREVIOUS });
		const conn = orm.em.getConnection();
		await conn.execute(
			`insert into "user" ("email", "name", "handle", "created_at", "updated_at") values
				('a@example.com', 'A', 'user-a', now(), now()),
				('b@example.com', 'B', 'user-b', now(), now())`,
		);
		const [a] = await conn.execute(`select "id" from "user" where "email" = 'a@example.com'`);
		const [b] = await conn.execute(`select "id" from "user" where "email" = 'b@example.com'`);
		const insertRoute = (userId: number, clientRef: string | null) =>
			conn.execute(
				`insert into "route" ("name", "waypoints", "tags", "user_id", "share_token", "created_at", "updated_at"${clientRef === null ? "" : `, "client_ref"`})
				values ('Loop', '[]'::jsonb, '[]'::jsonb, ?, md5(random()::text), now(), now()${clientRef === null ? "" : ", ?"})`,
				clientRef === null ? [userId] : [userId, clientRef],
			);
		await insertRoute(a.id, null);

		await orm.migrator.up({ to: MIGRATION });
		const [existing] = await conn.execute(`select "client_ref" from "route"`);
		expect(existing.client_ref).toBeNull();

		await insertRoute(a.id, null);
		await insertRoute(a.id, "11111111-1111-4111-8111-111111111111");
		await insertRoute(b.id, "11111111-1111-4111-8111-111111111111");
		await expect(insertRoute(a.id, "11111111-1111-4111-8111-111111111111")).rejects.toThrow();

		await orm.migrator.down({ to: PREVIOUS });
		expect(await hasClientRefColumn()).toBe(false);
		await orm.migrator.up({ to: MIGRATION });
		expect(await hasClientRefColumn()).toBe(true);
	});
});
