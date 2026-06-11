#!/usr/bin/env bun
/**
 * Capture the user-guide screenshots with a headless browser. Outputs to
 * public/guide/. Two passes, selected with GUIDE_SCREENSHOT_PASS:
 *   - "anon": anonymous planner, map, and mobile flows (works against prod).
 *   - "auth": signed-in library, social, and account flows. Needs a seeded
 *     local stack — run seed-screenshot-data.ts first and point
 *     GUIDE_SCREENSHOT_URL at the local web server.
 *   - "all" (default): both.
 *
 * Run from apps/docs: `bun run guide:screenshots`
 * Override the target with GUIDE_SCREENSHOT_URL (e.g. a local dev server).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import type { Page } from "playwright";
import sharp from "sharp";

const APP_URL = process.env.GUIDE_SCREENSHOT_URL ?? "https://app.routess.com";
const OUT_DIR = resolve(import.meta.dirname, "..", "public", "guide");
const VIEWPORT = { width: 1440, height: 900 };
// Which passes to run: "all" (default), "anon" (anonymous planner/map/mobile),
// or "auth" (signed-in library/social/account). The authenticated pass needs a
// seeded local stack (see seed-screenshot-data.ts) and is skipped in production.
const PASS = process.env.GUIDE_SCREENSHOT_PASS ?? "all";
const RUN_ANON = PASS === "all" || PASS === "anon";
const RUN_AUTH = PASS === "all" || PASS === "auth";
// Seeded hero account, shared with seed-screenshot-data.ts. Local accounts only.
const HERO_EMAIL = process.env.GUIDE_SCREENSHOT_EMAIL ?? "alex.rivera@routess.dev";
const HERO_PASSWORD = process.env.GUIDE_SCREENSHOT_PASSWORD ?? "ghent-canals-gravel-2026";
const HERO_HANDLE = process.env.GUIDE_SCREENSHOT_HANDLE ?? "alex-rivera";
// Docs content renders at ~720px, so 1440px sources are 2x-retina sharp.
const MAX_WIDTH = 1440;
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
	const path = resolve(OUT_DIR, `${name}.jpg`);
	await shot(page, `${name}.jpg`, { path, type: "jpeg", quality: 88 });
	const optimized = await sharp(path)
		.resize({ width: MAX_WIDTH, withoutEnlargement: true })
		.jpeg({ quality: 80, mozjpeg: true })
		.toBuffer();
	await writeFile(path, optimized);
}

async function clipShot(page: Page, name: string, clip: { x: number; y: number; width: number; height: number }) {
	await shot(page, `${name}.png`, { path: resolve(OUT_DIR, `${name}.png`), clip });
}

// The headless map renders through software WebGL, which starves Playwright's
// rAF-based locator polling. Poll and click at the DOM level instead.
// Icon-only plan-panel buttons carry no title/aria-label in older builds, so
// callers can pass a lucide icon name as a fallback selector.
const buttonSelector = (title: string, icon?: string) =>
	`button[title="${title}"], button[aria-label="${title}"]${icon ? `, button:has(svg[class*="lucide-${icon}"])` : ""}`;

async function poll(predicate: () => Promise<boolean>, timeout: number) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (await predicate().catch(() => false)) return true;
		await sleep(500);
	}
	return false;
}

async function waitForButton(page: Page, title: string, icon?: string, timeout = 30_000) {
	const found = await poll(
		() => page.evaluate((sel) => document.querySelector(sel) !== null, buttonSelector(title, icon)),
		timeout,
	);
	if (!found) {
		await page.screenshot({ path: `/tmp/guide-fail-${title.replaceAll(/\W+/g, "-")}.png`, timeout: 60_000 });
		throw new Error(`button not found: ${title}`);
	}
}

async function clickButton(page: Page, title: string, icon?: string) {
	await waitForButton(page, title, icon);
	await page.evaluate((sel) => (document.querySelector(sel) as HTMLButtonElement).click(), buttonSelector(title, icon));
}

async function clickByText(page: Page, text: string) {
	await page
		.evaluate((needle) => {
			const candidates = [...document.querySelectorAll<HTMLElement>("button, [role=button]")];
			candidates.find((el) => el.textContent?.includes(needle))?.click();
		}, text)
		.catch(() => undefined);
}

// Click the smallest element containing the text. Unlike clickByText this is
// not limited to buttons, so it works for cards (a plain div with onClick); the
// click bubbles up to the card's handler.
async function clickText(page: Page, text: string) {
	await page.evaluate((needle) => {
		const matches = [...document.querySelectorAll<HTMLElement>("*")].filter((el) => el.textContent?.includes(needle));
		matches.sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0));
		matches[0]?.click();
	}, text);
}

// Scroll the element whose text matches into view (overlay screens have their
// own scroll container, so window.scrollTo won't reach them).
async function scrollToText(page: Page, text: string) {
	await page.evaluate((needle) => {
		const el = [...document.querySelectorAll<HTMLElement>("*")].find(
			(e) => e.children.length === 0 && e.textContent?.trim() === needle,
		);
		el?.scrollIntoView({ block: "center" });
	}, text);
}

// React controls the auth inputs, so set the value through the native setter
// and fire input/change, the way a real keystroke would, or React won't see it.
async function fillInput(page: Page, selector: string, value: string) {
	await page.evaluate(
		({ selector, value }) => {
			const el = document.querySelector(selector) as HTMLInputElement | null;
			if (!el) throw new Error(`input not found: ${selector}`);
			const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
			setter?.call(el, value);
			el.dispatchEvent(new Event("input", { bubbles: true }));
			el.dispatchEvent(new Event("change", { bubbles: true }));
		},
		{ selector, value },
	);
}

// Sign in the seeded hero account through the email form on the login screen.
async function signIn(page: Page) {
	await page.goto(APP_URL, { waitUntil: "load", timeout: 60_000 });
	await sleep(3000);
	await clickByText(page, "Sign in with email");
	await sleep(1200);
	await fillInput(page, 'input[autocomplete="email"]', HERO_EMAIL);
	await fillInput(page, 'input[autocomplete="current-password"]', HERO_PASSWORD);
	await page.evaluate(() => (document.querySelector('button[type="submit"]') as HTMLButtonElement | null)?.click());
	// Ready when the rail's Library button is mounted (planner is up).
	const ready = await poll(
		() => page.evaluate((sel) => document.querySelector(sel) !== null, buttonSelector("Library")),
		30_000,
	);
	if (!ready) {
		await page.screenshot({ path: "/tmp/guide-fail-signin.png", timeout: 60_000 });
		throw new Error("sign-in did not reach the planner");
	}
	await sleep(6000);
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

// The app frames cities and routes fairly tight; step one zoom level out so
// shots have breathing room instead of an awkward close crop.
async function zoomOutForFraming(page: Page) {
	await clickButton(page, "Zoom out");
	await sleep(3000);
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

	if (RUN_ANON) {
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
		await zoomOutForFraming(page);
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
		await zoomOutForFraming(page);
		await fullShot(page, "route-overview");

		// Sidebar with stats, elevation, and surface chart (56px rail + 360px panel).
		await clipShot(page, "route-info", { x: 0, y: 0, width: 420, height: VIEWPORT.height });

		// Waypoint list (endpoints, numbered waypoints, distances along the route).
		await clipShot(page, "editing-routes", { x: 56, y: 510, width: 364, height: 320 });

		// Share modal.
		await clickButton(page, "Share route", "share-2");
		await sleep(2500);
		await fullShot(page, "share-modal");
		await page.keyboard.press("Escape");
		await sleep(1000);

		// Routing preferences modal.
		await clickButton(page, "Routing preferences", "sliders");
		await sleep(2000);
		await fullShot(page, "routing-preferences");
		await page.keyboard.press("Escape");
		await sleep(1000);

		// Import modal.
		await clickButton(page, "Import GPX", "upload");
		await sleep(2000);
		await fullShot(page, "import-route");
		await page.keyboard.press("Escape");
		await sleep(1000);

		// Map style switcher. Escape does not dismiss the popover; use its
		// Close button.
		await clickButton(page, "Map style");
		await sleep(1500);
		await fullShot(page, "map-styles");
		await clickButton(page, "Close");
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
		await zoomOutForFraming(page);
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
		await zoomOutForFraming(geoPage);
		await fullShot(geoPage, "your-location");
		await geoCtx.close();

		// Pass 3: phone viewport, bottom tab bar and panel sheet.
		const mobileCtx = await browser.newContext({
			viewport: { width: 390, height: 844 },
			deviceScaleFactor: 2,
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
		await zoomOutForFraming(mobilePage);
		await fullShot(mobilePage, "mobile-planner");

		// Open the plan sheet via the bottom tab bar.
		await clickByText(mobilePage, "Plan");
		await sleep(2500);
		await fullShot(mobilePage, "mobile-drawer");
		await mobileCtx.close();
	}

	if (RUN_AUTH) {
		// Pass 4: signed-in flows (library, social, account). Needs a seeded
		// local stack; the data lives only there, never in production.
		const authCtx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
		const ap = await authCtx.newPage();
		// Skip the first-run onboarding wizard for the seeded account.
		await ap.addInitScript(() => {
			try {
				localStorage.setItem("routess-redesign-ui", JSON.stringify({ state: { welcomeCompleted: true }, version: 4 }));
			} catch {
				// storage may be unavailable; the wizard is harmless if it shows
			}
		});
		await signIn(ap);

		// Frame the map on Ghent so Discover and the planner have content nearby.
		// fly-to is a direct app event, avoiding the flaky search-modal dance.
		await ap.evaluate(() =>
			window.dispatchEvent(
				new CustomEvent("routess:fly-to", { detail: { coordinates: [3.7174, 51.0543], zoom: 12.5 } }),
			),
		);
		await sleep(5000);

		// Library — Routes tab.
		await clickButton(ap, "Library");
		await sleep(4000);
		await fullShot(ap, "library");

		// Collections tab.
		await clickByText(ap, "Collections");
		await sleep(2500);
		await fullShot(ap, "collections");

		// Route detail panel — back to Routes, then open a route by name.
		await clickByText(ap, "Routes");
		await sleep(1500);
		await clickText(ap, "Ghent canals loop");
		await sleep(4000);
		await fullShot(ap, "route-details");

		// Discover — public routes in view.
		await clickButton(ap, "Discover");
		await sleep(6000);
		await fullShot(ap, "discover");

		// Social — feed tab.
		await clickButton(ap, "Social");
		await sleep(4000);
		await fullShot(ap, "feed");

		// Social — inbox tab.
		await clickByText(ap, "Inbox");
		await sleep(3000);
		await fullShot(ap, "inbox");

		// Notification center.
		await clickButton(ap, "Plan");
		await sleep(1500);
		await clickButton(ap, "Notifications");
		await sleep(2500);
		await fullShot(ap, "notifications");
		await clickButton(ap, "Close");
		await sleep(1000);

		// Loop generator panel.
		await clickButton(ap, "Generate a loop");
		await sleep(3000);
		await fullShot(ap, "generate-loop");
		await ap.keyboard.press("Escape");
		await sleep(1000);

		// Command palette (Cmd+K on the macOS capture host).
		await ap.keyboard.press("Meta+k");
		await sleep(2000);
		await fullShot(ap, "command-palette");
		await ap.keyboard.press("Escape");
		await sleep(1000);

		// Settings → Advanced → API tokens.
		await clickButton(ap, "Settings");
		await sleep(2000);
		await clickByText(ap, "Advanced");
		await sleep(2500);
		await fullShot(ap, "api-tokens");

		// User settings screen: sessions + security.
		await ap.evaluate(() => window.dispatchEvent(new CustomEvent("routess:open-user-settings")));
		await sleep(3500);
		await fullShot(ap, "account-security");

		// Delete-account confirmation (without confirming).
		await clickByText(ap, "Delete");
		await sleep(1500);
		await scrollToText(ap, "Danger zone");
		await sleep(800);
		await fullShot(ap, "delete-account");

		// Public profile page (a real route, so navigate to it last).
		await ap.goto(`${APP_URL}/u/${HERO_HANDLE}`, { waitUntil: "load", timeout: 60_000 });
		await sleep(5000);
		await fullShot(ap, "profile");
		await authCtx.close();
	}

	await browser.close();
	log("done");
}

main().catch((err) => {
	process.stderr.write(`${err}\n`);
	process.exit(1);
});
