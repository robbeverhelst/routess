import { useState } from "react";
import { I } from "../components/icons";
import { Btn, IconBtn, RDS_COLORS } from "../components/primitives";
import { useModalsStore } from "../stores/modalsStore";

interface NotificationItem {
	id: string;
	icon: React.ComponentType<{ size?: number }>;
	title: string;
	body: string;
	ago: string;
	unread: boolean;
	accent?: boolean;
	tab: "mentions" | "social" | "system";
}

// Default-data — backend has no notifications endpoint yet.
const ITEMS: NotificationItem[] = [
	{
		id: "n1",
		icon: I.zap,
		title: "PR on Heidestraat climb",
		body: "You beat your best by 4 seconds.",
		ago: "2h",
		unread: true,
		accent: true,
		tab: "system",
	},
	{
		id: "n2",
		icon: I.heart,
		title: "Lara liked your route",
		body: "Schelde loop — long",
		ago: "4h",
		unread: true,
		tab: "social",
	},
	{
		id: "n3",
		icon: I.user,
		title: "Tom started following",
		body: "Tap to view their profile",
		ago: "1d",
		unread: true,
		tab: "social",
	},
	{
		id: "n4",
		icon: I.share,
		title: "Route shared with you",
		body: "Anouk: Friday gravel mix",
		ago: "2d",
		unread: false,
		tab: "mentions",
	},
	{
		id: "n5",
		icon: I.refresh,
		title: "Sync complete",
		body: "3 rides imported from Garmin",
		ago: "3d",
		unread: false,
		tab: "system",
	},
];

const TABS = ["All", "Mentions", "Social", "System"] as const;

export function NotificationCenter() {
	const close = useModalsStore((s) => s.closeOverlay);
	const [tab, setTab] = useState<(typeof TABS)[number]>("All");

	const filtered = ITEMS.filter((n) => {
		if (tab === "All") return true;
		return n.tab === tab.toLowerCase();
	});
	const unreadCount = ITEMS.filter((n) => n.unread).length;

	return (
		<div
			style={{
				position: "absolute",
				top: 16,
				right: 16,
				width: 380,
				background: RDS_COLORS.bgPanel,
				border: `1px solid ${RDS_COLORS.border}`,
				borderRadius: 14,
				boxShadow: "var(--rds-shadow-lg)",
				zIndex: 60,
				maxHeight: "70vh",
				display: "flex",
				flexDirection: "column",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					padding: "14px 16px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<I.bell size={16} />
				<div style={{ fontSize: 14, fontWeight: 600 }}>Notifications</div>
				{unreadCount > 0 && (
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
							padding: "2px 8px",
							height: 22,
							borderRadius: 999,
							background: RDS_COLORS.accentSoft,
							color: RDS_COLORS.accent,
							fontSize: 11.5,
							fontWeight: 500,
						}}
					>
						{unreadCount} new
					</span>
				)}
				<div style={{ flex: 1 }} />
				<Btn variant="ghost" style={{ height: 26, padding: "0 8px", fontSize: 11.5 }}>
					Mark all read
				</Btn>
				<IconBtn title="Close" onClick={close}>
					<I.close size={14} />
				</IconBtn>
			</div>
			<div
				style={{
					display: "flex",
					gap: 4,
					padding: "8px 12px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				{TABS.map((t) => {
					const on = tab === t;
					return (
						<button
							key={t}
							type="button"
							onClick={() => setTab(t)}
							style={{
								height: 26,
								padding: "0 10px",
								borderRadius: 999,
								background: on ? RDS_COLORS.bgActive : "transparent",
								color: on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
								border: 0,
								fontSize: 12,
								cursor: "pointer",
							}}
						>
							{t}
						</button>
					);
				})}
			</div>
			<div style={{ overflow: "auto", flex: 1 }}>
				{filtered.map((n) => {
					const Icon = n.icon;
					return (
						<div
							key={n.id}
							style={{
								display: "flex",
								alignItems: "flex-start",
								gap: 12,
								padding: "12px 16px",
								borderBottom: `1px solid ${RDS_COLORS.border}`,
								background: n.unread ? `color-mix(in oklch, ${RDS_COLORS.accentSoft} 30%, transparent)` : "transparent",
							}}
						>
							<div
								style={{
									width: 32,
									height: 32,
									borderRadius: 8,
									background: n.accent ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
									color: n.accent ? RDS_COLORS.accent : RDS_COLORS.fgMuted,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
								}}
							>
								<Icon size={14} />
							</div>
							<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
								<div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
								<div style={{ fontSize: 12, color: RDS_COLORS.fgMuted, marginTop: 2 }}>{n.body}</div>
							</div>
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									alignItems: "flex-end",
									gap: 4,
									flexShrink: 0,
								}}
							>
								<span className="rds-mono" style={{ fontSize: 10.5, color: RDS_COLORS.fgSubtle }}>
									{n.ago}
								</span>
								{n.unread && (
									<div
										style={{
											width: 7,
											height: 7,
											borderRadius: 999,
											background: RDS_COLORS.accent,
										}}
									/>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
