import type { ApiRoute } from "@routess/api-client";
import { useMemo, useState } from "react";
import { buildMapboxStaticPreviewUrl } from "@/lib/utils/mapboxStaticPreview";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { RDS_COLORS } from "../../components/primitives";

// Only the fields the thumb reads, so geometry-only summaries (Discover)
// render the same preview as full library routes.
type ThumbRoute = Pick<ApiRoute, "id" | "geometry"> & { waypoints?: ApiRoute["waypoints"] };

function MiniRouteSvg({
	route,
	color,
	width,
	height,
}: {
	route: ThumbRoute;
	color: string;
	width: number;
	height: number;
}) {
	const PAD = 8;

	const projected = useMemo(() => {
		const coords: [number, number][] =
			route.geometry && route.geometry.length >= 2 ? route.geometry : (route.waypoints ?? []).map((w) => w.coord);
		if (coords.length < 2) return null;
		// Web Mercator y-projection so latitude bands at higher latitudes don't
		// look squashed; mini preview should resemble the real map shape.
		const projY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
		const xs = coords.map((c) => c[0]);
		const ys = coords.map((c) => projY(c[1]));
		const minX = Math.min(...xs);
		const maxX = Math.max(...xs);
		const minY = Math.min(...ys);
		const maxY = Math.max(...ys);
		const dX = Math.max(maxX - minX, 1e-9);
		const dY = Math.max(maxY - minY, 1e-9);
		const innerW = width - PAD * 2;
		const innerH = height - PAD * 2;
		const scale = Math.min(innerW / dX, innerH / dY);
		const drawnW = dX * scale;
		const drawnH = dY * scale;
		const offX = PAD + (innerW - drawnW) / 2;
		const offY = PAD + (innerH - drawnH) / 2;
		return coords.map(([lng, lat]) => {
			const x = offX + (lng - minX) * scale;
			const y = offY + drawnH - (projY(lat) - minY) * scale;
			return [Number(x.toFixed(2)), Number(y.toFixed(2))] as [number, number];
		});
	}, [route, width, height]);

	if (!projected) return null;
	const path = projected.map(([x, y]) => `${x},${y}`).join(" L ");
	const [fx, fy] = projected[0];
	const [lx, ly] = projected[projected.length - 1];
	const hasGeometry = (route.geometry?.length ?? 0) >= 2;

	return (
		<svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%" }} aria-hidden="true">
			<defs>
				<linearGradient id={`route-preview-${route.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stopColor="color-mix(in oklch, white 75%, transparent)" />
					<stop offset="100%" stopColor="color-mix(in oklch, white 25%, transparent)" />
				</linearGradient>
			</defs>
			<rect x="0" y="0" width={width} height={height} fill={`url(#route-preview-${route.id})`} />
			<path
				d={`M ${path}`}
				stroke={color}
				strokeWidth="5"
				strokeOpacity="0.18"
				fill="none"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d={`M ${path}`}
				stroke={color}
				strokeWidth={hasGeometry ? 2.2 : 1.6}
				strokeDasharray={hasGeometry ? undefined : "2 2"}
				fill="none"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<circle cx={fx} cy={fy} r="2.2" fill={RDS_COLORS.bgPanel} stroke={RDS_COLORS.success} strokeWidth="1.5" />
			<circle cx={lx} cy={ly} r="2.4" fill={RDS_COLORS.danger} />
		</svg>
	);
}

// Static Mapbox preview with an SVG fallback (no token, request failed, or
// geometry too sparse). Width/height are the rendered CSS size; the static
// image is requested at the same size with @2x retina.
export function RouteThumb({
	route,
	color = RDS_COLORS.accent,
	width,
	height,
}: {
	route: ThumbRoute;
	color?: string;
	width: number;
	height: number;
}) {
	const mapStyle = useRedesignSettingsStore((s) => s.mapStyle);
	const points = useMemo<[number, number][]>(() => {
		if (route.geometry && route.geometry.length >= 2) return route.geometry;
		return (route.waypoints ?? []).map((w) => w.coord);
	}, [route]);
	const staticUrl = useMemo(
		() =>
			buildMapboxStaticPreviewUrl(points, {
				width,
				height,
				mapStyle,
				strokeWidth: 3,
				showPins: false,
				padding: 12,
				maxPoints: 60,
			}),
		[points, mapStyle, width, height],
	);
	const [failedUrl, setFailedUrl] = useState<string | null>(null);
	const showStatic = staticUrl !== null && failedUrl !== staticUrl;

	if (showStatic && staticUrl) {
		return (
			<img
				src={staticUrl}
				alt=""
				loading="lazy"
				onError={() => setFailedUrl(staticUrl)}
				style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
			/>
		);
	}
	return <MiniRouteSvg route={route} color={color} width={width} height={height} />;
}
