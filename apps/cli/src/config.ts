import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CliError, EXIT_CODES } from "./output";

// Token storage matches the convention used by gh / aws / kubectl: a plain
// JSON file at $XDG_CONFIG_HOME/routess/auth.json (or ~/.config/routess
// when XDG_CONFIG_HOME is unset) with mode 0600. ROUTESS_TOKEN takes
// precedence so CI and containers can inject a token without touching
// the filesystem.

export interface CliConfig {
	apiUrl: string;
	token: string | null;
	tokenSource: "env" | "file" | "none";
}

function configDir(): string {
	const xdg = process.env.XDG_CONFIG_HOME?.trim();
	const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
	return join(base, "routess");
}

function authFilePath(): string {
	return join(configDir(), "auth.json");
}

interface PersistedAuth {
	token?: string;
	apiUrl?: string;
}

function readPersisted(): PersistedAuth {
	const path = authFilePath();
	if (!existsSync(path)) {
		return {};
	}
	try {
		const raw = readFileSync(path, "utf8");
		const parsed = JSON.parse(raw) as PersistedAuth;
		return parsed;
	} catch {
		return {};
	}
}

export function loadConfig(): CliConfig {
	const envToken = process.env.ROUTESS_TOKEN?.trim();
	const envApiUrl = process.env.ROUTESS_API_URL?.trim();
	const persisted = readPersisted();

	const apiUrl = envApiUrl || persisted.apiUrl || "https://routess-api.robbeverhelst.com";

	if (envToken && envToken.length > 0) {
		return { apiUrl, token: envToken, tokenSource: "env" };
	}
	if (persisted.token && persisted.token.length > 0) {
		return { apiUrl, token: persisted.token, tokenSource: "file" };
	}
	return { apiUrl, token: null, tokenSource: "none" };
}

export function saveToken(token: string, apiUrl?: string): void {
	const dir = configDir();
	mkdirSync(dir, { recursive: true });
	const path = authFilePath();
	const existing = readPersisted();
	const payload: PersistedAuth = {
		...existing,
		token,
		...(apiUrl ? { apiUrl } : {}),
	};
	writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8" });
	try {
		chmodSync(path, 0o600);
	} catch {
		// Best-effort; on Windows chmod is a no-op. The credential file is
		// still in the user's home directory and inherits the user-only
		// permissions of that directory.
	}
}

export function clearToken(): boolean {
	const path = authFilePath();
	if (!existsSync(path)) {
		return false;
	}
	rmSync(path);
	const dir = configDir();
	try {
		// rmdir-if-empty
		rmSync(dir, { recursive: false });
	} catch {
		// Directory is not empty (other tools may share $XDG_CONFIG_HOME/routess
		// in the future). Leaving it in place is the right thing.
	}
	return true;
}

export function configFileLocation(): string {
	return authFilePath();
}

// Throws a CliError mapped to exit code 5 (UNAUTHORIZED) when there is no
// token, matching the exit-code taxonomy documented in
// docs/skills/routess.skill.md so agents branch on "auth needed" the same
// way regardless of whether the token is missing locally or rejected by the
// API.
export function requireToken(config: CliConfig): string {
	if (!config.token) {
		throw new CliError(
			"Not signed in. Run `routess auth login --token <pat>` after minting a token in the web app Settings → API Tokens.",
			EXIT_CODES.UNAUTHORIZED,
		);
	}
	return config.token;
}
