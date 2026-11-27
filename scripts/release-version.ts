// semantic-release plugin: stamps the release version into the root
// package.json, which @semantic-release/git then commits. It replaces
// @semantic-release/npm (npmPublish: false), whose only job here was that
// bump and which shells out to the npm CLI to do it. Loaded by Node
// (`npx semantic-release` in CI), so it uses node:fs rather than Bun.file.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type PrepareContext = {
	cwd: string;
	nextRelease: { version: string };
	logger: { log: (message: string, ...args: unknown[]) => void };
};

const VERSION_FIELD = /^(\t"version": )"[^"]*"/m;

export async function prepare(_config: unknown, { cwd, nextRelease, logger }: PrepareContext): Promise<void> {
	const path = join(cwd, "package.json");
	const source = await readFile(path, "utf8");
	if (!VERSION_FIELD.test(source)) {
		throw new Error(`No top-level "version" field in ${path}`);
	}
	await writeFile(path, source.replace(VERSION_FIELD, `$1"${nextRelease.version}"`));
	logger.log("Wrote version %s to %s", nextRelease.version, path);
}
