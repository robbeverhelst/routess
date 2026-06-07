import type { Command } from "commander";
import { type RunOptions, renderError } from "./output";

// Resolves the global flags off the root program and translates thrown
// errors into the exit-code mapping documented in
// docs/skills/routess.skill.md. Subcommands throw CliError to set their
// exit code.
export async function runWithProgram(program: Command, action: (options: RunOptions) => Promise<void>): Promise<void> {
	const opts = program.opts<{ json?: boolean }>();
	const runOptions: RunOptions = { json: Boolean(opts.json) };
	try {
		await action(runOptions);
	} catch (error) {
		const code = renderError(runOptions, error);
		process.exit(code);
	}
}
