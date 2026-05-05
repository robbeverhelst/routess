import type { RedesignMapStyle } from "@/redesign/stores/settingsStore";

type Coordinate = [number, number];

const ROUTE_COLOR = "7d62ff";
const START_COLOR = "22c55e";
const END_COLOR = "ef4444";

function decimatePoints(points: Coordinate[], maxPoints: number): Coordinate[] {
	if (points.length <= maxPoints) return points;
	const step = (points.length - 1) / (maxPoints - 1);
	const out: Coordinate[] = [];
	for (let i = 0; i < maxPoints; i++) {
		const idx = Math.round(i * step);
		out.push(points[idx]);
	}
	return out;
}

function encodePolyline(points: Coordinate[]): string {
	let lastLat = 0;
	let lastLng = 0;
	let result = "";
	const encodeValue = (value: number) => {
		let v = value < 0 ? ~(value << 1) : value << 1;
		while (v >= 0x20) {
			result += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
			v >>= 5;
		}
		result += String.fromCharCode(v + 63);
	};
	for (const [lng, lat] of points) {
		const latE5 = Math.round(lat * 1e5);
		const lngE5 = Math.round(lng * 1e5);
		encodeValue(latE5 - lastLat);
		encodeValue(lngE5 - lastLng);
		lastLat = latE5;
		lastLng = lngE5;
	}
	return result;
}

function getStaticStyleId(mapStyle: RedesignMapStyle): string {
	switch (mapStyle) {
		case "streets":
			return "streets-v12";
		case "satellite":
			return "satellite-streets-v12";
		default:
			return "outdoors-v12";
	}
}

export interface StaticPreviewOptions {
	width: number;
	height: number;
	mapStyle?: RedesignMapStyle;
	maxPoints?: number;
	strokeWidth?: number;
	showPins?: boolean;
	padding?: number;
	retina?: boolean;
}

export function buildMapboxStaticPreviewUrl(points: Coordinate[], options: StaticPreviewOptions): string | null {
	const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
	if (!token || points.length === 0) return null;

	const {
		width,
		height,
		mapStyle = "outdoors",
		maxPoints = 100,
		strokeWidth = 4,
		showPins = true,
		padding = 24,
		retina = true,
	} = options;

	const sampled = decimatePoints(points, maxPoints);
	const overlays: string[] = [];

	if (sampled.length >= 2) {
		const encoded = encodeURIComponent(encodePolyline(sampled));
		overlays.push(`path-${strokeWidth}+${ROUTE_COLOR}-1(${encoded})`);
	}

	if (showPins) {
		const fmt = (n: number) => n.toFixed(5);
		const [startLng, startLat] = sampled[0];
		overlays.push(`pin-s+${START_COLOR}(${fmt(startLng)},${fmt(startLat)})`);
		if (sampled.length >= 2) {
			const [endLng, endLat] = sampled[sampled.length - 1];
			overlays.push(`pin-s+${END_COLOR}(${fmt(endLng)},${fmt(endLat)})`);
		}
	}

	const styleId = getStaticStyleId(mapStyle);
	const retinaSuffix = retina ? "@2x" : "";
	return `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/${overlays.join(
		",",
	)}/auto/${width}x${height}${retinaSuffix}?access_token=${token}&padding=${padding}`;
}
