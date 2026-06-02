import { Logger } from "@/lib/logger";
import { buildMapboxStaticPreviewUrl } from "@/lib/utils/mapboxStaticPreview";
import type { RedesignMapStyle } from "@/stores/redesignSettingsStore";

type Coordinate = [number, number];

export interface RouteShareCardInput {
	points: Coordinate[];
	mapStyle: RedesignMapStyle;
	distance: string | null;
	duration: string | null;
	elevationMeters: number | null;
}

const CARD_WIDTH = 1080;
const MAP_HEIGHT = 720;
const FOOTER_HEIGHT = 240;
const BRAND_PURPLE = "#6638cf";

function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		if (crossOrigin) img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = src;
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

/**
 * Render a shareable route card: the route on a map with a footer carrying the
 * distance/time/elevation stats and routess branding. Returns a PNG blob, or
 * null if there's nothing to render or the map image can't be fetched.
 */
export async function buildRouteShareCard(input: RouteShareCardInput): Promise<Blob | null> {
	const { points, mapStyle, distance, duration, elevationMeters } = input;
	if (points.length === 0) return null;

	const mapUrl = buildMapboxStaticPreviewUrl(points, {
		width: CARD_WIDTH / 2,
		height: MAP_HEIGHT / 2,
		mapStyle,
		retina: true,
		strokeWidth: 5,
		padding: 48,
		showPins: true,
	});
	if (!mapUrl) return null;

	const [mapImg, logoImg] = await Promise.all([loadImage(mapUrl, true), loadImage("/logo.png", false)]);
	if (!mapImg) {
		Logger.warn("[routeShareCard] Static map image failed to load (CORS or network)");
		return null;
	}

	// Make sure the brand font is ready so text doesn't fall back to a default.
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

	ctx.drawImage(mapImg, 0, 0, CARD_WIDTH, MAP_HEIGHT);

	// Footer
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, MAP_HEIGHT, CARD_WIDTH, FOOTER_HEIGHT);
	ctx.fillStyle = "rgba(0,0,0,0.07)";
	ctx.fillRect(0, MAP_HEIGHT, CARD_WIDTH, 2);

	const footerCenterY = MAP_HEIGHT + FOOTER_HEIGHT / 2;
	const pad = 56;

	// Branding: logo glyph + wordmark
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
	ctx.font = "700 60px Inter, system-ui, -apple-system, sans-serif";
	ctx.fillText("routess", wordmarkX, footerCenterY);

	// Stats (right-aligned)
	const rightX = CARD_WIDTH - pad;
	ctx.textAlign = "right";
	ctx.fillStyle = "#16161d";
	ctx.font = "700 64px Inter, system-ui, -apple-system, sans-serif";
	ctx.fillText(distance || "—", rightX, footerCenterY - 30);

	const sub: string[] = [];
	if (duration) sub.push(duration);
	if (elevationMeters != null && Number.isFinite(elevationMeters)) sub.push(`↑ ${Math.round(elevationMeters)} m`);
	if (sub.length > 0) {
		ctx.fillStyle = "#6b7280";
		ctx.font = "500 38px Inter, system-ui, -apple-system, sans-serif";
		ctx.fillText(sub.join("    ·    "), rightX, footerCenterY + 42);
	}

	return await new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}
