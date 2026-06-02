import type { Waypoint } from "@routess/core";
import mapboxgl, { LngLatBounds } from "mapbox-gl";
import {
	initializeSourcesAndLayers,
	updateRouteLayer,
	updateRouteSurfaceLayer,
	updateWaypointsLayer,
} from "@/features/routing/managers/MapLayerManager";
import { readMapPalette } from "@/features/routing/managers/mapPalette";
import type { SurfaceSegment } from "@/features/routing/services/SurfaceService";
import { Logger } from "@/lib/logger";
import { getRuntimeConfig } from "@/lib/runtime-config";
import type { RedesignMapStyle } from "@/stores/redesignSettingsStore";

type Coordinate = [number, number];

// Keep in sync with the style variants in MapCanvas.
const STYLE_URLS: Record<RedesignMapStyle, string> = {
	streets: "mapbox://styles/mapbox/standard",
	outdoors: "mapbox://styles/robbeverhelst/cmosm4baj001j01s65hjz79cw",
	satellite: "mapbox://styles/robbeverhelst/cmosm5k7x000c01segxetckb9",
};

const CARD_WIDTH = 1080;
const MAP_HEIGHT = 720;
const FOOTER_HEIGHT = 240;
const BRAND_PURPLE = "#6638cf";

export interface RouteShareCardInput {
	points: Coordinate[];
	waypoints: Waypoint[];
	surfaceSegments: SurfaceSegment[];
	mapStyle: RedesignMapStyle;
	lightPreset: string;
	activityLabel: string | null;
	distance: string | null;
	duration: string | null;
	elevationMeters: number | null;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = src;
	});
}

function once(map: mapboxgl.Map, event: string, timeoutMs: number): Promise<void> {
	return new Promise((resolve) => {
		const timer = window.setTimeout(resolve, timeoutMs);
		map.once(event, () => {
			window.clearTimeout(timer);
			resolve();
		});
	});
}

function roundedClip(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, radius: number): void {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.arcTo(x + size, y, x + size, y + size, radius);
	ctx.arcTo(x + size, y + size, x, y + size, radius);
	ctx.arcTo(x, y + size, x, y, radius);
	ctx.arcTo(x, y, x + size, y, radius);
	ctx.closePath();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.arcTo(x + w, y, x + w, y + h, radius);
	ctx.arcTo(x + w, y + h, x, y + h, radius);
	ctx.arcTo(x, y + h, x, y, radius);
	ctx.arcTo(x, y, x + w, y, radius);
	ctx.closePath();
}

// Pill in the map's top-left corner showing the activity (e.g. Cycling).
function drawActivityBadge(ctx: CanvasRenderingContext2D, label: string): void {
	ctx.font = "600 34px Inter, system-ui, -apple-system, sans-serif";
	ctx.textAlign = "left";
	ctx.textBaseline = "middle";
	const padX = 28;
	const h = 62;
	const x = 28;
	const y = 28;
	const w = ctx.measureText(label).width + padX * 2;
	ctx.save();
	ctx.shadowColor = "rgba(0,0,0,0.18)";
	ctx.shadowBlur = 18;
	ctx.shadowOffsetY = 4;
	roundedRect(ctx, x, y, w, h, h / 2);
	ctx.fillStyle = "rgba(255,255,255,0.95)";
	ctx.fill();
	ctx.restore();
	ctx.fillStyle = "#16161d";
	ctx.fillText(label, x + padX, y + h / 2 + 1);
}

// Render the route on a throwaway offscreen Mapbox map, top-down and fit to the
// route, with the app's real route/arrow/surface layers, then grab its canvas.
// This matches the live map exactly (line style, direction arrows, paved vs
// unpaved) and carries no Mapbox attribution overlay.
async function renderRouteMap(input: RouteShareCardInput): Promise<HTMLCanvasElement | null> {
	const token = getRuntimeConfig("VITE_MAPBOX_ACCESS_TOKEN");
	if (!token || input.points.length === 0) return null;

	const container = document.createElement("div");
	container.style.cssText = `position:fixed;left:-10000px;top:0;width:${CARD_WIDTH}px;height:${MAP_HEIGHT}px;pointer-events:none;`;
	document.body.appendChild(container);

	const map = new mapboxgl.Map({
		container,
		accessToken: token,
		style: STYLE_URLS[input.mapStyle] ?? STYLE_URLS.outdoors,
		interactive: false,
		attributionControl: false,
		preserveDrawingBuffer: true,
		fadeDuration: 0,
		pitch: 0,
		bearing: 0,
		center: input.points[0],
		zoom: 9,
	});

	try {
		await once(map, "style.load", 12000);

		try {
			map.setConfigProperty("basemap", "lightPreset", input.lightPreset);
		} catch {
			// style may not support light presets
		}

		initializeSourcesAndLayers(map, readMapPalette());
		updateRouteLayer(map, input.points);
		updateRouteSurfaceLayer(map, input.surfaceSegments);
		// Only the start and end pins, not every intermediate waypoint.
		const endpoints =
			input.waypoints.length >= 2
				? [input.waypoints[0], input.waypoints[input.waypoints.length - 1]]
				: input.waypoints;
		updateWaypointsLayer(map, endpoints, false);

		const bounds = input.points.reduce(
			(acc, point) => acc.extend(point),
			new LngLatBounds(input.points[0], input.points[0]),
		);
		map.fitBounds(bounds, { padding: 72, animate: false, pitch: 0, bearing: 0 });

		await once(map, "idle", 9000);

		const gl = map.getCanvas();
		const out = document.createElement("canvas");
		out.width = gl.width;
		out.height = gl.height;
		const ctx = out.getContext("2d");
		if (!ctx) return null;
		ctx.drawImage(gl, 0, 0);
		return out;
	} catch (err) {
		Logger.warn("[routeShareCard] offscreen route render failed", err);
		return null;
	} finally {
		map.remove();
		container.remove();
	}
}

/**
 * Build a shareable route card PNG: the route rendered exactly as on the live
 * map (line style, arrows, paved/unpaved) with a footer carrying the routess
 * logo + wordmark and the distance / time / elevation stats.
 */
export async function buildRouteShareCard(input: RouteShareCardInput): Promise<Blob | null> {
	if (input.points.length === 0) return null;

	const [mapCanvas, logoImg] = await Promise.all([renderRouteMap(input), loadImage("/logo.png")]);
	if (!mapCanvas) return null;

	try {
		await document.fonts?.ready;
	} catch {
		// non-fatal
	}

	const canvas = document.createElement("canvas");
	canvas.width = CARD_WIDTH;
	canvas.height = MAP_HEIGHT + FOOTER_HEIGHT;
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;

	// Route map (downscale the high-DPI capture into the card's map area).
	ctx.drawImage(mapCanvas, 0, 0, mapCanvas.width, mapCanvas.height, 0, 0, CARD_WIDTH, MAP_HEIGHT);

	if (input.activityLabel) {
		drawActivityBadge(ctx, input.activityLabel);
	}

	// Footer
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, MAP_HEIGHT, CARD_WIDTH, FOOTER_HEIGHT);
	ctx.fillStyle = "rgba(0,0,0,0.07)";
	ctx.fillRect(0, MAP_HEIGHT, CARD_WIDTH, 2);

	const footerCenterY = MAP_HEIGHT + FOOTER_HEIGHT / 2;
	const pad = 56;

	let wordmarkX = pad;
	if (logoImg) {
		const logoSize = 96;
		const logoY = footerCenterY - logoSize / 2;
		ctx.save();
		roundedClip(ctx, pad, logoY, logoSize, 22);
		ctx.clip();
		ctx.drawImage(logoImg, pad, logoY, logoSize, logoSize);
		ctx.restore();
		wordmarkX = pad + logoSize + 26;
	}
	ctx.textBaseline = "middle";
	ctx.textAlign = "left";
	ctx.fillStyle = BRAND_PURPLE;
	ctx.font = "700 56px Inter, system-ui, -apple-system, sans-serif";
	ctx.fillText("routess", wordmarkX, footerCenterY - 20);
	ctx.fillStyle = "#9aa0ab";
	ctx.font = "500 30px Inter, system-ui, -apple-system, sans-serif";
	ctx.fillText("routess.com", wordmarkX, footerCenterY + 28);

	const rightX = CARD_WIDTH - pad;
	ctx.textAlign = "right";
	ctx.fillStyle = "#16161d";
	ctx.font = "700 64px Inter, system-ui, -apple-system, sans-serif";
	ctx.fillText(input.distance || "—", rightX, footerCenterY - 30);

	const sub: string[] = [];
	if (input.duration) sub.push(input.duration);
	if (input.elevationMeters != null && Number.isFinite(input.elevationMeters)) {
		sub.push(`↑ ${Math.round(input.elevationMeters)} m`);
	}
	if (sub.length > 0) {
		ctx.fillStyle = "#6b7280";
		ctx.font = "500 38px Inter, system-ui, -apple-system, sans-serif";
		ctx.fillText(sub.join("    ·    "), rightX, footerCenterY + 42);
	}

	return await new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
