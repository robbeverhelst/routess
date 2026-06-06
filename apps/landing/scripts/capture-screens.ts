#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
/**
 * Regenerates every product image on the landing page from the REAL app:
 *
 *  1. hero-screenshot.png      — Playwright shot of the live planner seeded
 *                                with the Sint-Amands loop via a ?route= link
 *  2. app-panel.png            — element shot of the plan panel (elevation +
 *                                surface breakdown) from the same session
 *  3. previews/*.png           — Mapbox Static Images of real Directions
 *                                geometry for the library cards, the routegen
 *                                loop, and the MiniPlanner fallback
 *
 * Requires the web app dev server running (`bun dev` at the repo root) and a
 * Mapbox token (VITE_MAPBOX_ACCESS_TOKEN in env or the root .env).
 *
 * Run from the landing app: `bun run screenshots`
 * Point at a specific web server with WEB_URL=http://localhost:<port>
 */
import { deflateSync } from "node:zlib";
import {
	type DemoRoute,
	FOREST_WALK,
	ROUTEGEN_LOOP,
	SHARING_ROUTES,
	SINT_AMANDS_LOOP,
	toWaypoints,
} from "../lib/demo-routes";

const LANDING_DIR = resolve(import.meta.dir, "..");
const REPO_ROOT = resolve(LANDING_DIR, "..", "..");
const PUBLIC_DIR = resolve(LANDING_DIR, "public");
const PREVIEWS_DIR = resolve(PUBLIC_DIR, "previews");
const WEB_URL = process.env.WEB_URL ?? "http://localhost:5173";

// Matches the overlay colors in apps/web/src/lib/utils/mapboxStaticPreview.ts.
const ROUTE_COLOR = "7d62ff";
const START_COLOR = "22c55e";
const END_COLOR = "ef4444";
const STATIC_STYLE = "mapbox/outdoors-v12";

// Crop region for the styles-grid tiles, taken straight from the live app so
// every tile is the app's real style/theme (including the custom outdoors/
// satellite styles and the Standard night preset, none of which the Static
// API can render). The plan panel is collapsed first; the route is fitted to
// the map container (rail-edge to viewport-edge), so this clip centers on the
// container center and dodges the toolbar and route chip.
const MAP_TILE_CLIP = { x: 273, y: 112, width: 430, height: 348 };

// The Mapbox token is URL-restricted; server-side calls need a Referer from
// an allowed origin.
const MAPBOX_HEADERS = { Referer: "https://app.routess.com/" };

function log(msg: string) {
	process.stdout.write(`[capture-screens] ${msg}\n`);
}

function readToken(): string {
	const fromEnv = process.env.VITE_MAPBOX_ACCESS_TOKEN;
	if (fromEnv) return fromEnv;
	const envPath = resolve(REPO_ROOT, ".env");
	if (existsSync(envPath)) {
		for (const line of readFileSync(envPath, "utf8").split("\n")) {
			const match = line.match(/^VITE_MAPBOX_ACCESS_TOKEN=(.+)$/);
			if (match?.[1]) return match[1].trim().replace(/^["']|["']$/g, "");
		}
	}
	throw new Error("VITE_MAPBOX_ACCESS_TOKEN not found in env or repo-root .env");
}

// Same wire format as apps/web/src/lib/shareUtils.ts (v1).
function encodeShareRoute(route: DemoRoute): string {
	const json = JSON.stringify({ waypoints: toWaypoints(route.waypoints), locked: false });
	return deflateSync(json).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function fetchDirectionsGeometry(route: DemoRoute, token: string): Promise<[number, number][]> {
	const coords = route.waypoints.map(([lng, lat]) => `${lng},${lat}`).join(";");
	const url = `https://api.mapbox.com/directions/v5/mapbox/${route.profile}/${coords}?geometries=geojson&overview=full&access_token=${token}`;
	const res = await fetch(url, { headers: MAPBOX_HEADERS });
	if (!res.ok) throw new Error(`directions ${route.slug}: HTTP ${res.status}`);
	const data = (await res.json()) as { routes?: { geometry: { coordinates: [number, number][] } }[] };
	const geometry = data.routes?.[0]?.geometry.coordinates;
	if (!geometry || geometry.length < 2) throw new Error(`directions ${route.slug}: empty geometry`);
	return geometry;
}

function decimate(points: [number, number][], maxPoints: number): [number, number][] {
	if (points.length <= maxPoints) return points;
	const step = (points.length - 1) / (maxPoints - 1);
	return Array.from({ length: maxPoints }, (_, i) => points[Math.round(i * step)] as [number, number]);
}

function encodePolyline(points: [number, number][]): string {
	let lastLat = 0;
	let lastLng = 0;
	let out = "";
	const push = (value: number) => {
		let v = value < 0 ? ~(value << 1) : value << 1;
		while (v >= 0x20) {
			out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
			v >>= 5;
		}
		out += String.fromCharCode(v + 63);
	};
	for (const [lng, lat] of points) {
		const latE5 = Math.round(lat * 1e5);
		const lngE5 = Math.round(lng * 1e5);
		push(latE5 - lastLat);
		push(lngE5 - lastLng);
		lastLat = latE5;
		lastLng = lngE5;
	}
	return out;
}

interface StaticShot {
	route: DemoRoute;
	file: string;
	width: number;
	height: number;
	strokeWidth?: number;
	showPins?: boolean;
	style?: string;
}

async function downloadStaticPreview(shot: StaticShot, token: string): Promise<void> {
	const geometry = await fetchDirectionsGeometry(shot.route, token);
	const sampled = decimate(geometry, 100);
	const overlays = [`path-${shot.strokeWidth ?? 4}+${ROUTE_COLOR}-1(${encodeURIComponent(encodePolyline(sampled))})`];
	if (shot.showPins !== false) {
		const fmt = (n: number) => n.toFixed(5);
		const [startLng, startLat] = sampled[0] as [number, number];
		const [endLng, endLat] = sampled[sampled.length - 1] as [number, number];
		overlays.push(`pin-s+${START_COLOR}(${fmt(startLng)},${fmt(startLat)})`);
		overlays.push(`pin-s+${END_COLOR}(${fmt(endLng)},${fmt(endLat)})`);
	}
	const url = `https://api.mapbox.com/styles/v1/${shot.style ?? STATIC_STYLE}/static/${overlays.join(",")}/auto/${shot.width}x${shot.height}@2x?access_token=${token}&padding=40&logo=false&attribution=false`;
	const res = await fetch(url, { headers: MAPBOX_HEADERS });
	if (!res.ok) throw new Error(`static ${shot.file}: HTTP ${res.status} ${await res.text()}`);
	writeFileSync(resolve(PREVIEWS_DIR, shot.file), new Uint8Array(await res.arrayBuffer()));
	log(`wrote previews/${shot.file}`);
}

async function captureAppShots(): Promise<void> {
	const probe = await fetch(WEB_URL).catch(() => null);
	if (!probe?.ok) {
		throw new Error(
			`web app not reachable at ${WEB_URL} — start it with \`bun dev\` (repo root) or set WEB_URL=http://localhost:<port>`,
		);
	}

	const { chromium } = await import("playwright");
	// Icon buttons expose their label via aria-label (styled tooltips, no
	// native title attribute).
	const byLabel = (label: string) => `[aria-label="${label}"], [title="${label}"]`;
	const browser = await chromium.launch();
	try {
		const ctx = await browser.newContext({
			viewport: { width: 920, height: 560 },
			deviceScaleFactor: 2,
		});
		await ctx.addInitScript(() => {
			// Guest session — keeps captures deterministic, no login wall.
			localStorage.setItem("routess.skippedAuth", "1");
		});
		const page = await ctx.newPage();

		const loadPlanner = async (route: DemoRoute) => {
			await page.goto(`${WEB_URL}/?route=${encodeShareRoute(route)}`, { waitUntil: "domcontentloaded" });
			await page.waitForSelector(".mapboxgl-canvas", { timeout: 30_000 });
			// The route chip renders real numbers once routing resolves.
			await page.waitForFunction(() => /\d+(\.\d+)?\s?km/.test(document.body.textContent ?? ""), undefined, {
				timeout: 60_000,
			});
			// Elevation + surface analysis finish later; wait for the elevation-gain
			// number and the surface skeleton to clear so the panel is complete.
			await page
				.waitForFunction(
					() => {
						const text = document.body.textContent ?? "";
						return !/analyzing/i.test(text) && /\d+\s?m\b/.test(text);
					},
					undefined,
					{ timeout: 60_000 },
				)
				.catch(() => log(`WARN: elevation/surface did not settle for ${route.slug}, capturing anyway`));
			await page.evaluate(() => document.fonts?.ready);
			// Let map tiles, terrain and the route line settle.
			await page.waitForTimeout(8_000);
		};

		await loadPlanner(SINT_AMANDS_LOOP);
		await page.screenshot({ path: resolve(PUBLIC_DIR, "hero-screenshot.png") });
		log("wrote hero-screenshot.png");

		// Styles grid: crop the live map per style/theme. Dark is shot on the
		// default streets style right after light, before any style switches.
		await page.locator(byLabel("Collapse panel")).click();
		const tile = async (file: string) => {
			await page.waitForTimeout(12_000); // style/theme swap + tile fetch
			await page.screenshot({ path: resolve(PREVIEWS_DIR, file), clip: MAP_TILE_CLIP });
			log(`wrote previews/${file}`);
		};
		// Click through the layer picker, then verify against the persisted
		// setting; a switch right after a theme/style reload can get swallowed.
		const pickStyle = async (label: string, key: string) => {
			for (let attempt = 0; attempt < 3; attempt++) {
				await page.locator(byLabel("Map style")).click();
				await page.getByRole("button", { name: label }).first().click();
				await page.waitForTimeout(800);
				await page.locator(byLabel("Close")).first().click();
				const applied = await page.evaluate(
					(k) => (localStorage.getItem("routess.redesign.settings") ?? "").includes(`"mapStyle":"${k}"`),
					key,
				);
				if (applied) return;
				log(`WARN: style ${key} not applied, retrying`);
				await page.waitForTimeout(1_500);
			}
			throw new Error(`could not switch map style to ${key}`);
		};
		// The app's default style is outdoors, so shoot that first, then the
		// dark theme on it, then switch to the others.
		await tile("style-outdoors.png");
		await page.locator(byLabel("Toggle theme")).click();
		await tile("style-dark.png");
		await page.locator(byLabel("Toggle theme")).click();
		await page.waitForTimeout(3_000);
		await pickStyle("Streets", "streets");
		await tile("style-streets.png");
		await pickStyle("Satellite", "satellite");
		await tile("style-satellite.png");

		// The collapsed state persists, so re-expand the plan panel via the
		// rail toggle before the next capture.
		await page.locator(byLabel("Plan")).first().click();
		await page.waitForTimeout(1_000);

		// The surface section shows the plan panel of a forest walk, where the
		// breakdown actually has paved/gravel/path variety. Share links don't
		// carry the activity, so switch to Walk in the UI and let it re-route.
		await loadPlanner(FOREST_WALK);
		await page.getByRole("button", { name: "Walk" }).first().click();
		await page
			.waitForFunction(() => !/analyzing/i.test(document.body.textContent ?? ""), undefined, { timeout: 30_000 })
			.catch(() => log("WARN: walk re-route did not settle, capturing anyway"));
		await page.waitForTimeout(6_000);
		const panel = page.locator("aside").first();
		if (await panel.isVisible()) {
			await panel.screenshot({ path: resolve(PUBLIC_DIR, "app-panel.png") });
			log("wrote app-panel.png");
		} else {
			log("WARN: plan panel not visible, skipped app-panel.png");
		}

		// Mobile layout for the "take it outside" section: same loop on a
		// phone-sized viewport (bottom tabs, route chip).
		const mobileCtx = await browser.newContext({
			viewport: { width: 390, height: 800 },
			deviceScaleFactor: 2,
			isMobile: true,
			hasTouch: true,
		});
		await mobileCtx.addInitScript(() => {
			localStorage.setItem("routess.skippedAuth", "1");
		});
		const mobilePage = await mobileCtx.newPage();
		await mobilePage.goto(`${WEB_URL}/?route=${encodeShareRoute(SINT_AMANDS_LOOP)}`, {
			waitUntil: "domcontentloaded",
		});
		await mobilePage.waitForSelector(".mapboxgl-canvas", { timeout: 30_000 });
		await mobilePage.waitForFunction(() => /\d+(\.\d+)?\s?km/.test(document.body.textContent ?? ""), undefined, {
			timeout: 60_000,
		});
		await mobilePage.waitForTimeout(8_000);
		await mobilePage.screenshot({ path: resolve(PUBLIC_DIR, "app-mobile.png") });
		log("wrote app-mobile.png");
	} finally {
		await browser.close();
	}
}

async function main() {
	const token = readToken();
	mkdirSync(PREVIEWS_DIR, { recursive: true });

	const only = process.argv[2]; // optional: "app" | "previews"

	if (only !== "app") {
		const shots: StaticShot[] = SHARING_ROUTES.map((route, i) => ({
			route,
			file: `route-${i + 1}.png`,
			width: 400,
			height: 168,
			strokeWidth: 3,
		}));
		shots.push({ route: ROUTEGEN_LOOP, file: "routegen-loop.png", width: 640, height: 280 });
		shots.push({
			route: SINT_AMANDS_LOOP,
			file: "mini-planner-fallback.png",
			width: 640,
			height: 420,
		});
		for (const shot of shots) {
			await downloadStaticPreview(shot, token);
		}
	}

	if (only !== "previews") {
		await captureAppShots();
	}

	log("done");
}

main().catch((err) => {
	process.stderr.write(`${err}\n`);
	process.exit(1);
});
