import type { ElevationProfilePoint } from "@routess/core";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useMemo, useRef } from "react";
import type { SurfaceBreakdown, SurfaceBucket } from "@/features/routing/services/SurfaceService";
import { useUnits } from "@/lib/units";
import { useRouteScrubStore } from "@/stores/routeScrubStore";
import { RDS_COLORS, SecTitle } from "./primitives";

const CHART_W = 300;
const CURVE_H = 56;
const STRIP_H = 8;
const STRIP_GAP = 6;
const CURVE_PAD_Y = 3;
const Y_AXIS_W = 22;
const Y_AXIS_GAP = 4;
// Below this much real elevation variation, the curve is plotted into a
// fixed-size visual window centred on the data. Keeps flat routes from
// looking like rollercoasters while still letting hilly routes scale up.
const MIN_VISUAL_RANGE_M = 30;
const CONTAINER_PAD_TOP = 12;

const BUCKET_ORDER: SurfaceBucket[] = ["paved", "compacted", "unpaved", "path"];

const BUCKET_LABEL: Record<SurfaceBucket, string> = {
	paved: "Paved",
	compacted: "Compacted",
	unpaved: "Unpaved",
	path: "Path",
};

const BUCKET_COLOR: Record<SurfaceBucket, string> = {
	paved: "oklch(0.45 0.02 240)",
	compacted: "oklch(0.72 0.07 75)",
	unpaved: "oklch(0.6 0.11 50)",
	path: "oklch(0.62 0.13 145)",
};

interface CurveSummary {
	line: string;
	area: string;
	minMeters: number;
	maxMeters: number;
	totalMeters: number;
}

const summarizeProfile = (profile: ElevationProfilePoint[]): CurveSummary | null => {
	if (profile.length < 2) return null;
	const total = profile[profile.length - 1].distanceMeters;
	if (total <= 0) return null;

	let minE = Number.POSITIVE_INFINITY;
	let maxE = Number.NEGATIVE_INFINITY;
	for (const p of profile) {
		if (p.elevationMeters < minE) minE = p.elevationMeters;
		if (p.elevationMeters > maxE) maxE = p.elevationMeters;
	}
	const actualRange = maxE - minE;
	const visualRange = Math.max(actualRange, MIN_VISUAL_RANGE_M);
	const displayMin = (minE + maxE) / 2 - visualRange / 2;
	const innerH = CURVE_H - CURVE_PAD_Y * 2;

	let line = "";
	for (let i = 0; i < profile.length; i++) {
		const p = profile[i];
		const x = (p.distanceMeters / total) * CHART_W;
		const y = CURVE_PAD_Y + innerH - ((p.elevationMeters - displayMin) / visualRange) * innerH;
		line += i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : ` L${x.toFixed(2)} ${y.toFixed(2)}`;
	}
	const area = `${line} L${CHART_W} ${CURVE_H} L0 ${CURVE_H} Z`;

	return { line, area, minMeters: minE, maxMeters: maxE, totalMeters: total };
};

const findElevationAt = (profile: ElevationProfilePoint[], distanceMeters: number): number | null => {
	if (profile.length === 0) return null;
	if (distanceMeters <= profile[0].distanceMeters) return profile[0].elevationMeters;
	const last = profile[profile.length - 1];
	if (distanceMeters >= last.distanceMeters) return last.elevationMeters;
	let lo = 0;
	let hi = profile.length - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (profile[mid].distanceMeters <= distanceMeters) lo = mid;
		else hi = mid;
	}
	return profile[lo].elevationMeters;
};

const findSurfaceAt = (breakdown: SurfaceBreakdown | null, distanceMeters: number): SurfaceBucket | null => {
	if (!breakdown) return null;
	for (const seg of breakdown.segments) {
		if (distanceMeters >= seg.distanceStartMeters && distanceMeters <= seg.distanceEndMeters) {
			return seg.surface;
		}
	}
	return null;
};

interface BucketShare {
	bucket: SurfaceBucket;
	pct: number;
}

const computeBucketShares = (breakdown: SurfaceBreakdown | null): BucketShare[] => {
	if (!breakdown || breakdown.total <= 0) return [];
	return BUCKET_ORDER.map((bucket) => ({
		bucket,
		pct: (breakdown.meters[bucket] / breakdown.total) * 100,
	})).filter((s) => s.pct > 0);
};

interface RouteProfileChartProps {
	profile: ElevationProfilePoint[] | null | undefined;
	breakdown: SurfaceBreakdown | null;
	elevationLoading?: boolean;
	surfaceLoading?: boolean;
	gradientId?: string;
	style?: CSSProperties;
}

export function RouteProfileChart({
	profile,
	breakdown,
	elevationLoading = false,
	surfaceLoading = false,
	gradientId = "rds-elev",
	style,
}: RouteProfileChartProps) {
	const summary = useMemo(() => (profile ? summarizeProfile(profile) : null), [profile]);
	const shares = useMemo(() => computeBucketShares(breakdown), [breakdown]);
	const { formatDistance, formatElevation } = useUnits();
	const setHover = useRouteScrubStore((s) => s.setHover);
	const clearHover = useRouteScrubStore((s) => s.clearHover);
	const hoveredDistanceMeters = useRouteScrubStore((s) => s.hoveredDistanceMeters);
	const containerRef = useRef<HTMLDivElement | null>(null);

	const totalMeters = summary?.totalMeters ?? 0;
	const hasProfile = summary !== null;
	const hasSurface = breakdown !== null && breakdown.total > 0;
	const dim = elevationLoading && !hasProfile;

	const handlePointerMove = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>) => {
			if (!hasProfile || totalMeters <= 0) return;
			const target = containerRef.current;
			if (!target) return;
			const rect = target.getBoundingClientRect();
			// Padding mirrors the container padding: left = Y_AXIS_W + Y_AXIS_GAP, right = 8.
			const innerLeft = rect.left + Y_AXIS_W + Y_AXIS_GAP;
			const innerWidth = Math.max(1, rect.width - Y_AXIS_W - Y_AXIS_GAP - 8);
			const ratio = Math.max(0, Math.min(1, (e.clientX - innerLeft) / innerWidth));
			setHover(ratio * totalMeters);
		},
		[hasProfile, setHover, totalMeters],
	);

	const handlePointerDown = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>) => {
			if (!hasProfile || totalMeters <= 0) return;
			e.currentTarget.setPointerCapture(e.pointerId);
			handlePointerMove(e);
		},
		[handlePointerMove, hasProfile, totalMeters],
	);

	const handlePointerUp = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>) => {
			if (e.currentTarget.hasPointerCapture(e.pointerId)) {
				e.currentTarget.releasePointerCapture(e.pointerId);
			}
			clearHover();
		},
		[clearHover],
	);

	const handlePointerLeave = useCallback(() => {
		clearHover();
	}, [clearHover]);

	const hoverIndicator = (() => {
		if (hoveredDistanceMeters == null || !summary || totalMeters <= 0) return null;
		const ratio = Math.max(0, Math.min(1, hoveredDistanceMeters / totalMeters));
		const elevation = profile ? findElevationAt(profile, hoveredDistanceMeters) : null;
		const surface = findSurfaceAt(breakdown, hoveredDistanceMeters);
		return { ratio, distanceMeters: hoveredDistanceMeters, elevation, surface };
	})();

	const stripBands = useMemo(() => {
		if (!hasSurface || !summary || totalMeters <= 0 || !breakdown) return null;
		return breakdown.segments
			.filter((s) => s.distanceEndMeters > s.distanceStartMeters)
			.map((s) => {
				const startPct = (s.distanceStartMeters / totalMeters) * 100;
				const widthPct = ((s.distanceEndMeters - s.distanceStartMeters) / totalMeters) * 100;
				return (
					<div
						key={`${s.surface}-${s.distanceStartMeters}`}
						style={{
							position: "absolute",
							top: 0,
							left: `${startPct}%`,
							width: `${widthPct}%`,
							height: "100%",
							background: BUCKET_COLOR[s.surface],
						}}
					/>
				);
			});
	}, [breakdown, hasSurface, summary, totalMeters]);

	const axisLabelStyle: CSSProperties = {
		position: "absolute",
		fontSize: 10,
		lineHeight: 1,
		color: RDS_COLORS.fgSubtle,
		fontVariantNumeric: "tabular-nums",
		pointerEvents: "none",
	};

	return (
		<div style={{ marginTop: 14, ...style }}>
			<div
				ref={containerRef}
				onPointerMove={handlePointerMove}
				onPointerDown={handlePointerDown}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
				onPointerLeave={handlePointerLeave}
				style={{
					position: "relative",
					background: RDS_COLORS.bgInput,
					borderRadius: 8,
					padding: `${CONTAINER_PAD_TOP}px 8px 16px ${Y_AXIS_W + Y_AXIS_GAP}px`,
					opacity: dim ? 0.6 : 1,
					touchAction: "none",
					cursor: hasProfile ? "crosshair" : "default",
				}}
			>
				{/* Elevation curve */}
				<div style={{ position: "relative", height: CURVE_H }}>
					<svg
						viewBox={`0 0 ${CHART_W} ${CURVE_H}`}
						preserveAspectRatio="none"
						style={{ width: "100%", height: "100%", display: "block" }}
						aria-hidden="true"
					>
						<defs>
							<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
								<stop offset="0" stopColor="var(--rds-accent)" stopOpacity="0.35" />
								<stop offset="1" stopColor="var(--rds-accent)" stopOpacity="0" />
							</linearGradient>
						</defs>
						{summary ? (
							<>
								<path d={summary.area} fill={`url(#${gradientId})`} />
								<path d={summary.line} stroke="var(--rds-accent)" strokeWidth="1.4" fill="none" />
							</>
						) : (
							<line
								x1="0"
								y1={CURVE_H - CURVE_PAD_Y}
								x2={CHART_W}
								y2={CURVE_H - CURVE_PAD_Y}
								stroke="var(--rds-accent)"
								strokeOpacity="0.25"
								strokeWidth="1"
								strokeDasharray="4 4"
							/>
						)}
					</svg>
				</div>

				{/* Surface strip */}
				<div
					style={{
						position: "relative",
						height: STRIP_H,
						marginTop: STRIP_GAP,
						borderRadius: 999,
						overflow: "hidden",
						background: hasSurface ? "transparent" : RDS_COLORS.borderStrong,
						border: `1px solid ${RDS_COLORS.border}`,
						opacity: surfaceLoading && !hasSurface ? 0.6 : 1,
					}}
				>
					{stripBands}
				</div>

				{/* Hover guideline */}
				{hoverIndicator && (
					<div
						style={{
							position: "absolute",
							top: CONTAINER_PAD_TOP,
							left: `calc(${Y_AXIS_W + Y_AXIS_GAP}px + (100% - ${Y_AXIS_W + Y_AXIS_GAP + 8}px) * ${hoverIndicator.ratio})`,
							width: 1,
							height: CURVE_H + STRIP_GAP + STRIP_H,
							background: RDS_COLORS.accent,
							opacity: 0.6,
							pointerEvents: "none",
						}}
					/>
				)}

				{/* Y-axis: max pinned to top of curve area, min pinned to bottom. The
				    curve uses a clamped visual range, so on flat routes the line sits
				    in the middle while the labels still mark the data extremes. */}
				<span style={{ ...axisLabelStyle, left: 2, top: CONTAINER_PAD_TOP, textAlign: "right", width: Y_AXIS_W }}>
					{summary ? formatElevation(summary.maxMeters) : ""}
				</span>
				<span
					style={{
						...axisLabelStyle,
						left: 2,
						top: CONTAINER_PAD_TOP + CURVE_H - 10,
						textAlign: "right",
						width: Y_AXIS_W,
					}}
				>
					{summary ? formatElevation(summary.minMeters) : ""}
				</span>

				{/* X-axis: 0 at start, total distance at end. */}
				<span style={{ ...axisLabelStyle, left: Y_AXIS_W + Y_AXIS_GAP, bottom: 2 }}>{summary ? "0" : ""}</span>
				<span style={{ ...axisLabelStyle, right: 8, bottom: 2 }}>
					{summary ? formatDistance(summary.totalMeters / 1000) : ""}
				</span>
			</div>

			{/* Tooltip */}
			{hoverIndicator && (
				<div
					style={{
						marginTop: 8,
						display: "flex",
						alignItems: "center",
						gap: 10,
						fontSize: 11.5,
						color: RDS_COLORS.fgMuted,
						minHeight: 16,
					}}
				>
					<span className="rds-mono">{formatDistance(hoverIndicator.distanceMeters / 1000)}</span>
					{hoverIndicator.elevation != null && (
						<>
							<span style={{ color: RDS_COLORS.fgSubtle }}>·</span>
							<span className="rds-mono">{formatElevation(hoverIndicator.elevation)}</span>
						</>
					)}
					{hoverIndicator.surface && (
						<>
							<span style={{ color: RDS_COLORS.fgSubtle }}>·</span>
							<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
								<span
									style={{
										width: 8,
										height: 8,
										borderRadius: 999,
										background: BUCKET_COLOR[hoverIndicator.surface],
										flexShrink: 0,
									}}
								/>
								{BUCKET_LABEL[hoverIndicator.surface]}
							</span>
						</>
					)}
				</div>
			)}

			{/* Legend / percentages */}
			{(hasSurface || surfaceLoading) && (
				<div style={{ marginTop: 10 }}>
					<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
						<SecTitle>Surface</SecTitle>
						{surfaceLoading && hasSurface && (
							<span style={{ fontSize: 10.5, color: RDS_COLORS.fgSubtle }}>updating…</span>
						)}
						{surfaceLoading && !hasSurface && (
							<span style={{ fontSize: 10.5, color: RDS_COLORS.fgSubtle }}>analyzing surface…</span>
						)}
					</div>
					{hasSurface ? (
						<div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px" }}>
							{shares.map((s) => (
								<div key={s.bucket} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
									<span
										style={{
											width: 8,
											height: 8,
											borderRadius: 999,
											background: BUCKET_COLOR[s.bucket],
											flexShrink: 0,
										}}
									/>
									<span style={{ fontSize: 11.5, color: RDS_COLORS.fgMuted }}>
										{BUCKET_LABEL[s.bucket]} <span className="rds-mono">{Math.round(s.pct)}%</span>
									</span>
								</div>
							))}
						</div>
					) : (
						!surfaceLoading && <span style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>Surface unavailable</span>
					)}
				</div>
			)}
		</div>
	);
}
