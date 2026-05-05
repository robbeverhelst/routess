import type { SurfaceBreakdown, SurfaceBucket } from "@/features/routing/services/SurfaceService";
import { RDS_COLORS, SecTitle } from "./primitives";

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

const BUCKETS: SurfaceBucket[] = ["paved", "compacted", "unpaved", "path"];

interface Props {
	breakdown: SurfaceBreakdown | null;
	loading: boolean;
}

export function SurfaceBreakdownBar({ breakdown, loading }: Props) {
	if (!breakdown && !loading) return null;

	const total = breakdown?.total ?? 0;
	const segments = BUCKETS.map((bucket) => {
		const meters = breakdown?.meters[bucket] ?? 0;
		const pct = total > 0 ? (meters / total) * 100 : 0;
		return { bucket, meters, pct };
	}).filter((s) => s.pct > 0);

	return (
		<div style={{ marginTop: 14 }}>
			<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
				<SecTitle>Surface</SecTitle>
				{loading && <span style={{ fontSize: 10.5, color: RDS_COLORS.fgSubtle }}>updating…</span>}
			</div>
			<div
				style={{
					display: "flex",
					height: 8,
					borderRadius: 999,
					overflow: "hidden",
					background: RDS_COLORS.bgInput,
					border: `1px solid ${RDS_COLORS.border}`,
					opacity: loading && !breakdown ? 0.5 : 1,
				}}
			>
				{segments.map((s) => (
					<div
						key={s.bucket}
						title={`${BUCKET_LABEL[s.bucket]} · ${s.pct.toFixed(1)}%`}
						style={{
							width: `${s.pct}%`,
							background: BUCKET_COLOR[s.bucket],
						}}
					/>
				))}
			</div>
			<div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 8 }}>
				{segments.map((s) => (
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
		</div>
	);
}
