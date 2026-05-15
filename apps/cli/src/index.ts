#!/usr/bin/env bun
import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth";
import { registerRoutesCommands } from "./commands/routes";
import { type RunOptions, renderError } from "./output";

const program = new Command();

program
	.name("routess")
	.description("Routess command-line interface. See `routess auth login --help` to get started.")
	.version("0.1.0")
	.option("--json", "emit machine-readable JSON to stdout, errors as DomainErrorPayload to stderr", false)
	.option("--api-url <url>", "override the API base URL (defaults to ROUTESS_API_URL env var or production)");

// Run a command, translating thrown errors into the exit code mapping
// documented in docs/skills/routess.skill.md. Subcommands import this
// from output.ts and throw CliError directly to set their exit code.
export async function runCommand(action: (options: RunOptions) => Promise<void> | void): Promise<void> {
	const options = program.opts<{ json?: boolean }>();
	const runOptions: RunOptions = { json: Boolean(options.json) };
	try {
		await action(runOptions);
	} catch (error) {
		const code = renderError(runOptions, error);
		process.exit(code);
	}
}

registerAuthCommands(program);
registerRoutesCommands(program);

program.parseAsync(process.argv).catch((error) => {
	const options = program.opts<{ json?: boolean }>();
	const code = renderError({ json: Boolean(options.json) }, error);
	process.exit(code);
});
