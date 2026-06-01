import { Logger } from "@/lib/logger";

export interface MapPalette {
	isDark: boolean;
	routeMain: string;
	routeCasing: string;
	routeHover: string;
	arrowFill: string;
	arrowHalo: string;
	waypointStart: string;
	waypointEnd: string;
	waypointDirect: string;
	waypointInter: string;
	waypointShadow: string;
	waypointStroke: string;
	kmText: string;
	kmHalo: string;
	userLocation: string;
	userLocationStroke: string;
	dragLine: string;
}

const FALLBACK: MapPalette = {
	isDark: false,
	routeMain: "rgb(102, 56, 207)",
	routeCasing: "rgba(0, 0, 0, 0.18)",
	routeHover: "rgb(140, 95, 230)",
	arrowFill: "rgb(255, 255, 255)",
	arrowHalo: "rgb(102, 56, 207)",
	waypointStart: "rgb(63, 154, 90)",
	waypointEnd: "rgb(204, 91, 56)",
	waypointDirect: "rgb(196, 154, 70)",
	waypointInter: "rgb(102, 56, 207)",
	waypointShadow: "rgba(0, 0, 0, 0.18)",
	waypointStroke: "rgb(255, 255, 255)",
	kmText: "rgb(70, 70, 80)",
	kmHalo: "rgba(255, 255, 255, 0.95)",
	// Location blue, kept off the accent so the puck stands apart from route/waypoints.
	userLocation: "rgb(28, 117, 230)",
	userLocationStroke: "rgb(255, 255, 255)",
	dragLine: "rgb(102, 56, 207)",
};

function getRedesignRoot(): HTMLElement | null {
	if (typeof document === "undefined") return null;
	return document.querySelector<HTMLElement>("[data-redesign]");
}

function isDarkMode(root: HTMLElement | null): boolean {
	if (!root) return false;
	return root.classList.contains("dark") || document.documentElement.classList.contains("dark");
}

// Modern browsers can return computed colors in their original color space
// (e.g. "oklch(...)"), which Mapbox GL's color parser does not understand.
// We rasterise a 1x1 pixel through canvas to coerce any CSS color string
// into an rgba() that Mapbox accepts.
const sharedCanvas: HTMLCanvasElement | null =
	typeof document === "undefined" ? null : document.createElement("canvas");
if (sharedCanvas) {
	sharedCanvas.width = 1;
	sharedCanvas.height = 1;
}
const sharedCtx = sharedCanvas?.getContext("2d", { willReadFrequently: true }) ?? null;

function rasterise(color: string): string {
	if (!sharedCtx) return color;
	sharedCtx.clearRect(0, 0, 1, 1);
	sharedCtx.fillStyle = "rgba(0, 0, 0, 0)";
	sharedCtx.fillStyle = color;
	sharedCtx.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = sharedCtx.getImageData(0, 0, 1, 1).data;
	return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

export function readMapPalette(): MapPalette {
	const root = getRedesignRoot();
	if (!root) return FALLBACK;
	const dark = isDarkMode(root);

	const probe = document.createElement("span");
	probe.style.position = "absolute";
	probe.style.visibility = "hidden";
	probe.style.pointerEvents = "none";
	probe.style.width = "0";
	probe.style.height = "0";
	root.appendChild(probe);

	const resolve = (cssValue: string): string => {
		probe.style.color = "rgb(0, 0, 0)";
		probe.style.color = cssValue;
		return rasterise(getComputedStyle(probe).color);
	};

	try {
		const accent = resolve("var(--rds-accent)");
		const accentSoft = resolve("var(--rds-accent-soft)");
		const panelBg = resolve("var(--rds-bg-panel)");
		const fg = resolve("var(--rds-fg)");

		const start = dark ? resolve("oklch(0.74 0.14 155)") : resolve("oklch(0.6 0.13 155)");
		const end = dark ? resolve("oklch(0.7 0.18 25)") : resolve("oklch(0.6 0.18 25)");
		const direct = dark ? resolve("oklch(0.78 0.13 80)") : resolve("oklch(0.68 0.13 80)");
		// Location blue, kept off the accent so the puck stands apart from route/waypoints.
		const userLoc = dark ? resolve("oklch(0.72 0.15 255)") : resolve("oklch(0.58 0.16 255)");

		const casing = dark ? resolve("oklch(1 0 0 / 0.22)") : resolve("oklch(0 0 0 / 0.18)");
		const shadow = dark ? resolve("oklch(0 0 0 / 0.55)") : resolve("oklch(0 0 0 / 0.18)");
		const kmHalo = dark ? "rgba(0, 0, 0, 0.7)" : "rgba(255, 255, 255, 0.95)";

		return {
			isDark: dark,
			routeMain: accent,
			routeCasing: casing,
			routeHover: accentSoft,
			arrowFill: panelBg,
			arrowHalo: accent,
			waypointStart: start,
			waypointEnd: end,
			waypointDirect: direct,
			waypointInter: accent,
			waypointShadow: shadow,
			waypointStroke: panelBg,
			kmText: fg,
			kmHalo,
			userLocation: userLoc,
			userLocationStroke: panelBg,
			dragLine: accent,
		};
	} catch (err) {
		Logger.warn("[mapPalette] Failed to resolve palette, using fallback", err);
		return FALLBACK;
	} finally {
		probe.remove();
	}
}

type Listener = (palette: MapPalette) => void;
const listeners = new Set<Listener>();
let observer: MutationObserver | null = null;

function ensureObserver(): void {
	if (observer || typeof window === "undefined") return;
	observer = new MutationObserver(() => {
		const palette = readMapPalette();
		for (const cb of listeners) cb(palette);
	});
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class", "data-accent", "data-redesign"],
		subtree: true,
	});
}

export function subscribeMapPalette(cb: Listener): () => void {
	ensureObserver();
	listeners.add(cb);
	return () => {
		listeners.delete(cb);
	};
}
