import { writeFileSync } from "node:fs";
import type { Command } from "commander";
import { requestRaw } from "../client";
import { loadConfig, requireToken } from "../config";
import { renderResult } from "../output";
import { runWithProgram } from "../run";

export function registerAccountCommands(program: Command): void {
	program
		.command("export")
		.description(
			"Download the full account export: a ZIP with routess-export.json plus one GPX file per route (GDPR Art. 15).",
		)
		.option("-o, --output <file>", "output path (defaults to the server-suggested filename)")
		.action(async (options: { output?: string }) => {
			await runWithProgram(program, async (runOptions) => {
				const config = loadConfig();
				requireToken(config);
				const raw = await requestRaw(config, "/api/v1/users/me/export");
				const path = options.output ?? raw.filename ?? "routess-export.zip";
				writeFileSync(path, raw.bytes);
				renderResult(
					runOptions,
					{ path, bytes: raw.bytes.length },
					(data) => `Wrote ${data.bytes} bytes to ${data.path}.`,
				);
			});
		});
}
