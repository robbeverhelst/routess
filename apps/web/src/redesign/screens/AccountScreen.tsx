import { Badge, Btn, RDS_COLORS, SecTitle } from "../components/primitives";

const USAGE = [
	{ label: "Saved routes", current: 38, max: 50 },
	{ label: "GPX exports", current: 6, max: 10 },
	{ label: "Offline regions", current: 0, max: 0, locked: true },
];

const ACCOUNT_FIELDS = [
	{ label: "Email", value: "robbe@example.com" },
	{ label: "Username", value: "robbe" },
	{ label: "Password", value: "Last changed 14 days ago" },
	{ label: "Two-factor", value: "Enabled" },
	{ label: "Connected", value: "Strava, Garmin Connect" },
];

export function AccountScreen() {
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background: RDS_COLORS.bgCanvas,
				overflow: "auto",
			}}
		>
			<div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
				<SecTitle>Settings</SecTitle>
				<h1 style={{ fontSize: 26, fontWeight: 600, margin: "4px 0 0", letterSpacing: -0.5 }}>Account & billing</h1>

				{/* Plan card */}
				<div
					style={{
						marginTop: 24,
						padding: 22,
						borderRadius: 14,
						border: `1px solid ${RDS_COLORS.accent}`,
						background: `linear-gradient(135deg, ${RDS_COLORS.accentSoft}, transparent)`,
						position: "relative",
						overflow: "hidden",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
						<Badge variant="accent">Free</Badge>
						<span style={{ fontSize: 12, color: RDS_COLORS.fgMuted }}>You're on the free plan</span>
					</div>
					<div style={{ display: "flex", alignItems: "flex-end", gap: 18 }}>
						<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
							<h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>Upgrade to Routess Pro</h2>
							<p
								style={{
									fontSize: 13,
									color: RDS_COLORS.fgMuted,
									margin: "6px 0 0",
									lineHeight: 1.5,
								}}
							>
								Unlimited routes, offline maps, advanced training metrics, priority routing, custom map styles.
							</p>
						</div>
						<div style={{ textAlign: "right" }}>
							<div className="rds-mono" style={{ fontSize: 32, fontWeight: 600, lineHeight: 1 }}>
								€7
							</div>
							<div style={{ fontSize: 11, color: RDS_COLORS.fgMuted, marginTop: 2 }}>/ month</div>
						</div>
						<Btn variant="primary" style={{ height: 42, padding: "0 22px" }} disabled title="Pro pricing not yet live">
							Upgrade
						</Btn>
					</div>
				</div>

				{/* Usage */}
				<div
					style={{
						marginTop: 24,
						padding: 20,
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 12,
					}}
				>
					<SecTitle style={{ marginBottom: 12 }}>Usage this month</SecTitle>
					{USAGE.map((u) => (
						<div key={u.label} style={{ marginBottom: 14 }}>
							<div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
								<span style={{ fontSize: 13 }}>{u.label}</span>
								<span style={{ flex: 1 }} />
								<span className="rds-mono" style={{ fontSize: 12, color: RDS_COLORS.fgMuted }}>
									{u.locked ? "Pro only" : `${u.current} / ${u.max}`}
								</span>
							</div>
							<div
								style={{
									height: 6,
									background: RDS_COLORS.bgInput,
									borderRadius: 999,
									overflow: "hidden",
								}}
							>
								<div
									style={{
										height: "100%",
										width: u.locked ? "100%" : `${(u.current / u.max) * 100}%`,
										background: u.locked
											? RDS_COLORS.borderStrong
											: u.current / u.max > 0.8
												? RDS_COLORS.warn
												: RDS_COLORS.accent,
									}}
								/>
							</div>
						</div>
					))}
				</div>

				{/* Account details */}
				<div
					style={{
						marginTop: 24,
						padding: 20,
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 12,
					}}
				>
					<SecTitle style={{ marginBottom: 14 }}>Account</SecTitle>
					{ACCOUNT_FIELDS.map((f, i) => (
						<div
							key={f.label}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 12,
								padding: "10px 0",
								borderBottom: i < ACCOUNT_FIELDS.length - 1 ? `1px solid ${RDS_COLORS.border}` : "none",
							}}
						>
							<div style={{ fontSize: 13, color: RDS_COLORS.fgMuted, width: 110 }}>{f.label}</div>
							<div style={{ flex: 1, fontSize: 13 }}>{f.value}</div>
							<Btn variant="ghost" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>
								Edit
							</Btn>
						</div>
					))}
				</div>

				{/* Danger zone */}
				<div
					style={{
						marginTop: 24,
						padding: 20,
						border: `1px solid color-mix(in oklch, ${RDS_COLORS.danger} 40%, ${RDS_COLORS.border})`,
						borderRadius: 12,
					}}
				>
					<SecTitle style={{ marginBottom: 12, color: RDS_COLORS.danger }}>Danger zone</SecTitle>
					<div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
						<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
							<div style={{ fontSize: 13, fontWeight: 500 }}>Delete account</div>
							<div style={{ fontSize: 12, color: RDS_COLORS.fgMuted, marginTop: 2 }}>
								Permanently delete your account and all routes. This cannot be undone.
							</div>
						</div>
						<Btn
							style={{
								background: "transparent",
								color: RDS_COLORS.danger,
								borderColor: `color-mix(in oklch, ${RDS_COLORS.danger} 40%, ${RDS_COLORS.border})`,
							}}
						>
							Delete
						</Btn>
					</div>
				</div>
			</div>
		</div>
	);
}
