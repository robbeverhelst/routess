// Bun-native guard: fails when a workspace depends on a package Bun already
// replaces. Prefer the Bun equivalent; if a package is still needed, drop it
// from REPLACED with the reason in the PR. Usage: bun scripts/bun-native-check.ts [repo root]
import { join, relative } from "node:path";

// Package (or scope prefix ending in "/") → what to use instead.
const REPLACED: Record<string, string> = {
	jest: "bun test",
	"ts-jest": "bun test",
	"@types/jest": "bun test (@types/bun)",
	vitest: "bun test",
	"@vitest/": "bun test",
	supertest: "fetch (apps/api/test/utils/http.ts)",
	"@types/supertest": "fetch (apps/api/test/utils/http.ts)",
	"ts-node": "bun (runs TypeScript directly)",
	tsx: "bun (runs TypeScript directly)",
	argon2: "Bun.password",
	bcrypt: "Bun.password",
	dotenv: "Bun's .env loading / process.loadEnvFile",
	rimraf: "rm -rf in scripts, or Bun.$",
	esbuild: "bun build",
	tsup: "bun build",
	"js-yaml": "Bun.YAML",
	"@types/js-yaml": "Bun.YAML",
};

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;

type Violation = { manifest: string; name: string; use: string };

function replacementFor(name: string): string | undefined {
	if (name in REPLACED) return REPLACED[name];
	const scope = Object.keys(REPLACED).find((key) => key.endsWith("/") && name.startsWith(key));
	return scope ? REPLACED[scope] : undefined;
}

async function findViolations(root: string): Promise<Violation[]> {
	const rootManifest = await Bun.file(join(root, "package.json")).json();
	const patterns: string[] = rootManifest.workspaces ?? [];
	const manifests = [join(root, "package.json")];
	for (const pattern of patterns) {
		for await (const path of new Bun.Glob(`${pattern}/package.json`).scan({ cwd: root, absolute: true })) {
			manifests.push(path);
		}
	}

	const violations: Violation[] = [];
	for (const manifest of manifests.sort()) {
		const pkg = await Bun.file(manifest).json();
		for (const field of DEPENDENCY_FIELDS) {
			for (const name of Object.keys(pkg[field] ?? {})) {
				const use = replacementFor(name);
				if (use) violations.push({ manifest: relative(root, manifest), name, use });
			}
		}
	}
	return violations;
}

if (import.meta.main) {
	const root = Bun.argv[2] ?? process.cwd();
	const violations = await findViolations(root);
	if (violations.length > 0) {
		for (const { manifest, name, use } of violations) {
			console.error(`${manifest}: "${name}" has a Bun equivalent, use ${use}`);
		}
		console.error("\nBun-native rule: check what Bun ships before adding a dependency (CLAUDE.md).");
		process.exit(1);
	}
	console.log("bun-native: no replaceable dependencies");
}
