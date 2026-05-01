import { useAuthStatus } from "@/lib/api-queries";
import { I } from "../components/icons";
import { MapBackdrop } from "../components/MapBackdrop";
import { Badge, Btn, IconBtn, RDS_COLORS } from "../components/primitives";
import { UserAvatar } from "../components/UserAvatar";
import { useModalsStore } from "../stores/modalsStore";
import { useToastStore } from "../stores/toastStore";
import { type RedesignContext, useUiStore } from "../stores/uiStore";

type NavItem = {
	icon: (typeof I)[keyof typeof I];
	label: string;
	badge?: string;
	accent?: boolean;
	context?: RedesignContext;
	action?: "profile" | "achievements";
};

const NAV: NavItem[] = [
	{ icon: I.route, label: "Plan", badge: "Active route", context: "plan" },
	{ icon: I.library, label: "Library", badge: "24", context: "library" },
	{ icon: I.activity, label: "Activity", context: "activity" },
	{ icon: I.trophy, label: "Achievements", badge: "+2 new", accent: true, action: "achievements" },
	{ icon: I.user, label: "Profile", action: "profile" },
	{ icon: I.settings, label: "Settings", context: "settings" },
];

export function MobileDrawer({ onClose }: { onClose?: () => void }) {
	const theme = useUiStore((s) => s.theme);
	const toggleTheme = useUiStore((s) => s.toggleTheme);
	const setContext = useUiStore((s) => s.setContext);
	const activeContext = useUiStore((s) => s.context);
	const openOverlay = useModalsStore((s) => s.openOverlay);
	const pushToast = useToastStore((s) => s.push);
	const { data: auth } = useAuthStatus();
	const user = auth?.user ?? null;

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
			window.dispatchEvent(new CustomEvent("routess:open-account"));
			onClose?.();
			return;
		}
		if (item.action === "achievements") {
			pushToast({
				kind: "info",
				title: "Achievements coming soon",
				body: "Trophies and milestones land with the activity backend.",
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
				aria-label="Close drawer"
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
						<div style={{ fontSize: 14, fontWeight: 600 }}>{user?.name ?? "Guest"}</div>
						<div style={{ fontSize: 12, color: RDS_COLORS.fgSubtle }}>{user?.email ?? "Not signed in"}</div>
					</div>
					<div style={{ flex: 1 }} />
					<IconBtn title="Close" onClick={onClose}>
						<I.close size={14} />
					</IconBtn>
				</div>
				{NAV.map((r) => {
					const Icon = r.icon;
					const isActive = r.context !== undefined && r.context === activeContext;
					return (
						<button
							key={r.label}
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
							<span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{r.label}</span>
							{r.badge && <Badge variant={r.accent ? "accent" : "default"}>{r.badge}</Badge>}
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
						{theme === "dark" ? <I.sun size={14} /> : <I.moon size={14} />} {theme === "dark" ? "Light" : "Dark"}
					</Btn>
					<Btn style={{ flex: 1 }} onClick={handleAlerts}>
						<I.bell size={14} /> Alerts
					</Btn>
				</div>
			</aside>
		</div>
	);
}
