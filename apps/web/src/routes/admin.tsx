import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { I } from "@/components/icons";
import { IconBtn, RDS_COLORS, SecTitle } from "@/components/primitives";
import { useViewport } from "@/hooks/useViewport";
import { getStoredUser } from "@/lib/auth-state";
import { useUiStore } from "@/stores/uiStore";

export const Route = createFileRoute("/admin")({
	beforeLoad: () => {
		const user = getStoredUser();
		if (!user) {
			throw redirect({ to: "/" });
		}
		if (user.role !== "admin") {
			throw redirect({ to: "/" });
		}
	},
	component: AdminLayout,
});

const NAV: { to: string; label: string; icon: keyof typeof I; exact?: boolean }[] = [
	{ to: "/admin", label: "Overview", icon: "trend", exact: true },
	{ to: "/admin/users", label: "Users", icon: "social" },
	{ to: "/admin/routes", label: "Routes", icon: "route" },
	{ to: "/admin/seeding", label: "Seeding", icon: "globe" },
	{ to: "/admin/system", label: "System", icon: "sliders" },
];

function AdminLayout() {
	const { theme, accent, toggleTheme } = useUiStore();
	const { isMobile } = useViewport();

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
	}, [theme]);

	return (
		<div
			data-redesign
			data-accent={accent}
			className={theme === "dark" ? "dark" : undefined}
			style={{
				position: "fixed",
				inset: 0,
				display: "flex",
				flexDirection: isMobile ? "column" : "row",
				background: RDS_COLORS.bgCanvas,
				color: RDS_COLORS.fg,
				overflow: "hidden",
			}}
		>
			{isMobile ? (
				<MobileAdminNav theme={theme} toggleTheme={toggleTheme} />
			) : (
				<DesktopAdminNav theme={theme} toggleTheme={toggleTheme} />
			)}
			<main style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
				<div
					style={{
						maxWidth: 1100,
						margin: "0 auto",
						padding: isMobile ? "16px 14px calc(var(--rds-safe-bottom, 0px) + 24px)" : "40px 32px",
					}}
				>
					<Outlet />
				</div>
			</main>
		</div>
	);
}

function DesktopAdminNav({ theme, toggleTheme }: { theme: "light" | "dark"; toggleTheme: () => void }) {
	return (
		<aside
			style={{
				width: 220,
				flexShrink: 0,
				background: RDS_COLORS.bgRail,
				borderRight: `1px solid ${RDS_COLORS.border}`,
				display: "flex",
				flexDirection: "column",
				padding: "20px 14px",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px 16px" }}>
				<I.shield size={18} />
				<SecTitle>Admin</SecTitle>
			</div>
			<nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
				{NAV.map((item) => {
					const Icon = I[item.icon];
					return (
						<Link
							key={item.to}
							to={item.to}
							activeOptions={{ exact: item.exact ?? false }}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								padding: "8px 10px",
								borderRadius: "var(--rds-radius-sm)",
								fontSize: 13,
								fontWeight: 500,
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
								const isActive = e.currentTarget.dataset.status === "active";
								if (!isActive) {
									e.currentTarget.style.background = "transparent";
									e.currentTarget.style.color = RDS_COLORS.fgMuted;
								}
							}}
						>
							<Icon size={16} />
							{item.label}
						</Link>
					);
				})}
			</nav>
			<div style={{ flex: 1 }} />
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 8,
					paddingTop: 12,
					borderTop: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<Link
					to="/"
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 6,
						padding: "6px 8px",
						borderRadius: "var(--rds-radius-sm)",
						fontSize: 12,
						color: RDS_COLORS.fgSubtle,
						textDecoration: "none",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.color = RDS_COLORS.fg;
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.color = RDS_COLORS.fgSubtle;
					}}
				>
					<I.chevronL size={14} />
					Back to app
				</Link>
				<IconBtn title="Toggle theme" onClick={toggleTheme} style={{ width: 28, height: 28 }}>
					{theme === "dark" ? <I.sun size={15} /> : <I.moon size={15} />}
				</IconBtn>
			</div>
		</aside>
	);
}

function MobileAdminNav({ theme, toggleTheme }: { theme: "light" | "dark"; toggleTheme: () => void }) {
	return (
		<header
			style={{
				flexShrink: 0,
				background: RDS_COLORS.bgRail,
				borderBottom: `1px solid ${RDS_COLORS.border}`,
				display: "flex",
				flexDirection: "column",
				paddingTop: "var(--rds-safe-top, 0px)",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					padding: "10px 12px",
				}}
			>
				<Link
					to="/"
					aria-label="Back to app"
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
				>
					<I.chevronL size={16} />
				</Link>
				<I.shield size={16} />
				<SecTitle>Admin</SecTitle>
				<div style={{ flex: 1 }} />
				<IconBtn title="Toggle theme" onClick={toggleTheme} style={{ width: 32, height: 32 }}>
					{theme === "dark" ? <I.sun size={16} /> : <I.moon size={16} />}
				</IconBtn>
			</div>
			<nav
				style={{
					display: "flex",
					gap: 4,
					padding: "4px 8px 8px",
					overflowX: "auto",
					WebkitOverflowScrolling: "touch",
					scrollbarWidth: "none",
				}}
			>
				{NAV.map((item) => {
					const Icon = I[item.icon];
					return (
						<Link
							key={item.to}
							to={item.to}
							activeOptions={{ exact: item.exact ?? false }}
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 6,
								padding: "8px 12px",
								borderRadius: 999,
								fontSize: 13,
								fontWeight: 500,
								color: RDS_COLORS.fgMuted,
								background: "transparent",
								textDecoration: "none",
								whiteSpace: "nowrap",
								flexShrink: 0,
							}}
							activeProps={{
								style: {
									background: RDS_COLORS.accentSoft,
									color: RDS_COLORS.accent,
								},
							}}
						>
							<Icon size={14} />
							{item.label}
						</Link>
					);
				})}
			</nav>
		</header>
	);
}
