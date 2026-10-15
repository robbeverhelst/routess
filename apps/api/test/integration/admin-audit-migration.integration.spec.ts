import { join } from "node:path";

import { MikroORM } from "@mikro-orm/postgresql";
import { Client } from "pg";

import config from "../../src/mikro-orm.config";

// Migration20261013000000 adds admin_audit_entry, the trail of admin Pro
// actions. Its User links are set null on delete so entries outlive both
// accounts, and down() drops the table. Runs the real migrator against a
// throwaway database, like payments-migration.
const DB_NAME = "routess_db_audit_migration_test";
const PREVIOUS = "Migration20261010000000";
const MIGRATION = "Migration20261013000000";
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

describe("admin audit migration", () => {
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

	async function tableExists(table: string): Promise<boolean> {
		const rows = await orm.em.getConnection().execute(`select to_regclass(?) as oid`, [`"${table}"`]);
		return rows[0].oid !== null;
	}

	it("adds admin_audit_entry, keeps entries past a hard delete, and reverses cleanly", async () => {
		await orm.migrator.up({ to: PREVIOUS });
		expect(await tableExists("admin_audit_entry")).toBe(false);

		await orm.migrator.up({ to: MIGRATION });
		expect(await tableExists("admin_audit_entry")).toBe(true);

		const conn = orm.em.getConnection();
		await conn.execute(
			`insert into "user" ("email", "name", "handle", "created_at", "updated_at") values
				('admin@example.com', 'Admin', 'admin-user', now(), now()),
				('target@example.com', 'Target', 'target-user', now(), now())`,
		);
		const [admin] = await conn.execute(`select "id" from "user" where "email" = 'admin@example.com'`);
		const [target] = await conn.execute(`select "id" from "user" where "email" = 'target@example.com'`);
		await conn.execute(
			`insert into "admin_audit_entry" ("actor_id", "actor_email", "action", "target_user_id", "details", "reason")
			values (?, 'admin@example.com', 'pro.grant', ?, '{"days": 30}'::jsonb, 'Beta tester')`,
			[admin.id, target.id],
		);

		await conn.execute(`delete from "user" where "id" in (?, ?)`, [admin.id, target.id]);
		const [entry] = await conn.execute(`select * from "admin_audit_entry"`);
		expect(entry).toMatchObject({ actor_id: null, target_user_id: null, actor_email: "admin@example.com" });
		expect(entry.details).toEqual({ days: 30 });

		await orm.migrator.down({ to: PREVIOUS });
		expect(await tableExists("admin_audit_entry")).toBe(false);
		await orm.migrator.up({ to: MIGRATION });
		expect(await tableExists("admin_audit_entry")).toBe(true);
	});
});
