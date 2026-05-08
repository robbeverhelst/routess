import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { I } from "@/components/icons";
import { IconBtn, RDS_COLORS, SecTitle } from "@/components/primitives";
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
	{ to: "/admin/system", label: "System", icon: "sliders" },
];

function AdminLayout() {
	const { theme, accent, toggleTheme } = useUiStore();

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
				background: RDS_COLORS.bgCanvas,
				color: RDS_COLORS.fg,
				overflow: "hidden",
			}}
		>
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
			<main style={{ flex: 1, overflow: "auto" }}>
				<div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px" }}>
					<Outlet />
				</div>
			</main>
		</div>
	);
}
