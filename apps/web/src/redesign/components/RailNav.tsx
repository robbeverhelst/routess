import { useModalsStore } from "@/redesign/stores/modalsStore";
import { type RedesignContext, useUiStore } from "@/redesign/stores/uiStore";
import { I, RoutessMark } from "./icons";
import { IconBtn, RDS_COLORS } from "./primitives";
import { UserAvatar } from "./UserAvatar";

const NAV: { key: RedesignContext; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
	{ key: "plan", icon: I.route, label: "Plan" },
	{ key: "library", icon: I.library, label: "Library" },
	{ key: "discover", icon: I.explore, label: "Discover" },
	{ key: "social", icon: I.social, label: "Social" },
];

export function RailNav() {
	const { context, setContext, theme, toggleTheme, layout, panelCollapsed, togglePanel, setPanelCollapsed } =
		useUiStore();
	const openOverlay = useModalsStore((s) => s.openOverlay);
	const overlay = useModalsStore((s) => s.overlay);
	const closeOverlay = useModalsStore((s) => s.closeOverlay);
	const supportsCollapse = layout === "sidebar";

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
			<div style={{ color: RDS_COLORS.accent, marginBottom: 12, marginTop: 2 }}>
				<RoutessMark size={22} />
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
				const accent = on && !panelCollapsed;
				return (
					<button
						key={n.key}
						type="button"
						onClick={() => {
							if (!supportsCollapse) {
								setContext(n.key);
								return;
							}
							if (on) {
								// Clicking the active context toggles the panel.
								togglePanel();
							} else {
								// Switching context always expands the panel.
								setContext(n.key);
								setPanelCollapsed(false);
							}
						}}
						title={on && supportsCollapse ? `${n.label} (toggle panel)` : n.label}
						style={{
							width: 36,
							height: 36,
							borderRadius: 8,
							background: on ? RDS_COLORS.bgActive : "transparent",
							color: on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
							border: 0,
							position: "relative",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							cursor: "pointer",
						}}
					>
						{accent && (
							<div
								style={{
									position: "absolute",
									left: -10,
									top: 8,
									bottom: 8,
									width: 2.5,
									borderRadius: 999,
									background: RDS_COLORS.accent,
								}}
							/>
						)}
						<Icon size={18} />
					</button>
				);
			})}
			<div style={{ flex: 1 }} />
			<IconBtn
				title="Notifications"
				pressed={overlay === "notifications"}
				onClick={() => (overlay === "notifications" ? closeOverlay() : openOverlay("notifications"))}
			>
				<I.bell size={18} />
			</IconBtn>
			<IconBtn title="Toggle theme" onClick={toggleTheme}>
				{theme === "dark" ? <I.sun size={18} /> : <I.moon size={18} />}
			</IconBtn>
			<div style={{ marginTop: 6 }}>
				<UserAvatar size={30} compact />
			</div>
		</div>
	);
}
