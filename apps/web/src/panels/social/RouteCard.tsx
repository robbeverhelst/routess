import type { ApiProfileRoute } from "@routess/api-client";
import { useT } from "@/lib/i18n";
import { useUnits } from "@/lib/units";
import { I } from "../../components/icons";
import { RDS_COLORS } from "../../components/primitives";

// Compact route summary card used by the feed, inbox, and profile views.
// Clicking opens the interactive public route page.
export function SocialRouteCard({
	route,
	header,
	footer,
}: {
	route: ApiProfileRoute;
	header?: React.ReactNode;
	footer?: React.ReactNode;
}) {
	const t = useT();
	const { formatDistanceParts, formatElevationParts } = useUnits();
	const distance = route.distance ? formatDistanceParts(route.distance / 1000) : null;
	const elevation = route.elevationGain ? formatElevationParts(route.elevationGain) : null;

	return (
		<div
			style={{
				border: `1px solid ${RDS_COLORS.border}`,
				borderRadius: 12,
				background: RDS_COLORS.bgPanel,
				padding: 12,
				display: "flex",
				flexDirection: "column",
				gap: 8,
			}}
		>
			{header}
			{/* slugId is server-computed: token form for unlisted shares, id form for public. */}
			<a href={`/r/${route.slugId}`} style={{ textDecoration: "none", color: RDS_COLORS.fg }}>
				<div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{route.name}</div>
				<div
					style={{
						display: "flex",
						gap: 12,
						marginTop: 4,
						fontSize: 12,
						color: RDS_COLORS.fgMuted,
						alignItems: "center",
					}}
				>
					{route.activity && <span>{t(`sport.${route.activity}`)}</span>}
					{distance && (
						<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
							<I.route size={12} />
							{distance.value} {distance.unit}
						</span>
					)}
					{elevation && (
						<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
							<I.mountain size={12} />
							{elevation.value} {elevation.unit}
						</span>
					)}
					{route.publishedAt && <span>{new Date(route.publishedAt).toLocaleDateString()}</span>}
				</div>
			</a>
			{route.tags.length > 0 && (
				<div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
					{route.tags.slice(0, 4).map((tag) => (
						<span
							key={tag}
							style={{
								padding: "2px 8px",
								borderRadius: 999,
								background: RDS_COLORS.accentSoft,
								color: RDS_COLORS.accent,
								fontSize: 11,
							}}
						>
							#{tag}
						</span>
					))}
				</div>
			)}
			{footer}
		</div>
	);
}
