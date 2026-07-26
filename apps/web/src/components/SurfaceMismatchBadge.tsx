import { isSurfaceMismatch, type SurfaceType, surfaceMismatchFraction } from "@routess/core";
import type { SurfaceBreakdown } from "@/features/routing/services/SurfaceService";
import { useT } from "@/lib/i18n";
import { I } from "./icons";
import { RDS_COLORS } from "./primitives";

interface Props {
	breakdown: SurfaceBreakdown | null;
	preference: SurfaceType | null | undefined;
}

// A1: shows a small warning when the surfacePreference visibly failed, per
// the per-preference SURFACE_MISMATCH_THRESHOLDS (paved routes tolerate far
// less gravel than unpaved rides tolerate connector tarmac). "mixed" is
// permissive and never produces a mismatch.
export function SurfaceMismatchBadge({ breakdown, preference }: Props) {
	const t = useT();
	if (!breakdown || !preference || preference === "mixed") return null;
	if (!isSurfaceMismatch(breakdown.meters, preference)) return null;

	const fraction = surfaceMismatchFraction(breakdown.meters, preference);
	const pct = Math.round(fraction * 100);

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "8px 10px",
				borderRadius: 8,
				background: `color-mix(in oklch, ${RDS_COLORS.warn} 14%, transparent)`,
				border: `1px solid color-mix(in oklch, ${RDS_COLORS.warn} 32%, transparent)`,
				color: RDS_COLORS.fg,
				fontSize: 12,
			}}
			role="status"
		>
			<I.alert size={14} style={{ color: RDS_COLORS.warn, flexShrink: 0 }} />
			<div style={{ flex: 1 }}>
				<div style={{ fontWeight: 500 }}>
					{t("routing.surface.mismatchTitle", { pref: t(`routing.surface.${preference}`) })}
				</div>
				<div style={{ fontSize: 11, color: RDS_COLORS.fgMuted, marginTop: 2 }}>
					{t("routing.surface.mismatchBody", { pct })}
				</div>
			</div>
		</div>
	);
}
