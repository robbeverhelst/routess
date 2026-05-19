import type { Page } from "@playwright/test";

// Mirror of E2ETestApi from src/test-support/E2ETestApiBridge.tsx. Kept inline
// to keep e2e/ from importing through the src tree (which would drag in the
// whole app's type graph). Drift between this and the real bridge surfaces
// the moment a test runs against the running app, so review is enough.
interface E2ETestApi {
	editor: {
		addWaypoint: (coord: [number, number], type?: "routed" | "direct") => Promise<unknown>;
		removeWaypoint: (index: number) => Promise<unknown>;
		moveWaypoint: (index: number, coord: [number, number]) => Promise<unknown>;
		reverse: () => Promise<unknown>;
		reset: () => Promise<unknown>;
		undo: () => Promise<unknown>;
		redo: () => Promise<unknown>;
		buildShareUrl: () => { success: boolean; url?: string };
	};
	getRouteDraft: () => {
		waypoints: Array<{ coord: [number, number]; type: "routed" | "direct" }>;
		hasRoute: boolean;
		distanceMeters: number | null;
		durationSeconds: number | null;
		elevationGain: number | null;
	};
	waitForRouteCalculated: (timeoutMs?: number) => Promise<void>;
	isReady: () => boolean;
}

declare global {
	interface Window {
		__routess?: E2ETestApi;
	}
}

// Type-safe Playwright wrappers around `window.__routess`. The bridge is only
// mounted when VITE_E2E === "true" (see ADR-0019); these helpers all wait for
// `window.__routess` to be defined before invoking it.

export async function waitForBridge(page: Page, timeoutMs = 60_000): Promise<void> {
	await page.waitForFunction(() => typeof window.__routess !== "undefined", undefined, { timeout: timeoutMs });
}

export async function addWaypoint(page: Page, lng: number, lat: number, type: "routed" | "direct" = "routed") {
	await waitForBridge(page);
	return page.evaluate(
		([lngArg, latArg, t]) => {
			const api = window.__routess;
			if (!api) throw new Error("__routess bridge not present");
			return api.editor.addWaypoint([lngArg as number, latArg as number], t as "routed" | "direct");
		},
		[lng, lat, type] as const,
	);
}

export async function getRouteDraft(page: Page) {
	await waitForBridge(page);
	return page.evaluate(() => {
		const api = window.__routess;
		if (!api) throw new Error("__routess bridge not present");
		const s = api.getRouteDraft();
		return {
			waypointCount: s.waypoints.length,
			waypoints: s.waypoints.map((w) => ({ coord: w.coord, type: w.type })),
			hasRoute: s.hasRoute,
			distanceMeters: s.distanceMeters,
			durationSeconds: s.durationSeconds,
			elevationGain: s.elevationGain,
		};
	});
}

export async function waitForRouteCalculated(page: Page, timeoutMs = 15_000): Promise<void> {
	await waitForBridge(page);
	await page.evaluate((t) => {
		const api = window.__routess as E2ETestApi | undefined;
		if (!api) throw new Error("__routess bridge not present");
		return api.waitForRouteCalculated(t);
	}, timeoutMs);
}

export async function reset(page: Page) {
	await waitForBridge(page);
	return page.evaluate(() => {
		const api = window.__routess;
		if (!api) throw new Error("__routess bridge not present");
		return api.editor.reset();
	});
}
