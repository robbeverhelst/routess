import { existsSync } from "node:fs";
import { createServer } from "node:net";

const DEFAULT_DB_PORT = 5432;
const DEFAULT_PGADMIN_PORT = 5050;
const DEFAULT_API_PORT = 3000;
const DEFAULT_DOCS_PORT = 3001;
const DEFAULT_WEB_PORT = 5173;
const PORT_SCAN_LIMIT = 100;

type Command = [string, ...string[]];

async function canBindPort(port: number): Promise<boolean> {
	return await new Promise((resolve) => {
		const server = createServer();

		server.once("error", () => {
			resolve(false);
		});

		server.once("listening", () => {
			server.close(() => resolve(true));
		});

		server.listen(port, "0.0.0.0");
	});
}

async function findAvailablePort(preferredPort: number, reservedPorts: ReadonlySet<number>): Promise<number> {
	for (let port = preferredPort; port < preferredPort + PORT_SCAN_LIMIT; port += 1) {
		if (!reservedPorts.has(port) && (await canBindPort(port))) {
			return port;
		}
	}

	throw new Error(`No free port found in range ${preferredPort}-${preferredPort + PORT_SCAN_LIMIT - 1}`);
}

function parsePort(value: string | undefined, fallback: number): number {
	if (!value) {
		return fallback;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
		throw new Error(`Invalid port: ${value}`);
	}

	return parsed;
}

async function resolvePort(envName: string, defaultPort: number, reservedPorts: Set<number>): Promise<number> {
	if (process.env[envName]) {
		const port = parsePort(process.env[envName], defaultPort);
		if (port === defaultPort) {
			const resolvedPort = await findAvailablePort(defaultPort, reservedPorts);
			reservedPorts.add(resolvedPort);
			return resolvedPort;
		}

		if (reservedPorts.has(port)) {
			throw new Error(`${envName}=${port} conflicts with another configured service port`);
		}
		reservedPorts.add(port);
		return port;
	}

	const port = await findAvailablePort(defaultPort, reservedPorts);
	reservedPorts.add(port);
	return port;
}

async function commandExists(command: string): Promise<boolean> {
	const proc = Bun.spawn({
		cmd: ["sh", "-lc", `command -v ${command}`],
		stdio: ["ignore", "ignore", "ignore"],
	});
	const exitCode = await proc.exited;
	return exitCode === 0;
}

async function resolveComposeCommand(): Promise<Command> {
	if (await commandExists("docker-compose")) {
		return ["docker-compose"];
	}

	if (await commandExists("docker")) {
		return ["docker", "compose"];
	}

	throw new Error("Docker Compose is not installed");
}

async function runCommand(command: Command, env: Record<string, string>, description: string): Promise<void> {
	console.log(`\n> ${description}`);
	const proc = Bun.spawn({
		cmd: command,
		env,
		stdio: ["inherit", "inherit", "inherit"],
	});

	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		throw new Error(`${description} failed with exit code ${exitCode}`);
	}
}

async function main(): Promise<void> {
	const reservedPorts = new Set<number>();
	const apiPort = await resolvePort("PORT", DEFAULT_API_PORT, reservedPorts);
	const docsPort = await resolvePort("DOCS_PORT", DEFAULT_DOCS_PORT, reservedPorts);
	const webPort = await resolvePort("WEB_PORT", DEFAULT_WEB_PORT, reservedPorts);
	const dbPort = await resolvePort("DB_PORT", DEFAULT_DB_PORT, reservedPorts);
	const pgadminPort = await resolvePort("PGADMIN_PORT", DEFAULT_PGADMIN_PORT, reservedPorts);
	const composeCommand = await resolveComposeCommand();
	const frontendUrl =
		process.env.FRONTEND_URL === "http://localhost:5173" || !process.env.FRONTEND_URL
			? `http://localhost:${webPort}`
			: process.env.FRONTEND_URL;
	const appUrl =
		process.env.VITE_APP_URL === "http://localhost:5173" || !process.env.VITE_APP_URL
			? `http://localhost:${webPort}`
			: process.env.VITE_APP_URL;
	const apiUrl =
		process.env.VITE_API_URL === "http://localhost:3000" || !process.env.VITE_API_URL
			? `http://localhost:${apiPort}`
			: process.env.VITE_API_URL;
	const env = {
		...process.env,
		DB_PORT: `${dbPort}`,
		PGADMIN_PORT: `${pgadminPort}`,
		PORT: `${apiPort}`,
		DOCS_PORT: `${docsPort}`,
		WEB_PORT: `${webPort}`,
		FRONTEND_URL: frontendUrl,
		VITE_APP_URL: appUrl,
		VITE_API_URL: apiUrl,
	};

	console.log(`Using PORT=${apiPort} for the API`);
	console.log(`Using DOCS_PORT=${docsPort}`);
	console.log(`Using WEB_PORT=${webPort}`);
	console.log(`Using DB_PORT=${dbPort}`);
	console.log(`Using PGADMIN_PORT=${pgadminPort}`);

	if (!existsSync("node_modules")) {
		await runCommand(["bun", "install"], env, "Installing dependencies");
	}

	await runCommand([...composeCommand, "up", "-d", "postgres"], env, "Starting postgres");
	await runCommand([...composeCommand, "up", "-d", "pgadmin"], env, "Starting pgAdmin");

	if (process.env.DEV_PREPARE_ONLY === "1") {
		console.log("\nPrepared Docker services only");
		return;
	}

	await runCommand(["bun", "run", "--filter", "./packages/*", "build"], env, "Building workspace packages");
	await runCommand(["bun", "run", "--filter", "./apps/*", "dev"], env, "Starting app dev servers");
}

await main();
