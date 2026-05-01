import { I } from "../components/icons";
import { MapBackdrop } from "../components/MapBackdrop";
import { Badge, Btn, IconBtn, RDS_COLORS } from "../components/primitives";

const NAV = [
	{ icon: I.route, label: "Plan", badge: "Active route" },
	{ icon: I.library, label: "Library", badge: "24" },
	{ icon: I.activity, label: "Activity" },
	{ icon: I.trophy, label: "Achievements", badge: "+2 new", accent: true },
	{ icon: I.user, label: "Profile" },
	{ icon: I.settings, label: "Settings" },
];

export function MobileDrawer({ onClose }: { onClose?: () => void }) {
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
					<div
						style={{
							width: 44,
							height: 44,
							borderRadius: 999,
							background: `linear-gradient(135deg, ${RDS_COLORS.accent}, oklch(0.65 0.15 200))`,
							color: "white",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: 14,
							fontWeight: 600,
						}}
					>
						RV
					</div>
					<div style={{ display: "flex", flexDirection: "column" }}>
						<div style={{ fontSize: 14, fontWeight: 600 }}>Robbe Verhelst</div>
						<div style={{ fontSize: 12, color: RDS_COLORS.fgSubtle }}>robbe@example.com</div>
					</div>
					<div style={{ flex: 1 }} />
					<IconBtn title="Close" onClick={onClose}>
						<I.close size={14} />
					</IconBtn>
				</div>
				{NAV.map((r, i) => {
					const Icon = r.icon;
					return (
						<button
							key={r.label}
							type="button"
							style={{
								display: "flex",
								alignItems: "center",
								gap: 12,
								padding: "14px 18px",
								textAlign: "left",
								border: 0,
								background: i === 0 ? RDS_COLORS.bgActive : "transparent",
								borderLeft: i === 0 ? `3px solid ${RDS_COLORS.accent}` : "3px solid transparent",
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
					<Btn style={{ flex: 1 }}>
						<I.moon size={14} /> Dark
					</Btn>
					<Btn style={{ flex: 1 }}>
						<I.bell size={14} /> Alerts
					</Btn>
				</div>
			</aside>
		</div>
	);
}
