import type { Command } from "commander";
import { request } from "../client";
import { loadConfig, requireToken } from "../config";
import { renderResult } from "../output";
import { runWithProgram } from "../run";
import { parseId } from "./routes";

interface TokenResponse {
	id: number;
	label: string;
	scope: "read" | "write";
	lastUsedAt: string | null;
	expiresAt: string | null;
	createdAt: string;
}

export function registerTokensCommands(program: Command): void {
	const tokens = program
		.command("tokens")
		.description(
			"Manage personal access tokens. Minting stays in the web app (Settings → API Tokens); the CLI can list and revoke.",
		);

	tokens
		.command("list")
		.description("List the user's active tokens. Plaintext is never shown; only metadata.")
		.action(async () => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const items = await request<TokenResponse[]>(config, "/api/v1/auth/tokens");
				renderResult(runOptions, items, (data) => {
					if (data.length === 0) {
						return "No active tokens.";
					}
					const header = "id\tlabel\tscope\tlast used\texpires";
					const body = data
						.map((t) => `${t.id}\t${t.label}\t${t.scope}\t${t.lastUsedAt ?? "never"}\t${t.expiresAt ?? "never"}`)
						.join("\n");
					return `${header}\n${body}`;
				});
			});
		});

	tokens
		.command("revoke <id>")
		.description(
			"Revoke a token by id. Revoking the token this CLI is authenticated with locks you out and requires --confirm.",
		)
		.option("--confirm", "set X-Routess-Confirm: true (required for self-revocation)")
		.action(async (id: string, options: { confirm?: boolean }) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const result = await request<{ success: boolean }>(config, `/api/v1/auth/tokens/${parseId(id)}`, {
					method: "DELETE",
					confirm: options.confirm,
				});
				renderResult(runOptions, result, () => `Token ${id} revoked.`);
			});
		});
}
