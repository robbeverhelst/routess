#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { registerAccountCommands } from "./commands/account";
import { registerAuthCommands } from "./commands/auth";
import { registerCollectionsCommands } from "./commands/collections";
import { registerGenerateCommand } from "./commands/generate";
import { registerRoutesCommands } from "./commands/routes";
import { registerTokensCommands } from "./commands/tokens";
import { renderError } from "./output";

const program = new Command();
const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), "../package.json");
const packageVersion = JSON.parse(readFileSync(packageJsonPath, "utf8")).version as string;

program
	.name("routess")
	.description("Routess command-line interface. See `routess auth login --help` to get started.")
	.version(packageVersion)
	.option("--json", "emit machine-readable JSON to stdout, errors as DomainErrorPayload to stderr", false);

registerAuthCommands(program);
registerRoutesCommands(program);
registerCollectionsCommands(program);
registerGenerateCommand(program);
registerTokensCommands(program);
registerAccountCommands(program);

program.parseAsync(process.argv).catch((error) => {
	const options = program.opts<{ json?: boolean }>();
	const code = renderError({ json: Boolean(options.json) }, error);
	process.exit(code);
});
