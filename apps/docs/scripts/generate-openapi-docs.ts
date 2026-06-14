import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { OpenAPIV3_2 } from "fumadocs-openapi";
import { generateFiles } from "fumadocs-openapi";
import { createOpenAPI } from "fumadocs-openapi/server";

const docsRoot = process.cwd();
const schemaPath = resolve(docsRoot, "openapi/routess.openapi.json");
// English is the generation target; the other locales get a verbatim mirror of
// the endpoint pages below (operation text comes from the OpenAPI spec and is
// English by construction). Authored files (index.mdx) are NOT touched here.
const outputDir = resolve(docsRoot, "content/api/en/endpoints");
const schema = JSON.parse(await readFile(schemaPath, "utf8")) as Record<string, unknown>;

const MIRROR_LOCALES = ["nl", "fr", "de"] as const;

const META_TITLES: Record<string, string> = {
	en: "API Reference",
	nl: "API-referentie",
	fr: "Référence API",
	de: "API-Referenz",
};

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
		input: {
			routess: schema as unknown as OpenAPIV3_2.Document,
		},
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

for (const locale of ["en", ...MIRROR_LOCALES]) {
	const localeDir = resolve(docsRoot, "content/api", locale);
	await mkdir(localeDir, { recursive: true });
	if (locale !== "en") {
		const mirrorDir = resolve(localeDir, "endpoints");
		await rm(mirrorDir, { force: true, recursive: true });
		await cp(outputDir, mirrorDir, { recursive: true });
	}
	await writeFile(
		resolve(localeDir, "meta.json"),
		`${JSON.stringify(
			{
				title: META_TITLES[locale] ?? META_TITLES.en,
				pages: ["index", "endpoints"],
			},
			null,
			"\t",
		)}\n`,
		"utf8",
	);
}
