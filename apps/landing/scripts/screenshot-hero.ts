#!/usr/bin/env bun
/**
 * Capture public/hero-screenshot.png by:
 *  1. starting `next dev` in background (or assuming one is already running)
 *  2. navigating to /_screenshot with playwright
 *  3. screenshotting #hero-screenshot-target at 2x device pixel ratio
 *
 * Run from the landing app: `bun run screenshot:hero`
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PORT = process.env.LANDING_PORT ?? "3002";
const TARGET_URL = `http://localhost:${PORT}/screenshot`;
const OUT = resolve(import.meta.dir, "..", "public", "hero-screenshot.png");

function log(msg: string) {
	process.stdout.write(`[hero-screenshot] ${msg}\n`);
}

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			if (res.ok) return;
		} catch {
			// server not up yet, retry
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	throw new Error(`server at ${url} not ready within ${timeoutMs}ms`);
}

async function main() {
	const probe = await fetch(TARGET_URL).catch(() => null);
	const reuseServer = probe?.ok === true;

	let serverProc: ReturnType<typeof spawn> | null = null;
	if (!reuseServer) {
		log("starting next dev...");
		serverProc = spawn("bun", ["run", "dev"], {
			cwd: resolve(import.meta.dir, ".."),
			env: { ...process.env, LANDING_PORT: PORT },
			stdio: ["ignore", "pipe", "pipe"],
		});
		serverProc.stdout?.on("data", (b) => process.stdout.write(`[next] ${b}`));
		serverProc.stderr?.on("data", (b) => process.stderr.write(`[next] ${b}`));
		await waitForServer(TARGET_URL);
	} else {
		log(`reusing running server at ${TARGET_URL}`);
	}

	try {
		const { chromium } = await import("playwright");
		const browser = await chromium.launch();
		const ctx = await browser.newContext({
			viewport: { width: 1000, height: 700 },
			deviceScaleFactor: 2,
		});
		const page = await ctx.newPage();
		await page.goto(TARGET_URL, { waitUntil: "networkidle" });
		const el = await page.waitForSelector("#hero-screenshot-target", { timeout: 5_000 });
		await page.evaluate(() => document.fonts?.ready);
		await new Promise((r) => setTimeout(r, 400));
		await el.screenshot({ path: OUT, omitBackground: true });
		await browser.close();
		log(`wrote ${OUT}`);
		if (!existsSync(OUT)) throw new Error("output file missing after screenshot");
	} finally {
		serverProc?.kill();
	}
}

main().catch((err) => {
	process.stderr.write(`${err}\n`);
	process.exit(1);
});
