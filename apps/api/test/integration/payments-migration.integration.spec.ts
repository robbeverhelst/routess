import { join } from "node:path";
import { MikroORM } from "@mikro-orm/postgresql";
import { Client } from "pg";
import config from "../../src/mikro-orm.config";

// Migration20261009000000 (ADR 0039) must stay reversible: down() drops the
// Plan column and the entitlement table without touching existing Users, and
// up() after a down() restores them. Runs the real migrator against a
// throwaway database, since the other integration tests build the schema from
// entities and never exercise migrations.
const DB_NAME = "routess_db_migration_test";
const PREVIOUS = "Migration20260611000000";
const MIGRATION = "Migration20261009000000";
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

async function recreateDatabase(drop: boolean): Promise<void> {
	const client = adminClient();
	await client.connect();
	try {
		await client.query(`drop database if exists "${DB_NAME}" with (force)`);
		if (!drop) {
			await client.query(`create database "${DB_NAME}"`);
		}
	} finally {
		await client.end();
	}
}

describe("payments migration", () => {
	let orm: MikroORM;

	beforeAll(async () => {
		await recreateDatabase(false);
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
		await recreateDatabase(true);
	});

	async function columnExists(table: string, column: string): Promise<boolean> {
		const rows = await orm.em
			.getConnection()
			.execute(`select 1 from information_schema.columns where table_name = ? and column_name = ?`, [table, column]);
		return rows.length > 0;
	}

	async function tableExists(table: string): Promise<boolean> {
		const rows = await orm.em.getConnection().execute(`select to_regclass(?) as oid`, [`"${table}"`]);
		return rows[0].oid !== null;
	}

	it("adds plan (default free) and the entitlement table, and reverses cleanly", async () => {
		await orm.migrator.up({ to: PREVIOUS });
		expect(await columnExists("user", "plan")).toBe(false);

		// A User that exists before the migration gets the default Plan.
		const conn = orm.em.getConnection();
		await conn.execute(
			`insert into "user" ("email", "name", "handle", "created_at", "updated_at") values ('pre@example.com', 'Pre', 'pre-user', now(), now())`,
		);

		await orm.migrator.up({ to: MIGRATION });
		expect(await tableExists("entitlement")).toBe(true);
		const [pre] = await conn.execute(`select "plan" from "user" where "email" = 'pre@example.com'`);
		expect(pre.plan).toBe("free");

		await orm.migrator.down({ to: PREVIOUS });
		expect(await tableExists("entitlement")).toBe(false);
		expect(await columnExists("user", "plan")).toBe(false);
		const kept = await conn.execute(`select 1 from "user" where "email" = 'pre@example.com'`);
		expect(kept).toHaveLength(1);

		await orm.migrator.up({ to: MIGRATION });
		expect(await tableExists("entitlement")).toBe(true);
		const [again] = await conn.execute(`select "plan" from "user" where "email" = 'pre@example.com'`);
		expect(again.plan).toBe("free");
	});

	it("cascades entitlement rows when their User is hard-deleted", async () => {
		const conn = orm.em.getConnection();
		const [user] = await conn.execute(`select "id" from "user" where "email" = 'pre@example.com'`);
		await conn.execute(
			`insert into "entitlement" ("user_id", "feature", "source") values (?, 'route_generation', 'manual')`,
			[user.id],
		);

		await conn.execute(`delete from "user" where "id" = ?`, [user.id]);
		const [left] = await conn.execute(`select count(*)::int as n from "entitlement"`);
		expect(left.n).toBe(0);
	});
});
