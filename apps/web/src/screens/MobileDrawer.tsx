import { useAuthStatus } from "@/lib/api-queries";
import { emitAppEvent } from "@/lib/app-events";
import { type SupportedLanguage, t } from "@/lib/i18n";
import { useModalsStore } from "@/stores/modalsStore";
import { useToastStore } from "@/stores/toastStore";
import { type RedesignContext, useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { MapBackdrop } from "../components/MapBackdrop";
import { Badge, Btn, IconBtn, RDS_COLORS } from "../components/primitives";
import { UserAvatar } from "../components/UserAvatar";

type NavItem = {
	icon: (typeof I)[keyof typeof I];
	labelKey: string;
	badgeKey?: string;
	badgeText?: string;
	accent?: boolean;
	context?: RedesignContext;
	action?: "profile" | "user-settings" | "achievements";
};

function buildNav(_language: SupportedLanguage, libraryCount: string): NavItem[] {
	return [
		{ icon: I.route, labelKey: "nav.plan", badgeKey: "drawer.activeRoute", context: "plan" },
		{ icon: I.library, labelKey: "nav.library", badgeText: libraryCount, context: "library" },
		{ icon: I.explore, labelKey: "nav.discover", context: "discover" },
		{ icon: I.social, labelKey: "nav.social", context: "social" },
		{
			icon: I.trophy,
			labelKey: "drawer.achievements",
			badgeKey: "drawer.achievementsBadge",
			accent: true,
			action: "achievements",
		},
		{ icon: I.user, labelKey: "drawer.profile", action: "profile" },
		{ icon: I.settings, labelKey: "drawer.userSettings", action: "user-settings" },
	];
}

export function MobileDrawer({ onClose }: { onClose?: () => void }) {
	const theme = useUiStore((s) => s.theme);
	const toggleTheme = useUiStore((s) => s.toggleTheme);
	const setContext = useUiStore((s) => s.setContext);
	const activeContext = useUiStore((s) => s.context);
	const language = useUiStore((s) => s.language);
	const openOverlay = useModalsStore((s) => s.openOverlay);
	const pushToast = useToastStore((s) => s.push);
	const { data: auth } = useAuthStatus();
	const user = auth?.user ?? null;
	const NAV = buildNav(language, "24");

	const handleAlerts = () => {
		openOverlay("notifications");
		onClose?.();
	};

	const handleNav = (item: NavItem) => {
		if (item.context) {
			setContext(item.context);
			onClose?.();
			return;
		}
		if (item.action === "profile") {
			emitAppEvent("routess:open-profile");
			onClose?.();
			return;
		}
		if (item.action === "user-settings") {
			emitAppEvent("routess:open-user-settings");
			onClose?.();
			return;
		}
		if (item.action === "achievements") {
			pushToast({
				kind: "info",
				title: t("drawer.achievementsToast"),
				body: t("drawer.achievementsToastSub"),
			});
		}
	};

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				zIndex: 80,
			}}
		>
			<MapBackdrop showRoute />
			<div
				style={{
					position: "absolute",
					inset: 0,
					background: "color-mix(in oklch, oklch(0 0 0) 40%, transparent)",
				}}
			/>
			<button
				type="button"
				aria-label={t("drawer.closeAria")}
				onClick={onClose}
				style={{
					position: "absolute",
					inset: 0,
					background: "transparent",
					border: 0,
					padding: 0,
					cursor: "default",
				}}
			/>
			<aside
				style={{
					position: "absolute",
					top: 0,
					bottom: 0,
					left: 0,
					width: "min(86%, 320px)",
					background: RDS_COLORS.bgPanel,
					boxShadow: "var(--rds-shadow-lg)",
					display: "flex",
					flexDirection: "column",
					zIndex: 1,
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 12,
						padding: "20px 18px",
						borderBottom: `1px solid ${RDS_COLORS.border}`,
					}}
				>
					<UserAvatar size={44} />
					<div style={{ display: "flex", flexDirection: "column" }}>
						<div style={{ fontSize: 14, fontWeight: 600 }}>{user?.name ?? t("drawer.guest")}</div>
						<div style={{ fontSize: 12, color: RDS_COLORS.fgSubtle }}>{user?.email ?? t("drawer.notSignedIn")}</div>
					</div>
					<div style={{ flex: 1 }} />
					<IconBtn title={t("common.close")} onClick={onClose}>
						<I.close size={14} />
					</IconBtn>
				</div>
				{NAV.map((r) => {
					const Icon = r.icon;
					const isActive = r.context !== undefined && r.context === activeContext;
					const badge = r.badgeKey ? t(r.badgeKey) : r.badgeText;
					return (
						<button
							key={r.labelKey}
							type="button"
							onClick={() => handleNav(r)}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 12,
								padding: "14px 18px",
								textAlign: "left",
								border: 0,
								background: isActive ? RDS_COLORS.bgActive : "transparent",
								borderLeft: isActive ? `3px solid ${RDS_COLORS.accent}` : "3px solid transparent",
								cursor: "pointer",
								color: "inherit",
							}}
						>
							<Icon size={16} />
							<span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{t(r.labelKey)}</span>
							{badge && <Badge variant={r.accent ? "accent" : "default"}>{badge}</Badge>}
						</button>
					);
				})}
				<div style={{ flex: 1 }} />
				<div
					style={{
						display: "flex",
						gap: 12,
						padding: 18,
						borderTop: `1px solid ${RDS_COLORS.border}`,
					}}
				>
					<Btn style={{ flex: 1 }} onClick={toggleTheme}>
						{theme === "dark" ? <I.sun size={14} /> : <I.moon size={14} />}{" "}
						{theme === "dark" ? t("drawer.theme.light") : t("drawer.theme.dark")}
					</Btn>
					<Btn style={{ flex: 1 }} onClick={handleAlerts}>
						<I.bell size={14} /> {t("nav.alerts")}
					</Btn>
				</div>
			</aside>
		</div>
	);
}
