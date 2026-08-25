import { MikroORM } from "@mikro-orm/core";
import { Client } from "pg";
import { getAppConfig, loadEnvironment } from "../../src/config/app-config";

// Regression test for issue #375: a dropped Postgres connection used to take
// the whole process down. `pg` emits 'error' on the Client when a connection
// dies mid-query and on the Pool when an idle one dies, and an EventEmitter
// 'error' with no listener is rethrown — under Bun that exits the process, so a
// ~30 s LAN blip killed the API pod. Without the listeners in
// mikro-orm.config.ts both cases below take the test runner down with them.
describe("Postgres connection resilience", () => {
	let orm: MikroORM;
	// Second connection, outside the pool, used to terminate the pool's backends.
	let terminator: Client;

	function connection() {
		return orm.em.getConnection();
	}

	async function currentBackendPid(): Promise<number> {
		const [row] = await connection().execute<{ pid: number }[]>("select pg_backend_pid() as pid");
		return row.pid;
	}

	// The pool only replaces a dead connection once it has processed the socket
	// error, so a fresh backend pid is proof the failure was handled rather than
	// outrun by the assertions.
	async function waitForReplacementBackend(deadPid: number): Promise<number> {
		for (let attempt = 0; attempt < 100; attempt++) {
			const pid = await currentBackendPid().catch(() => deadPid);
			if (pid !== deadPid) return pid;
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		throw new Error(`The pool never replaced terminated backend ${deadPid}`);
	}

	async function waitForSleepingBackend(): Promise<number> {
		for (let attempt = 0; attempt < 100; attempt++) {
			const { rows } = await terminator.query<{ pid: number }>(
				`select pid from pg_stat_activity
				 where datname = current_database() and pid <> pg_backend_pid() and query like 'select pg_sleep%'`,
			);
			const pid = rows[0]?.pid;
			if (pid !== undefined) return pid;
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
		throw new Error("The pg_sleep query never showed up in pg_stat_activity");
	}

	beforeAll(async () => {
		process.env.NODE_ENV = "test";
		process.env.DB_NAME = "routess_db_test";
		process.env.JWT_SECRET = "test-secret-key";
		loadEnvironment();

		const { default: config } = await import("../../src/mikro-orm.config");
		orm = await MikroORM.init(config);
		await orm.schema.ensureDatabase();

		const database = getAppConfig().database;
		terminator = new Client({
			host: database.host,
			port: database.port,
			user: database.user,
			password: database.password,
			database: database.name,
		});
		terminator.on("error", () => undefined);
		await terminator.connect();
	});

	afterAll(async () => {
		await terminator?.end().catch(() => undefined);
		await orm?.close(true);
	});

	it("recovers when an idle pooled connection is terminated", async () => {
		// The client is back in the pool and idle by the time it is killed, which
		// is the case the pool's own error listener covers.
		const deadPid = await currentBackendPid();
		await terminator.query("select pg_terminate_backend($1)", [deadPid]);

		expect(await waitForReplacementBackend(deadPid)).not.toBe(deadPid);
	});

	it("recovers when a connection is dropped mid-query", async () => {
		// A checked-out client has no error listener from the pool, so this is the
		// shape that actually crashed the pod.
		const inFlight = connection()
			.execute("select pg_sleep(10)")
			.then(
				() => null,
				(error: unknown) => error,
			);
		const deadPid = await waitForSleepingBackend();
		await terminator.query("select pg_terminate_backend($1)", [deadPid]);

		expect(await inFlight).toBeInstanceOf(Error);
		expect(await waitForReplacementBackend(deadPid)).not.toBe(deadPid);
	});
});
