import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { de } from "./translations/de";
import { fr } from "./translations/fr";
import { meta } from "./translations/meta";
import { nl } from "./translations/nl";
import type { Locale, Page } from "./translations/types";

const docsRoot = process.cwd();

const pages: Record<Locale, Page[]> = { nl, fr, de };

async function writeJson(path: string, value: unknown) {
	const output = resolve(docsRoot, "content/guide", path);
	await mkdir(dirname(output), { recursive: true });
	await writeFile(output, `${JSON.stringify(value, null, "\t")}\n`, "utf8");
}

async function writePage(locale: Locale, page: Page) {
	const output = resolve(docsRoot, "content/guide", locale, page.path);
	await mkdir(dirname(output), { recursive: true });
	await writeFile(output, page.content, "utf8");
}

for (const locale of Object.keys(pages) as Locale[]) {
	await writeJson(`${locale}/meta.json`, meta.root[locale]);
	await writeJson(`${locale}/getting-started/meta.json`, meta.gettingStarted[locale]);
	await writeJson(`${locale}/routes/meta.json`, meta.routes[locale]);
	await writeJson(`${locale}/map/meta.json`, meta.map[locale]);
	await writeJson(`${locale}/account/meta.json`, meta.account[locale]);

	for (const page of pages[locale]) {
		await writePage(locale, page);
	}
}
