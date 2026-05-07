import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";

const PATHS = [
	"node_modules",
	"apps/api/node_modules",
	"apps/docs/node_modules",
	"apps/web/node_modules",
	"packages/api-client/node_modules",
	"packages/core/node_modules",
	"packages/design-tokens/node_modules",
	"packages/i18n/node_modules",
	"apps/api/dist",
	"apps/docs/.next",
	"apps/docs/.source",
	"apps/web/dist",
	"apps/api/tsconfig.tsbuildinfo",
	"apps/api/tsconfig.build.tsbuildinfo",
	"apps/web/tsconfig.tsbuildinfo",
	"packages/api-client/tsconfig.tsbuildinfo",
	"packages/core/tsconfig.tsbuildinfo",
	"packages/design-tokens/tsconfig.tsbuildinfo",
	"packages/i18n/tsconfig.tsbuildinfo",
	"coverage",
	"apps/api/coverage",
	"apps/web/coverage",
	"apps/api/.nest",
	"apps/web/node_modules/.vite",
	".turbo",
	"pgadmin",
];

async function dockerComposeDown(): Promise<void> {
	await new Promise<void>((resolve) => {
		const child = spawn("docker", ["compose", "down", "-v", "--remove-orphans"], {
			stdio: "inherit",
		});
		child.on("exit", () => resolve());
		child.on("error", () => resolve());
	});
}

async function main(): Promise<void> {
	await dockerComposeDown();
	await Promise.all(PATHS.map((path) => rm(path, { recursive: true, force: true }).catch(() => undefined)));
	console.log("clean: done");
}

await main();
