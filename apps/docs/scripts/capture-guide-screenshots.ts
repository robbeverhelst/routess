#!/usr/bin/env bun
/**
 * Capture the user-guide screenshots from the production app with a headless
 * browser. Outputs to public/guide/. Anonymous flows only; pages that need a
 * signed-in session (profile, account deletion) keep their placeholders.
 *
 * Run from apps/docs: `bun run guide:screenshots`
 * Override the target with GUIDE_SCREENSHOT_URL (e.g. a local dev server).
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import type { Page } from "playwright";

const APP_URL = process.env.GUIDE_SCREENSHOT_URL ?? "https://app.routess.com";
const OUT_DIR = resolve(import.meta.dirname, "..", "public", "guide");
const VIEWPORT = { width: 1440, height: 900 };
const GHENT = { latitude: 51.0543, longitude: 3.7174, accuracy: 25 };

// A scenic demo ride through Ghent: Citadelpark, up the Coupure canal, to the
// Gravensteen. Loaded via a ?route= share URL so the captured route is
// deterministic instead of depending on pixel-coordinate map clicks.
const DEMO_WAYPOINTS = [
	{ coord: [3.7166, 51.0397], type: "routed" },
	{ coord: [3.709, 51.048], type: "routed" },
	{ coord: [3.7209, 51.0577], type: "routed" },
];

function demoRouteUrl() {
	const data = JSON.stringify({ waypoints: DEMO_WAYPOINTS, locked: false });
	const encoded = deflateSync(Buffer.from(data))
		.toString("base64")
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
	return `${APP_URL}?route=${encoded}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function log(msg: string) {
	process.stdout.write(`[guide-screenshots] ${msg}\n`);
}

async function shot(page: Page, name: string, options: Parameters<Page["screenshot"]>[0]) {
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			await page.screenshot({ animations: "disabled", timeout: 60_000, ...options });
			log(`wrote ${name}`);
			return;
		} catch {
			log(`screenshot ${name} stalled, retrying (${attempt + 1})`);
			await sleep(3000);
		}
	}
	throw new Error(`could not capture ${name}`);
}

async function fullShot(page: Page, name: string) {
	await shot(page, `${name}.jpg`, { path: resolve(OUT_DIR, `${name}.jpg`), type: "jpeg", quality: 88 });
}

async function clipShot(page: Page, name: string, clip: { x: number; y: number; width: number; height: number }) {
	await shot(page, `${name}.png`, { path: resolve(OUT_DIR, `${name}.png`), clip });
}

// The headless map renders through software WebGL, which starves Playwright's
// rAF-based locator polling. Poll and click at the DOM level instead.
const buttonSelector = (title: string) => `button[title="${title}"], button[aria-label="${title}"]`;

async function poll(predicate: () => Promise<boolean>, timeout: number) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (await predicate().catch(() => false)) return true;
		await sleep(500);
	}
	return false;
}

async function waitForButton(page: Page, title: string, timeout = 30_000) {
	const found = await poll(
		() => page.evaluate((sel) => document.querySelector(sel) !== null, buttonSelector(title)),
		timeout,
	);
	if (!found) {
		await page.screenshot({ path: `/tmp/guide-fail-${title.replaceAll(/\W+/g, "-")}.png`, timeout: 60_000 });
		throw new Error(`button not found: ${title}`);
	}
}

async function clickButton(page: Page, title: string) {
	await waitForButton(page, title);
	await page.evaluate((sel) => (document.querySelector(sel) as HTMLButtonElement).click(), buttonSelector(title));
}

async function clickByText(page: Page, text: string) {
	await page
		.evaluate((needle) => {
			const candidates = [...document.querySelectorAll<HTMLElement>("button, [role=button]")];
			candidates.find((el) => el.textContent?.includes(needle))?.click();
		}, text)
		.catch(() => undefined);
}

async function skipSignIn(page: Page) {
	for (let attempt = 0; attempt < 6; attempt++) {
		await clickByText(page, "Continue without an account");
		const ready = await poll(
			() => page.evaluate((sel) => document.querySelector(sel) !== null, buttonSelector("Search location")),
			10_000,
		);
		if (ready) {
			await sleep(6000);
			return;
		}
		log(`planner not ready, retrying (${attempt + 1})`);
	}
	throw new Error("could not enter the planner");
}

// The phone layout has no "Search location" toolbar button; the bottom tab
// bar's labels are the readiness signal instead.
async function skipSignInMobile(page: Page) {
	for (let attempt = 0; attempt < 6; attempt++) {
		await clickByText(page, "Continue without an account");
		const ready = await poll(
			() =>
				page.evaluate(() => {
					const text = document.body.textContent ?? "";
					return text.includes("Library") && text.includes("Discover");
				}),
			10_000,
		);
		if (ready) {
			await sleep(6000);
			return;
		}
		log(`mobile planner not ready, retrying (${attempt + 1})`);
	}
	throw new Error("could not enter the mobile planner");
}

async function waitForWelcome(page: Page, timeout = 60_000) {
	return poll(
		() => page.evaluate(() => document.body.textContent?.includes("Continue without an account") === true),
		timeout,
	);
}

async function enterPlanner(page: Page) {
	await page.goto(APP_URL, { waitUntil: "load", timeout: 60_000 });
	await sleep(2500);
	if (!(await waitForWelcome(page))) throw new Error("welcome screen not shown");
	await sleep(1500);
	await skipSignIn(page);
}

async function searchGhent(page: Page) {
	await clickButton(page, "Search location");
	await sleep(1200);
	await page.keyboard.type("Ghent", { delay: 60 });
	await sleep(2500);
}

async function main() {
	await mkdir(OUT_DIR, { recursive: true });
	const { chromium } = await import("playwright");
	const browser = await chromium.launch();

	// Pass 1: anonymous planner flows.
	const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
	const page = await ctx.newPage();

	await page.goto(APP_URL, { waitUntil: "load", timeout: 60_000 });
	if (!(await waitForWelcome(page))) throw new Error("welcome screen not shown");
	await sleep(2500);
	await fullShot(page, "welcome");

	await skipSignIn(page);

	await searchGhent(page);
	await fullShot(page, "search");
	await page.keyboard.press("Enter");
	await sleep(6000);
	await fullShot(page, "planner-empty");

	// Map toolbar (search, undo/redo, style, lock, zoom).
	await clipShot(page, "map-controls", { x: 490, y: 0, width: 520, height: 64 });

	// One click on the map: the first waypoint.
	await page.mouse.click(900, 420);
	await sleep(3000);
	await fullShot(page, "first-waypoint");

	// Load the demo route through its share URL and frame it.
	await page.goto(demoRouteUrl(), { waitUntil: "load", timeout: 60_000 });
	await sleep(4000);
	if (await waitForWelcome(page, 15_000)) await skipSignIn(page);
	await sleep(16_000);
	await clickButton(page, "Focus on route");
	await sleep(8000);
	await fullShot(page, "route-overview");

	// Sidebar with stats, elevation, and surface chart.
	await clipShot(page, "route-info", { x: 0, y: 0, width: 380, height: VIEWPORT.height });

	// Waypoint list with drag handles.
	await clipShot(page, "editing-routes", { x: 0, y: 465, width: 380, height: 310 });

	// Share modal.
	await clickButton(page, "Share route");
	await sleep(2500);
	await fullShot(page, "share-modal");
	await page.keyboard.press("Escape");
	await sleep(1000);

	// Routing preferences modal.
	await clickButton(page, "Routing preferences");
	await sleep(2000);
	await fullShot(page, "routing-preferences");
	await page.keyboard.press("Escape");
	await sleep(1000);

	// Import modal.
	await clickButton(page, "Import GPX");
	await sleep(2000);
	await fullShot(page, "import-route");
	await page.keyboard.press("Escape");
	await sleep(1000);

	// Map style switcher.
	await clickButton(page, "Map style");
	await sleep(1500);
	await fullShot(page, "map-styles");
	await page.keyboard.press("Escape");
	await sleep(1000);

	// Settings panel (language and defaults).
	await clickButton(page, "Settings");
	await sleep(2000);
	await fullShot(page, "settings");

	// Language lives under Settings → Map & display → Appearance.
	await clickByText(page, "Map & display");
	await sleep(2000);
	await fullShot(page, "language");
	// Same section also documents the display toggles.
	await fullShot(page, "map-display");
	await page.keyboard.press("Escape");
	await sleep(1000);

	// Route survives a refresh. The settings panel persists, switch back to Plan.
	await page.reload({ waitUntil: "load", timeout: 60_000 });
	await sleep(8000);
	if (await waitForWelcome(page, 20_000)) await skipSignIn(page);
	// The rail titles the active panel "X (toggle panel)"; Plan is inactive here.
	await clickButton(page, "Plan");
	await sleep(2500);
	await fullShot(page, "route-after-refresh");
	await ctx.close();

	// Pass 2: geolocation granted, center on me.
	const geoCtx = await browser.newContext({
		viewport: VIEWPORT,
		deviceScaleFactor: 2,
		geolocation: GHENT,
		permissions: ["geolocation"],
	});
	const geoPage = await geoCtx.newPage();
	await enterPlanner(geoPage);
	await clickButton(geoPage, "Center on me");
	await sleep(8000);
	await clickButton(geoPage, "Center on me");
	await sleep(8000);
	await fullShot(geoPage, "your-location");
	await geoCtx.close();

	// Pass 3: phone viewport, bottom tab bar and panel sheet.
	const mobileCtx = await browser.newContext({
		viewport: { width: 390, height: 844 },
		deviceScaleFactor: 3,
		isMobile: true,
		hasTouch: true,
		userAgent:
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
	});
	const mobilePage = await mobileCtx.newPage();
	await mobilePage.goto(demoRouteUrl(), { waitUntil: "load", timeout: 60_000 });
	await sleep(4000);
	if (await waitForWelcome(mobilePage, 15_000)) await skipSignInMobile(mobilePage);
	await sleep(16_000);
	await fullShot(mobilePage, "mobile-planner");

	// Open the plan sheet via the bottom tab bar.
	await clickByText(mobilePage, "Plan");
	await sleep(2500);
	await fullShot(mobilePage, "mobile-drawer");
	await mobileCtx.close();

	await browser.close();
	log("done");
}

main().catch((err) => {
	process.stderr.write(`${err}\n`);
	process.exit(1);
});
