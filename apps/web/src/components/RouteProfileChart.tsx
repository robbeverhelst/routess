import type { ElevationProfilePoint } from "@routess/core";
import { surfaceBucketColors } from "@routess/design-tokens";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useMemo, useRef } from "react";
import type { SurfaceBreakdown, SurfaceBucket } from "@/features/routing/services/SurfaceService";
import { useUnits } from "@/lib/units";
import { useRouteScrubStore } from "@/stores/routeScrubStore";
import { RDS_COLORS, SecTitle } from "./primitives";
import { Tooltip } from "./Tooltip";

const CHART_W = 300;
const CURVE_H = 56;
const STRIP_H = 8;
const STRIP_GAP = 6;
const CURVE_PAD_Y = 3;
const INNER_PAD_X = 10;
// Scale floors for the curve's vertical window. The grade floor keeps the
// on-screen steepness roughly proportional to real effort: a window is never
// smaller than 0.25% average grade over the route, so flat routes read as
// gently flat instead of being auto-scaled into mountains. The absolute floor
// stops sub-meter sampling noise from dominating short dead-flat routes.
const MIN_VISUAL_RANGE_M = 4;
const MIN_VISUAL_GRADE = 0.0025;
const CONTAINER_PAD_TOP = 12;

const BUCKET_ORDER: SurfaceBucket[] = ["paved", "compacted", "unpaved", "path"];

const BUCKET_LABEL: Record<SurfaceBucket, string> = {
	paved: "Paved",
	compacted: "Compacted",
	unpaved: "Unpaved",
	path: "Path",
};

const BUCKET_COLOR: Record<SurfaceBucket, string> = surfaceBucketColors;

interface CurveSummary {
	line: string;
	area: string;
	minMeters: number;
	maxMeters: number;
	totalMeters: number;
	// Pixel y (in curve space) for any elevation, so gridlines and the hover
	// dot share the exact transform the curve was plotted with.
	yFor: (elevationMeters: number) => number;
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
	// Headroom above (1.3) and a small offset below (8%) keep the curve and its
	// gridline labels inside the window, anchored to the data minimum.
	const visualRange = Math.max(actualRange * 1.3, MIN_VISUAL_RANGE_M, total * MIN_VISUAL_GRADE);
	const displayMin = minE - visualRange * 0.08;
	const innerH = CURVE_H - CURVE_PAD_Y * 2;

	const yFor = (e: number) => CURVE_PAD_Y + innerH - ((e - displayMin) / visualRange) * innerH;

	let line = "";
	for (let i = 0; i < profile.length; i++) {
		const p = profile[i];
		const x = (p.distanceMeters / total) * CHART_W;
		const y = yFor(p.elevationMeters);
		line += i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : ` L${x.toFixed(2)} ${y.toFixed(2)}`;
	}
	const area = `${line} L${CHART_W} ${CURVE_H} L0 ${CURVE_H} Z`;

	return { line, area, minMeters: minE, maxMeters: maxE, totalMeters: total, yFor };
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

// Elevation value pinned to its height on the curve: max sits above that
// height, min below, so the two can never collide on flat routes.
function GridLabel({ y, label, labelPos }: { y: number; label: string; labelPos: "above" | "below" }) {
	return (
		<span
			style={{
				position: "absolute",
				left: 0,
				top: labelPos === "above" ? y - 12 : y + 3,
				fontSize: 10,
				lineHeight: 1,
				color: RDS_COLORS.fgSubtle,
				fontVariantNumeric: "tabular-nums",
				pointerEvents: "none",
				zIndex: 1,
			}}
		>
			{label}
		</span>
	);
}

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
			// Mirrors the container's horizontal padding.
			const innerLeft = rect.left + INNER_PAD_X;
			const innerWidth = Math.max(1, rect.width - INNER_PAD_X * 2);
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

	const guidelineLeft = hoverIndicator
		? `calc(${INNER_PAD_X}px + (100% - ${INNER_PAD_X * 2}px) * ${hoverIndicator.ratio})`
		: undefined;

	const hoverDotY =
		hoverIndicator && hoverIndicator.elevation != null && summary ? summary.yFor(hoverIndicator.elevation) : null;

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
					padding: `${CONTAINER_PAD_TOP}px ${INNER_PAD_X}px 12px`,
					opacity: dim ? 0.6 : 1,
					touchAction: "none",
					cursor: hasProfile ? "crosshair" : "default",
				}}
			>
				{/* Elevation curve with min/max labels on the data extremes */}
				<div style={{ position: "relative", height: CURVE_H }}>
					{summary && (
						<>
							<GridLabel
								y={summary.yFor(summary.maxMeters)}
								label={formatElevation(summary.maxMeters)}
								labelPos="above"
							/>
							{summary.maxMeters !== summary.minMeters && (
								<GridLabel
									y={summary.yFor(summary.minMeters)}
									label={formatElevation(summary.minMeters)}
									labelPos="below"
								/>
							)}
						</>
					)}
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
								<path
									d={summary.line}
									stroke="var(--rds-accent)"
									strokeWidth="1.5"
									fill="none"
									vectorEffect="non-scaling-stroke"
								/>
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

				{/* Surface strip, flush with the curve's edges */}
				<div
					style={{
						position: "relative",
						height: STRIP_H,
						marginTop: STRIP_GAP,
						borderRadius: 4,
						overflow: "hidden",
						background: hasSurface ? "transparent" : RDS_COLORS.borderStrong,
						opacity: surfaceLoading && !hasSurface ? 0.6 : 1,
					}}
				>
					{stripBands}
				</div>

				{/* Crosshair: guideline through curve + strip, dot riding the curve */}
				{hoverIndicator && (
					<div
						style={{
							position: "absolute",
							top: CONTAINER_PAD_TOP,
							left: guidelineLeft,
							width: 1,
							height: CURVE_H + STRIP_GAP + STRIP_H,
							background: RDS_COLORS.accent,
							opacity: 0.5,
							pointerEvents: "none",
						}}
					/>
				)}
				{hoverIndicator && hoverDotY != null && (
					<div
						style={{
							position: "absolute",
							top: CONTAINER_PAD_TOP + hoverDotY - 3.5,
							left: guidelineLeft,
							width: 7,
							height: 7,
							borderRadius: 999,
							background: RDS_COLORS.accent,
							border: `1.5px solid ${RDS_COLORS.bgPanel}`,
							transform: "translateX(-50%)",
							pointerEvents: "none",
							zIndex: 2,
						}}
					/>
				)}
			</div>

			{/* Readout: always rendered at fixed height so hover never reflows.
			    Idle shows the distance range; hover shows values at the cursor. */}
			{summary && (
				<div
					style={{
						marginTop: 6,
						display: "flex",
						alignItems: "center",
						gap: 8,
						fontSize: 11,
						color: RDS_COLORS.fgMuted,
						height: 16,
						padding: `0 ${INNER_PAD_X}px`,
					}}
				>
					{hoverIndicator ? (
						<>
							<span className="rds-mono">{formatDistance(hoverIndicator.distanceMeters / 1000)}</span>
							{hoverIndicator.elevation != null && (
								<>
									<span style={{ color: RDS_COLORS.fgSubtle }} aria-hidden="true">
										·
									</span>
									<span className="rds-mono">{formatElevation(hoverIndicator.elevation)}</span>
								</>
							)}
							{hoverIndicator.surface && (
								<>
									<span style={{ color: RDS_COLORS.fgSubtle }} aria-hidden="true">
										·
									</span>
									<span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
										<span
											style={{
												width: 7,
												height: 7,
												borderRadius: 999,
												background: BUCKET_COLOR[hoverIndicator.surface],
												flexShrink: 0,
											}}
										/>
										{BUCKET_LABEL[hoverIndicator.surface]}
									</span>
								</>
							)}
						</>
					) : (
						<span className="rds-mono" style={{ color: RDS_COLORS.fgSubtle }}>
							0
						</span>
					)}
					<span style={{ flex: 1 }} />
					<span className="rds-mono" style={{ color: RDS_COLORS.fgSubtle }}>
						{formatDistance(summary.totalMeters / 1000)}
					</span>
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
						<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px" }}>
							{shares.map((s) => (
								<Tooltip
									key={s.bucket}
									label={`${BUCKET_LABEL[s.bucket]} · ${formatDistance((breakdown?.meters[s.bucket] ?? 0) / 1000)}`}
								>
									<div style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
										<span
											style={{
												width: 8,
												height: 8,
												borderRadius: 999,
												background: BUCKET_COLOR[s.bucket],
												flexShrink: 0,
											}}
										/>
										<span style={{ fontSize: 11, color: RDS_COLORS.fgMuted }}>
											{BUCKET_LABEL[s.bucket]} <span className="rds-mono">{Math.round(s.pct)}%</span>
										</span>
									</div>
								</Tooltip>
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
