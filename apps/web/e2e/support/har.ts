import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const EXTERNALS = /api\.mapbox\.com|valhalla1\.openstreetmap\.de/;
const HERE = dirname(fileURLToPath(import.meta.url));

// Apply a HAR fixture for Mapbox/Valhalla intercepts. If the HAR file doesn't
// exist yet (first-time setup, or before `bun e2e:record`), fall through to
// the real network so tests can still run. See ADR-0017.
export async function applyHar(page: Page, harPath: string): Promise<void> {
	const absolute = resolve(HERE, "..", harPath);
	const recording = process.env.E2E_RECORD === "1";
	if (!recording && !existsSync(absolute)) {
		// No HAR yet — let requests pass through to real Mapbox/Valhalla.
		return;
	}
	await page.routeFromHAR(absolute, {
		url: EXTERNALS,
		update: recording,
		updateMode: "minimal",
	});
}
