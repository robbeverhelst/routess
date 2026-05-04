import { useState } from "react";
import { I } from "../components/icons";
import { IconBtn, RDS_COLORS } from "../components/primitives";
import { useViewport } from "../hooks/useViewport";
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

const TABS = ["All", "Mentions", "Social", "System"] as const;

export function NotificationCenter() {
	const close = useModalsStore((s) => s.closeOverlay);
	const [tab, setTab] = useState<(typeof TABS)[number]>("All");
	const { isMobile } = useViewport();

	// No backend endpoint yet — render an empty state.
	const items: NotificationItem[] = [];
	const filtered = items.filter((n) => {
		if (tab === "All") return true;
		return n.tab === tab.toLowerCase();
	});
	const unreadCount = items.filter((n) => n.unread).length;

	return (
		<div
			style={
				isMobile
					? {
							position: "absolute",
							left: "max(12px, var(--rds-safe-left))",
							right: "max(12px, var(--rds-safe-right))",
							bottom: "var(--rds-bottom-tab-h)",
							maxHeight: "calc(100dvh - var(--rds-bottom-tab-h) - var(--rds-top-bar-h) - 16px)",
							background: RDS_COLORS.bgPanel,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 14,
							boxShadow: "var(--rds-shadow-lg)",
							zIndex: 60,
							display: "flex",
							flexDirection: "column",
							animation: "rds-sheet-in 200ms cubic-bezier(0.32, 0.72, 0, 1)",
						}
					: {
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
						}
			}
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
				{filtered.length === 0 ? (
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							gap: 10,
							padding: "40px 20px",
							textAlign: "center",
						}}
					>
						<div
							style={{
								width: 44,
								height: 44,
								borderRadius: 999,
								background: RDS_COLORS.bgInput,
								color: RDS_COLORS.fgMuted,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<I.bell size={20} />
						</div>
						<div style={{ fontSize: 13, fontWeight: 600, color: RDS_COLORS.fg }}>No notifications yet</div>
						<div style={{ fontSize: 12, color: RDS_COLORS.fgSubtle, lineHeight: 1.5, maxWidth: 240 }}>
							We'll let you know when something happens.
						</div>
					</div>
				) : (
					filtered.map((n) => {
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
									background: n.unread
										? `color-mix(in oklch, ${RDS_COLORS.accentSoft} 30%, transparent)`
										: "transparent",
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
					})
				)}
			</div>
		</div>
	);
}
