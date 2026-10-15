import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "bun-native-check.ts");

let root: string | undefined;

async function workspace(packages: Record<string, object>): Promise<string> {
	root = await mkdtemp(join(tmpdir(), "bun-native-check-"));
	for (const [dir, manifest] of Object.entries(packages)) {
		await Bun.write(join(root, dir, "package.json"), JSON.stringify(manifest));
	}
	return root;
}

function check(cwd: string) {
	return Bun.spawnSync(["bun", SCRIPT, cwd], { stdout: "pipe", stderr: "pipe" });
}

afterEach(async () => {
	if (root) await rm(root, { recursive: true, force: true });
	root = undefined;
});

describe("bun-native-check", () => {
	it("passes a workspace that only uses packages Bun does not replace", async () => {
		const dir = await workspace({
			".": { workspaces: ["apps/*"], devDependencies: { typescript: "^6.0.0" } },
			"apps/api": { dependencies: { pg: "^8.0.0", ioredis: "^6.0.0" } },
		});

		const result = check(dir);

		expect(result.exitCode).toBe(0);
		expect(result.stdout.toString()).toContain("no replaceable dependencies");
	});

	it("fails on a replaceable dependency in any workspace and names the Bun equivalent", async () => {
		const dir = await workspace({
			".": { workspaces: ["apps/*", "packages/*"] },
			"apps/api": { dependencies: { dotenv: "^18.0.0" } },
			"packages/core": { devDependencies: { "@vitest/coverage-v8": "^5.0.0" } },
		});

		const result = check(dir);
		const stderr = result.stderr.toString();

		expect(result.exitCode).toBe(1);
		expect(stderr).toContain(`${join("apps", "api", "package.json")}: "dotenv"`);
		expect(stderr).toContain("process.loadEnvFile");
		expect(stderr).toContain(`${join("packages", "core", "package.json")}: "@vitest/coverage-v8"`);
	});

	it("checks the root manifest too", async () => {
		const dir = await workspace({ ".": { devDependencies: { rimraf: "^6.0.0" } } });

		const result = check(dir);

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain('package.json: "rimraf"');
	});
});
