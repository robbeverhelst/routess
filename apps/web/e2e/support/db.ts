import { Client } from "pg";

// Direct Postgres reset for E2E. Per ADR-0018, the API exposes no /test/reset
// endpoint — wiping data via direct DB credentials means the API binary
// contains no "wipe everything" code path at all.

const TEST_DB_NAME_PATTERN = /(_e2e|_test)$/;

function buildConnectionString(): string {
	if (process.env.E2E_DB_URL) return process.env.E2E_DB_URL;
	const host = "localhost";
	const port = process.env.E2E_DB_PORT ?? process.env.DB_PORT ?? "5432";
	const user = "postgres";
	const password = "postgres";
	const database = process.env.DB_NAME ?? "routess_db_e2e";
	return `postgres://${user}:${password}@${host}:${port}/${database}`;
}

function assertTestDb(connectionString: string): void {
	const dbName = new URL(connectionString.replace("postgres://", "http://")).pathname.slice(1);
	if (!TEST_DB_NAME_PATTERN.test(dbName)) {
		throw new Error(`Refusing to truncate non-test DB '${dbName}' (must end in _e2e or _test)`);
	}
}

export async function truncateDb(): Promise<void> {
	const connectionString = buildConnectionString();
	assertTestDb(connectionString);
	const client = new Client({ connectionString });
	await client.connect();
	try {
		await client.query(
			`TRUNCATE TABLE "verification_token", "user_auth_method", "session", "route", "user" RESTART IDENTITY CASCADE`,
		);
	} finally {
		await client.end();
	}
}
