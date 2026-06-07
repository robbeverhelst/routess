import type { Command } from "commander";
import { request } from "../client";
import { clearToken, configFileLocation, loadConfig, requireToken, saveToken } from "../config";
import { CliError, EXIT_CODES, renderResult } from "../output";
import { runWithProgram } from "../run";

interface AuthOptions {
	token?: string;
	apiUrl?: string;
}

interface WhoamiResponse {
	id: number;
	email: string;
	name: string;
}

export function registerAuthCommands(program: Command): void {
	const auth = program
		.command("auth")
		.description("Authentication: log in with a personal access token, log out, identify the current session.");

	auth
		.command("login")
		.description(
			"Store a personal access token for subsequent commands. Mint a token at the web app's Settings → API Tokens page first.",
		)
		.requiredOption("--token <pat>", "the routess_pat_… token copied from the web Settings page")
		.option(
			"--api-url <url>",
			"API base URL to associate with this token (otherwise the existing value or the default is kept)",
		)
		.action(async (options: AuthOptions) => {
			await runWithProgram(program, async (runOptions) => {
				if (!options.token?.startsWith("routess_pat_")) {
					throw new CliError("Token must start with routess_pat_", EXIT_CODES.USAGE);
				}
				// Probe the token against /users/me before persisting so a
				// fat-fingered paste exits non-zero immediately.
				const config = { ...loadConfig(), token: options.token, apiUrl: options.apiUrl ?? loadConfig().apiUrl };
				let me: WhoamiResponse;
				try {
					me = await request<WhoamiResponse>(config, "/api/v1/users/me");
				} catch (error) {
					if (error instanceof CliError && error.exitCode === EXIT_CODES.UNAUTHORIZED) {
						throw new CliError(
							"Token was rejected by the API. Confirm it was copied in full and that the API URL is correct.",
							EXIT_CODES.UNAUTHORIZED,
						);
					}
					throw error;
				}
				saveToken(options.token, options.apiUrl);
				renderResult(runOptions, { user: me, location: configFileLocation() }, (data) => {
					return `Signed in as ${data.user.email}. Token saved to ${data.location}.`;
				});
			});
		});

	auth
		.command("logout")
		.description(
			"Forget the stored token. The token itself remains valid on the server until revoked from the web Settings page.",
		)
		.action(async () => {
			await runWithProgram(program, async (runOptions) => {
				const removed = clearToken();
				renderResult(runOptions, { removed, location: configFileLocation() }, (data) =>
					data.removed ? `Token removed (${data.location}).` : "No stored token to remove.",
				);
			});
		});

	auth
		.command("whoami")
		.description("Show the user identity associated with the currently active token.")
		.action(async () => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const me = await request<WhoamiResponse>(config, "/api/v1/users/me");
				renderResult(runOptions, me, (data) => `${data.email}  (id=${data.id}, name=${data.name})`);
			});
		});
}
