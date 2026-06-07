import { Link } from "@tanstack/react-router";
import { useAuthStatus, useNotificationUnseenCount } from "@/lib/api-queries";
import { useT } from "@/lib/i18n";
import { useModalsStore } from "@/stores/modalsStore";
import { useUiStore } from "@/stores/uiStore";
import { I } from "./icons";
import { IconBtn, RDS_COLORS } from "./primitives";
import { UserAvatar } from "./UserAvatar";

export function MobileTopBar() {
	const t = useT();
	const { theme, toggleTheme } = useUiStore();
	const openModal = useModalsStore((s) => s.openModal);
	const openOverlay = useModalsStore((s) => s.openOverlay);
	const closeOverlay = useModalsStore((s) => s.closeOverlay);
	const overlay = useModalsStore((s) => s.overlay);
	const alertsActive = overlay === "notifications";
	const { data: auth } = useAuthStatus();
	const isAdmin = auth?.user?.role === "admin";
	const { data: unseen = 0 } = useNotificationUnseenCount();

	return (
		<header
			style={{
				position: "absolute",
				top: "max(10px, calc(var(--rds-safe-top) + 6px))",
				left: "max(10px, var(--rds-safe-left))",
				right: "max(10px, var(--rds-safe-right))",
				height: 48,
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "0 10px 0 12px",
				background: `color-mix(in oklch, ${RDS_COLORS.bgPanel} 88%, transparent)`,
				backdropFilter: "blur(16px) saturate(150%)",
				WebkitBackdropFilter: "blur(16px) saturate(150%)",
				border: `1px solid ${RDS_COLORS.border}`,
				borderRadius: 18,
				boxShadow:
					"0 1px 0 oklch(1 0 0 / 0.06) inset, 0 8px 24px -8px oklch(0 0 0 / 0.18), 0 24px 48px -16px oklch(0 0 0 / 0.18)",
				zIndex: 7,
			}}
		>
			<img
				src="/logo.png"
				alt="routess"
				width={26}
				height={26}
				style={{ borderRadius: 7, display: "block", flexShrink: 0 }}
			/>
			<span style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.1 }}>routess</span>
			<div style={{ flex: 1 }} />
			<IconBtn title={t("common.search")} onClick={() => openModal("search")}>
				<I.search size={18} />
			</IconBtn>
			{auth?.user && (
				<div style={{ position: "relative" }}>
					<IconBtn
						title={t("nav.alerts")}
						pressed={alertsActive}
						onClick={() => (alertsActive ? closeOverlay() : openOverlay("notifications"))}
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
			{isAdmin && (
				<Link
					to="/admin"
					title="Admin"
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
						flexShrink: 0,
					}}
					activeProps={{
						style: {
							background: RDS_COLORS.accentSoft,
							color: RDS_COLORS.accent,
						},
					}}
				>
					<I.shield size={18} />
				</Link>
			)}
			<UserAvatar size={30} compact />
		</header>
	);
}
