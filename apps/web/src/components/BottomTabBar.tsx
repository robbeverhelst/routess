import type { CSSProperties } from "react";
import { useShareUnreadCount } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { type RedesignContext, useUiStore } from "@/stores/uiStore";
import { I } from "./icons";
import { RDS_COLORS } from "./primitives";

interface NavItem {
	key: RedesignContext;
	icon: React.ComponentType<{ size?: number }>;
	labelKey: string;
}

const NAV: NavItem[] = [
	{ key: "plan", icon: I.route, labelKey: "nav.plan" },
	{ key: "library", icon: I.library, labelKey: "nav.library" },
	// Discover is hidden until the feature ships; a top-level tab must not
	// open a "coming soon" stub.
	// { key: "discover", icon: I.explore, labelKey: "nav.discover" },
	{ key: "social", icon: I.social, labelKey: "nav.social" },
	{ key: "settings", icon: I.settings, labelKey: "nav.settings" },
];

export function BottomTabBar() {
	const t = useT();
	const { context, setContext, panelCollapsed, togglePanel, setPanelCollapsed } = useUiStore();
	const { data: unreadShares = 0 } = useShareUnreadCount();

	return (
		<nav
			aria-label={t("a11y.primaryNav")}
			style={{
				position: "absolute",
				left: "max(10px, var(--rds-safe-left))",
				right: "max(10px, var(--rds-safe-right))",
				bottom: "max(10px, calc(var(--rds-safe-bottom) + 6px))",
				height: 60,
				padding: "6px 6px",
				background: `color-mix(in oklch, ${RDS_COLORS.bgPanel} 88%, transparent)`,
				backdropFilter: "blur(16px) saturate(150%)",
				WebkitBackdropFilter: "blur(16px) saturate(150%)",
				border: `1px solid ${RDS_COLORS.border}`,
				borderRadius: 22,
				boxShadow:
					"0 1px 0 oklch(1 0 0 / 0.06) inset, 0 -8px 24px -8px oklch(0 0 0 / 0.10), 0 16px 32px -8px oklch(0 0 0 / 0.18), 0 32px 64px -16px oklch(0 0 0 / 0.20)",
				display: "flex",
				alignItems: "stretch",
				zIndex: 11,
			}}
		>
			{NAV.map((n) => {
				const isActive = context === n.key && !panelCollapsed;
				return (
					<TabButton
						key={n.key}
						icon={n.icon}
						label={t(n.labelKey)}
						active={isActive}
						showDot={n.key === "social" && unreadShares > 0}
						onClick={() => {
							if (context === n.key) {
								togglePanel();
							} else {
								setContext(n.key);
								setPanelCollapsed(false);
							}
						}}
					/>
				);
			})}
		</nav>
	);
}

interface TabButtonProps {
	icon: React.ComponentType<{ size?: number }>;
	label: string;
	active: boolean;
	onClick: () => void;
	showDot?: boolean;
}

function TabButton({ icon: Icon, label, active, onClick, showDot }: TabButtonProps) {
	const baseStyle: CSSProperties = {
		flex: 1,
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		gap: 2,
		padding: "4px 4px 2px",
		background: "transparent",
		border: 0,
		color: active ? RDS_COLORS.accent : RDS_COLORS.fgMuted,
		cursor: "pointer",
		borderRadius: 16,
		WebkitTapHighlightColor: "transparent",
		transition: "color 160ms ease",
	};

	return (
		<button
			type="button"
			onClick={onClick}
			aria-current={active ? "page" : undefined}
			className="rds-tab-btn"
			style={baseStyle}
		>
			<span
				className="rds-tab-pill"
				style={{
					position: "relative",
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					height: 28,
					minWidth: 48,
					padding: "0 12px",
					borderRadius: 999,
					background: active ? RDS_COLORS.accentSoft : "transparent",
					transition: "background 200ms ease, transform 160ms ease",
				}}
			>
				<Icon size={20} />
				{showDot && (
					<span
						style={{
							position: "absolute",
							top: 2,
							right: 8,
							width: 8,
							height: 8,
							borderRadius: 999,
							background: RDS_COLORS.accent,
							pointerEvents: "none",
						}}
					/>
				)}
			</span>
			<span
				style={{
					fontSize: 10.5,
					fontWeight: active ? 600 : 500,
					letterSpacing: 0.15,
					lineHeight: 1.1,
				}}
			>
				{label}
			</span>
		</button>
	);
}
