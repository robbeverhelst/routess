import { isSurfaceMismatch, type SurfaceType, surfaceMismatchFraction } from "@routess/core";
import type { SurfaceBreakdown } from "@/features/routing/services/SurfaceService";
import { useT } from "@/lib/i18n";
import { I } from "./icons";
import { RDS_COLORS } from "./primitives";

interface Props {
	breakdown: SurfaceBreakdown | null;
	preference: SurfaceType | null | undefined;
}

// A1: shows a small warning when the actual surface composition violates the
// user's surfacePreference by more than SURFACE_MISMATCH_THRESHOLD (5%).
// "mixed" preference is permissive and never produces a mismatch.
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
				background: "rgba(245, 158, 11, 0.12)",
				border: "1px solid rgba(245, 158, 11, 0.35)",
				color: RDS_COLORS.fg,
				fontSize: 12,
			}}
			role="status"
		>
			<I.flag size={14} />
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
