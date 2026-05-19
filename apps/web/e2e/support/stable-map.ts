import type { Page } from "@playwright/test";

// Pin the Mapbox map to a known center/zoom so pixel-click tests in the
// input-layer specs (see ADR-0019) have deterministic targets. Only used by
// `apps/web/e2e/input-layer/*.spec.ts`; flow tests use the imperative editor
// handle and don't need pinning.

export const STABLE_CENTER = { lng: 4.4025, lat: 51.2194 } as const; // Antwerp
export const STABLE_ZOOM = 14;

export async function gotoStableMap(page: Page): Promise<void> {
	await page.goto("/");
	// Wait for the canvas + bridge to be ready. The bridge dispatches
	// `routess:e2e-ready` once the editor is captured.
	await page.locator("canvas.mapboxgl-canvas").waitFor({ state: "visible", timeout: 30_000 });
	await page.waitForFunction(() => typeof window.__routess !== "undefined", undefined, { timeout: 30_000 });
	await page.evaluate(
		([lng, lat, zoom]) => {
			// flyTo with duration=0 jumps without animation. Cast through unknown
			// because the editor's underlying map handle is not on the public surface.
			const api = window.__routess as unknown as { editor: { _map?: unknown } };
			const map = (api.editor as unknown as { map?: { jumpTo: (o: object) => void } }).map;
			map?.jumpTo({ center: [lng, lat], zoom });
		},
		[STABLE_CENTER.lng, STABLE_CENTER.lat, STABLE_ZOOM] as const,
	);
}

export async function clickAtMapPixel(page: Page, dx: number, dy: number): Promise<void> {
	const canvas = page.locator("canvas.mapboxgl-canvas");
	const box = await canvas.boundingBox();
	if (!box) throw new Error("Map canvas has no bounding box");
	await page.mouse.click(box.x + dx, box.y + dy);
}
