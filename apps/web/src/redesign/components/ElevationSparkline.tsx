import type { ElevationProfilePoint } from "@routess/core";
import type { CSSProperties } from "react";
import { useUnits } from "../lib/units";
import { RDS_COLORS } from "./primitives";

const SPARKLINE_W = 300;
const SPARKLINE_H = 44;
const SPARKLINE_PAD_Y = 3;

interface ProfileSummary {
	line: string;
	area: string;
	minMeters: number;
	maxMeters: number;
	totalMeters: number;
}

const summarizeProfile = (profile: ElevationProfilePoint[]): ProfileSummary | null => {
	if (profile.length < 2) return null;
	const total = profile[profile.length - 1].distanceMeters;
	if (total <= 0) return null;

	let minE = Number.POSITIVE_INFINITY;
	let maxE = Number.NEGATIVE_INFINITY;
	for (const p of profile) {
		if (p.elevationMeters < minE) minE = p.elevationMeters;
		if (p.elevationMeters > maxE) maxE = p.elevationMeters;
	}
	// On flat-ish terrain spread the line through the middle of the chart so
	// it doesn't sit pinned to one edge.
	const range = maxE - minE > 0.5 ? maxE - minE : 1;
	const innerH = SPARKLINE_H - SPARKLINE_PAD_Y * 2;

	let line = "";
	for (let i = 0; i < profile.length; i++) {
		const p = profile[i];
		const x = (p.distanceMeters / total) * SPARKLINE_W;
		const y = SPARKLINE_PAD_Y + innerH - ((p.elevationMeters - minE) / range) * innerH;
		line += i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : ` L${x.toFixed(2)} ${y.toFixed(2)}`;
	}
	const area = `${line} L${SPARKLINE_W} ${SPARKLINE_H} L0 ${SPARKLINE_H} Z`;
	return { line, area, minMeters: minE, maxMeters: maxE, totalMeters: total };
};

interface ElevationSparklineProps {
	profile: ElevationProfilePoint[] | null | undefined;
	loading?: boolean;
	gradientId?: string;
	height?: number;
	style?: CSSProperties;
}

// Renders an elevation profile as a sparkline with min/max-elevation y-axis
// labels and 0 / total-distance x-axis labels. Pass a null/undefined profile
// to render an empty state (dashed mid-line, no labels). When `loading` is
// true with no profile yet, the panel is dimmed to signal a pending sample.
export function ElevationSparkline({
	profile,
	loading = false,
	gradientId = "rds-elev",
	height,
	style,
}: ElevationSparklineProps) {
	const summary = profile ? summarizeProfile(profile) : null;
	const dim = loading && !summary;
	const { formatDistance, formatElevation } = useUnits();

	const axisLabelStyle: CSSProperties = {
		position: "absolute",
		fontSize: 10,
		lineHeight: 1,
		color: RDS_COLORS.fgSubtle,
		fontVariantNumeric: "tabular-nums",
		pointerEvents: "none",
	};

	return (
		<div
			style={{
				position: "relative",
				background: RDS_COLORS.bgInput,
				borderRadius: 8,
				padding: "16px 8px 16px 38px",
				opacity: dim ? 0.6 : 1,
				...style,
			}}
		>
			<div style={{ position: "relative", height: height ?? 44 }}>
				<svg
					viewBox={`0 0 ${SPARKLINE_W} ${SPARKLINE_H}`}
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
							y1={SPARKLINE_H - SPARKLINE_PAD_Y}
							x2={SPARKLINE_W}
							y2={SPARKLINE_H - SPARKLINE_PAD_Y}
							stroke="var(--rds-accent)"
							strokeOpacity="0.25"
							strokeWidth="1"
							strokeDasharray="4 4"
						/>
					)}
				</svg>
			</div>

			{/* Y-axis: max at top of chart, min at bottom. */}
			<span style={{ ...axisLabelStyle, left: 6, top: 12, textAlign: "right", width: 26 }}>
				{summary ? formatElevation(summary.maxMeters) : ""}
			</span>
			<span style={{ ...axisLabelStyle, left: 6, bottom: 12, textAlign: "right", width: 26 }}>
				{summary ? formatElevation(summary.minMeters) : ""}
			</span>

			{/* X-axis: 0 at start, total distance at end. */}
			<span style={{ ...axisLabelStyle, left: 38, bottom: 2 }}>{summary ? "0" : ""}</span>
			<span style={{ ...axisLabelStyle, right: 8, bottom: 2 }}>
				{summary ? formatDistance(summary.totalMeters / 1000) : ""}
			</span>
		</div>
	);
}
