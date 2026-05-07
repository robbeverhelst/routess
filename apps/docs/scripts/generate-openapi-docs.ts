import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { generateFiles } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";

const docsRoot = process.cwd();
const schemaPath = resolve(docsRoot, "openapi/routess.openapi.json");
const outputDir = resolve(docsRoot, "content/api/endpoints");
const schema = JSON.parse(await readFile(schemaPath, "utf8")) as Record<string, unknown>;

function slugify(value: string) {
	return value
		.toLowerCase()
		.replaceAll("{", "")
		.replaceAll("}", "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

await rm(outputDir, { force: true, recursive: true });

await generateFiles({
	input: createOpenAPI({
		input: () => ({
			routess: schema,
		}),
	}),
	output: outputDir,
	per: "operation",
	groupBy: "tag",
	name(output) {
		if ("item" in output) {
			const item = output.item as { method: string; name?: string; path?: string };
			return slugify(`${item.method}-${item.path ?? item.name ?? "endpoint"}`);
		}

		return "api";
	},
	slugify,
	meta: {
		folderStyle: "folder",
	},
});

await mkdir(resolve(docsRoot, "content/api"), { recursive: true });
await writeFile(
	resolve(docsRoot, "content/api/meta.json"),
	`${JSON.stringify(
		{
			title: "API Reference",
			pages: ["index", "endpoints"],
		},
		null,
		"\t",
	)}\n`,
	"utf8",
);
