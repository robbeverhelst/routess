import { useT } from "@/lib/i18n";
import { useRouteDistance, useRouteDuration } from "@/stores/routingStore";
import { RDS_COLORS } from "./primitives";

// Compact title for the mobile plan drawer that puts distance and duration
// next to the screen name. Keeps the primary metrics visible at the
// half-snap, where the stats row below the chart sits behind the bottom tab
// bar and is otherwise cut off.
export function MobilePlanTitle() {
	const t = useT();
	const distance = useRouteDistance();
	const duration = useRouteDuration();
	const hasMetrics = Boolean(distance || duration);

	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "baseline",
				gap: 8,
				minWidth: 0,
				overflow: "hidden",
				whiteSpace: "nowrap",
				textOverflow: "ellipsis",
			}}
		>
			<span style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.2 }}>{t("nav.plan")}</span>
			{hasMetrics && (
				<>
					<span style={{ color: RDS_COLORS.fgSubtle, fontSize: 13 }}>·</span>
					<span className="rds-mono" style={{ fontSize: 13, color: RDS_COLORS.fgMuted, fontWeight: 500 }}>
						{distance || "—"}
					</span>
					<span style={{ color: RDS_COLORS.fgSubtle, fontSize: 13 }}>·</span>
					<span className="rds-mono" style={{ fontSize: 13, color: RDS_COLORS.fgMuted, fontWeight: 500 }}>
						{duration || "—"}
					</span>
				</>
			)}
		</span>
	);
}
