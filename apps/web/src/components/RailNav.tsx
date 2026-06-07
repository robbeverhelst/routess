import { Link } from "@tanstack/react-router";
import { useAuthStatus, useNotificationUnseenCount, useShareUnreadCount } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { useModalsStore } from "@/stores/modalsStore";
import { type RedesignContext, useUiStore } from "@/stores/uiStore";
import { I } from "./icons";
import { IconBtn, RDS_COLORS } from "./primitives";
import { Tooltip } from "./Tooltip";
import { UserAvatar } from "./UserAvatar";

const NAV: { key: RedesignContext; icon: React.ComponentType<{ size?: number }>; labelKey: string }[] = [
	{ key: "plan", icon: I.route, labelKey: "nav.plan" },
	{ key: "library", icon: I.library, labelKey: "nav.library" },
	{ key: "discover", icon: I.explore, labelKey: "nav.discover" },
	{ key: "social", icon: I.social, labelKey: "nav.social" },
	{ key: "settings", icon: I.settings, labelKey: "nav.settings" },
];

export function RailNav() {
	const t = useT();
	const { context, setContext, theme, toggleTheme, panelCollapsed, togglePanel, setPanelCollapsed } = useUiStore();
	const { data: auth } = useAuthStatus();
	const isAdmin = auth?.user?.role === "admin";
	const { data: unreadShares = 0 } = useShareUnreadCount();
	const { data: unseen = 0 } = useNotificationUnseenCount();
	const overlay = useModalsStore((s) => s.overlay);
	const openOverlay = useModalsStore((s) => s.openOverlay);
	const closeOverlay = useModalsStore((s) => s.closeOverlay);
	const bellActive = overlay === "notifications";

	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				bottom: 0,
				left: 0,
				width: "var(--rds-rail-w)",
				background: RDS_COLORS.bgRail,
				borderRight: `1px solid ${RDS_COLORS.border}`,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				padding: "12px 0",
				gap: 4,
				flexShrink: 0,
				zIndex: 5,
			}}
		>
			<div style={{ marginBottom: 12, marginTop: 2 }}>
				<img src="/logo.png" alt="routess" width={28} height={28} style={{ borderRadius: 8, display: "block" }} />
			</div>
			<div
				style={{
					height: 1,
					width: 24,
					background: RDS_COLORS.border,
					margin: "4px 0 8px",
				}}
			/>
			{NAV.map((n) => {
				const on = context === n.key;
				const Icon = n.icon;
				const open = on && !panelCollapsed;
				return (
					<Tooltip
						key={n.key}
						label={on ? t("rail.togglePanel", { label: t(n.labelKey) }) : t(n.labelKey)}
						side="right"
					>
						<button
							type="button"
							aria-label={t(n.labelKey)}
							onClick={() => {
								if (on) {
									// Clicking the active context toggles the panel.
									togglePanel();
								} else {
									// Switching context always expands the panel.
									setContext(n.key);
									setPanelCollapsed(false);
								}
							}}
							style={{
								width: 36,
								height: 36,
								borderRadius: 8,
								background: open ? RDS_COLORS.accentSoft : on ? RDS_COLORS.bgActive : "transparent",
								color: open ? RDS_COLORS.accent : on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
								border: 0,
								position: "relative",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								cursor: "pointer",
								transition: "background var(--rds-panel-anim), color var(--rds-panel-anim)",
							}}
						>
							<div
								style={{
									position: "absolute",
									left: -10,
									top: 8,
									bottom: 8,
									width: 2.5,
									borderRadius: 999,
									background: RDS_COLORS.accent,
									opacity: open ? 1 : 0,
									transform: open ? "scaleY(1)" : "scaleY(0.4)",
									transformOrigin: "center",
									transition: "opacity var(--rds-panel-anim), transform var(--rds-panel-anim)",
									pointerEvents: "none",
								}}
							/>
							<Icon size={18} />
							{n.key === "social" && unreadShares > 0 && (
								<span
									style={{
										position: "absolute",
										top: 4,
										right: 4,
										width: 8,
										height: 8,
										borderRadius: 999,
										background: RDS_COLORS.accent,
										pointerEvents: "none",
									}}
								/>
							)}
						</button>
					</Tooltip>
				);
			})}
			<div style={{ flex: 1 }} />
			{isAdmin && (
				<Tooltip label="Admin" side="right">
					<Link
						to="/admin"
						aria-label="Admin"
						style={{
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							width: 32,
							height: 32,
							borderRadius: "var(--rds-radius-sm)",
							color: RDS_COLORS.fgMuted,
							textDecoration: "none",
							transition: "background 120ms, color 120ms",
						}}
						activeProps={{
							style: {
								background: RDS_COLORS.accentSoft,
								color: RDS_COLORS.accent,
							},
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = RDS_COLORS.bgHover;
							e.currentTarget.style.color = RDS_COLORS.fg;
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = "transparent";
							e.currentTarget.style.color = RDS_COLORS.fgMuted;
						}}
					>
						<I.shield size={18} />
					</Link>
				</Tooltip>
			)}
			{auth?.user && (
				<div style={{ position: "relative" }}>
					<IconBtn
						title={t("rail.notifications")}
						pressed={bellActive}
						onClick={() => (bellActive ? closeOverlay() : openOverlay("notifications"))}
					>
						<I.bell size={18} />
					</IconBtn>
					{unseen > 0 && (
						<span
							style={{
								position: "absolute",
								top: -3,
								right: -3,
								minWidth: 15,
								height: 15,
								padding: "0 3px",
								borderRadius: 999,
								background: RDS_COLORS.accent,
								color: RDS_COLORS.accentFg,
								fontSize: 9.5,
								fontWeight: 600,
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								pointerEvents: "none",
							}}
						>
							{unseen > 9 ? "9+" : unseen}
						</span>
					)}
				</div>
			)}
			<IconBtn title={t("appshell.toggleTheme")} onClick={toggleTheme}>
				{theme === "dark" ? <I.sun size={18} /> : <I.moon size={18} />}
			</IconBtn>
			<div style={{ marginTop: 6 }}>
				<UserAvatar size={30} compact />
			</div>
		</div>
	);
}
