import { useFeed } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { I } from "../../components/icons";
import { RDS_COLORS } from "../../components/primitives";
import { Avatar } from "./Avatar";
import { SocialRouteCard } from "./RouteCard";

export function FeedTab({ onOpenProfile }: { onOpenProfile: (handle: string) => void }) {
	const t = useT();
	const { data, isLoading } = useFeed();
	const items = data?.items ?? [];

	if (isLoading) {
		return <div style={{ padding: 40, textAlign: "center", color: RDS_COLORS.fgSubtle }}>{t("social.loading")}</div>;
	}
	if (items.length === 0) {
		return (
			<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
				<div style={{ maxWidth: 280, textAlign: "center" }}>
					<div
						style={{
							width: 72,
							height: 72,
							margin: "0 auto 14px",
							borderRadius: 18,
							background: RDS_COLORS.accentSoft,
							color: RDS_COLORS.accent,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<I.social size={30} />
					</div>
					<h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t("social.feed.empty.title")}</h3>
					<p style={{ fontSize: 13, color: RDS_COLORS.fgMuted, margin: "6px 0 0", lineHeight: 1.5 }}>
						{t("social.feed.empty.body")}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10 }}
		>
			{items.map((item) => (
				<SocialRouteCard
					key={item.id}
					route={item}
					header={
						<button
							type="button"
							onClick={() => onOpenProfile(item.author.handle)}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								background: "transparent",
								border: 0,
								padding: 0,
								cursor: "pointer",
								color: RDS_COLORS.fgMuted,
								textAlign: "left",
							}}
						>
							<Avatar name={item.author.name} avatar={item.author.avatar} size={24} />
							<span style={{ fontSize: 12 }}>
								<span style={{ fontWeight: 600, color: RDS_COLORS.fg }}>{item.author.name}</span>{" "}
								{t("social.feed.published")}
							</span>
						</button>
					}
				/>
			))}
		</div>
	);
}
