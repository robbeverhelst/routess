import type { ApiDiscoverRoute } from "@routess/api-client";
import { useT } from "@/lib/i18n";
import { useUnits } from "@/lib/units";
import { I } from "../../components/icons";
import { RDS_COLORS } from "../../components/primitives";
import { RouteThumb } from "../library/RouteThumb";
import { Avatar } from "../social/Avatar";

function placeLabel(route: ApiDiscoverRoute): string | null {
	if (!route.placeCity) return null;
	return route.placeRegion ? `${route.placeCity}, ${route.placeRegion}` : route.placeCity;
}

// Card on the Discover surface. The whole card links to the interactive
// public route page (/r/{slugId}); hover highlights the path on the map.
export function DiscoverRouteCard({
	route,
	hovered,
	onHover,
	onOpen,
}: {
	route: ApiDiscoverRoute;
	hovered: boolean;
	onHover: (id: number | null) => void;
	onOpen: () => void;
}) {
	const t = useT();
	const { formatDistanceParts, formatElevationParts } = useUnits();
	const distance = route.distance ? formatDistanceParts(route.distance / 1000) : null;
	const elevation = route.elevationGain ? formatElevationParts(route.elevationGain) : null;
	const place = placeLabel(route);

	return (
		<a
			href={`/r/${route.slugId}`}
			onClick={onOpen}
			onMouseEnter={() => onHover(route.id)}
			onMouseLeave={() => onHover(null)}
			style={{
				display: "flex",
				gap: 10,
				padding: 10,
				borderRadius: 12,
				border: `1px solid ${hovered ? RDS_COLORS.borderStrong : RDS_COLORS.border}`,
				background: hovered ? RDS_COLORS.bgActive : RDS_COLORS.bgPanel,
				textDecoration: "none",
				color: RDS_COLORS.fg,
			}}
		>
			<div style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
				<RouteThumb route={route} width={72} height={72} />
			</div>
			<div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
				<div
					style={{
						fontSize: 13.5,
						fontWeight: 600,
						lineHeight: 1.3,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{route.name}
				</div>
				<div style={{ display: "flex", gap: 10, fontSize: 12, color: RDS_COLORS.fgMuted, alignItems: "center" }}>
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
				</div>
				{place && (
					<div
						style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: RDS_COLORS.fgMuted }}
					>
						<I.pin size={12} />
						<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place}</span>
					</div>
				)}
				{route.user && (
					<div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>
						<Avatar name={route.user.name} avatar={route.user.avatar} size={16} />
						<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
							{route.user.name}
						</span>
						{route.publishedAt && <span>· {new Date(route.publishedAt).toLocaleDateString()}</span>}
					</div>
				)}
				{route.source && (
					// Seeded ExternalRoute (ADR 0033): the source is the creator. The
					// license badge satisfies the attribution obligation in the listing.
					<div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>
						<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
							{route.source.name}
						</span>
						<span
							style={{
								flexShrink: 0,
								fontSize: 10,
								padding: "1px 5px",
								borderRadius: 5,
								background: RDS_COLORS.bgActive,
								color: RDS_COLORS.fgMuted,
							}}
						>
							{route.source.license}
						</span>
					</div>
				)}
			</div>
		</a>
	);
}
