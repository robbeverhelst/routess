import { t } from "@/lib/i18n";
import { useModalsStore } from "@/stores/modalsStore";
import { type RedesignContext, useUiStore } from "@/stores/uiStore";
import { I } from "./icons";
import { IconBtn, RDS_COLORS } from "./primitives";
import { UserAvatar } from "./UserAvatar";

const NAV: { key: RedesignContext; icon: React.ComponentType<{ size?: number }>; labelKey: string }[] = [
	{ key: "plan", icon: I.route, labelKey: "nav.plan" },
	{ key: "library", icon: I.library, labelKey: "nav.library" },
	{ key: "discover", icon: I.explore, labelKey: "nav.discover" },
	{ key: "social", icon: I.social, labelKey: "nav.social" },
	{ key: "settings", icon: I.settings, labelKey: "nav.settings" },
];

export function RailNav() {
	const { context, setContext, theme, toggleTheme, panelCollapsed, togglePanel, setPanelCollapsed, language } =
		useUiStore();
	const openOverlay = useModalsStore((s) => s.openOverlay);
	const overlay = useModalsStore((s) => s.overlay);
	const closeOverlay = useModalsStore((s) => s.closeOverlay);

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
					<button
						key={n.key}
						type="button"
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
						title={on ? t("rail.togglePanel", language, { label: t(n.labelKey, language) }) : t(n.labelKey, language)}
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
					</button>
				);
			})}
			<div style={{ flex: 1 }} />
			<IconBtn
				title={t("rail.notifications", language)}
				pressed={overlay === "notifications"}
				onClick={() => (overlay === "notifications" ? closeOverlay() : openOverlay("notifications"))}
			>
				<I.bell size={18} />
			</IconBtn>
			<IconBtn title={t("appshell.toggleTheme", language)} onClick={toggleTheme}>
				{theme === "dark" ? <I.sun size={18} /> : <I.moon size={18} />}
			</IconBtn>
			<div style={{ marginTop: 6 }}>
				<UserAvatar size={30} compact />
			</div>
		</div>
	);
}
