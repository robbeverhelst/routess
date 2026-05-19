#!/usr/bin/env bun
import { randomBytes } from "node:crypto";
import { Socket } from "node:net";
import { $ } from "bun";

const E2E_DB = "routess_db_e2e";

// In CI (GitHub Actions service container) postgres is already running on a
// known port and the DB has been created via POSTGRES_DB. Locally we use
// docker compose. Caller can force-skip docker setup via E2E_DB_PORT.
const portReachable = (port: number) =>
	new Promise<boolean>((resolve) => {
		const sock = new Socket();
		sock.setTimeout(500);
		sock.once("connect", () => {
			sock.destroy();
			resolve(true);
		});
		sock.once("timeout", () => {
			sock.destroy();
			resolve(false);
		});
		sock.once("error", () => resolve(false));
		sock.connect(port, "127.0.0.1");
	});

let dbPort = process.env.E2E_DB_PORT ?? "";
if (!dbPort) {
	console.log("[e2e] starting Postgres (docker compose)");
	await $`docker compose up -d postgres`.quiet();
	const portInspect = await $`docker port routess-postgres-1 5432/tcp`.quiet().text();
	const dbPortMatch = portInspect.match(/0\.0\.0\.0:(\d+)/);
	dbPort = dbPortMatch ? dbPortMatch[1] : "5432";
	console.log(`[e2e] postgres bound to host port ${dbPort}`);

	let ready = false;
	for (let i = 0; i < 30 && !ready; i++) {
		try {
			await $`docker compose exec -T postgres pg_isready -U postgres -d postgres`.quiet();
			ready = true;
		} catch {
			await Bun.sleep(1000);
		}
	}
	if (!ready) {
		console.error("[e2e] Postgres did not become ready in 30s");
		process.exit(1);
	}

	console.log(`[e2e] ensuring database '${E2E_DB}' exists`);
	await $`docker compose exec -T postgres psql -U postgres -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '${E2E_DB}'" | grep -q 1 || docker compose exec -T postgres psql -U postgres -d postgres -c "CREATE DATABASE ${E2E_DB};"`.quiet();
} else {
	console.log(`[e2e] using preconfigured Postgres on port ${dbPort} (E2E_DB_PORT set)`);
	if (!(await portReachable(Number(dbPort)))) {
		console.error(`[e2e] nothing listening on localhost:${dbPort}`);
		process.exit(1);
	}
}

const env: Record<string, string> = {
	...(Object.fromEntries(Object.entries(process.env).filter(([, v]) => typeof v === "string")) as Record<
		string,
		string
	>),
	DB_HOST: "localhost",
	DB_PORT: dbPort,
	DB_USER: "postgres",
	DB_PASSWORD: "postgres",
	DB_NAME: E2E_DB,
	E2E_DB_PORT: dbPort,
	JWT_SECRET: process.env.JWT_SECRET ?? "e2e-jwt-secret-not-for-prod",
	GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "e2e-google-client-id.apps.googleusercontent.com",
	VITE_E2E: "true",
	E2E_API_PORT: process.env.E2E_API_PORT ?? "3010",
	E2E_WEB_PORT: process.env.E2E_WEB_PORT ?? "5183",
	VITE_API_URL: process.env.VITE_API_URL ?? `http://localhost:${process.env.E2E_API_PORT ?? "3010"}`,
	FRONTEND_URL: process.env.FRONTEND_URL ?? `http://localhost:${process.env.E2E_WEB_PORT ?? "5183"}`,
	E2E_TEST_LOGIN_SECRET: process.env.E2E_TEST_LOGIN_SECRET ?? randomBytes(32).toString("hex"),
};

console.log("[e2e] building packages");
await $`bun run --filter './packages/*' build`.env(env);

console.log("[e2e] building API for E2E");
await $`bun run --filter './apps/api' build:e2e`.env(env);

const passthrough = process.argv.slice(2);
const target = passthrough[0] === "ui" ? "e2e:ui" : passthrough[0] === "record" ? "e2e:record" : "e2e";

console.log(`[e2e] running Playwright (${target})`);
await $`bun run --filter './apps/web' ${target}`.env(env);
