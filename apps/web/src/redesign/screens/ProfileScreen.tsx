import { I } from "../components/icons";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";

const STATS = [
	{ label: "Public routes", value: "47" },
	{ label: "Total km", value: "2,148" },
	{ label: "Followers", value: "182" },
	{ label: "Following", value: "94" },
];

const ROUTES = [
	{ name: "Schelde loop — long", distance: "12.4 km", likes: 24 },
	{ name: "Hingene castle ride", distance: "18.6 km", likes: 11 },
	{ name: "Buisstraat → museum", distance: "8.6 km", likes: 7 },
	{ name: "Saturday long", distance: "42.1 km", likes: 31 },
	{ name: "Sint-Amands recovery", distance: "3.6 km", likes: 4 },
	{ name: "Tempo intervals", distance: "7.8 km", likes: 9 },
];

export function ProfileScreen() {
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background: RDS_COLORS.bgCanvas,
				overflow: "auto",
			}}
		>
			<div
				style={{
					height: 180,
					background: `linear-gradient(135deg, ${RDS_COLORS.accent}, oklch(0.65 0.15 200))`,
					position: "relative",
				}}
			/>
			<div style={{ maxWidth: 880, margin: "0 auto", padding: "0 24px" }}>
				<div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginTop: -56 }}>
					<div
						style={{
							width: 112,
							height: 112,
							borderRadius: 999,
							background: `linear-gradient(135deg, ${RDS_COLORS.accent}, oklch(0.65 0.15 200))`,
							color: "white",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: 36,
							fontWeight: 600,
							border: `4px solid ${RDS_COLORS.bgCanvas}`,
							flexShrink: 0,
						}}
					>
						RV
					</div>
					<div style={{ display: "flex", flexDirection: "column", flex: 1, paddingBottom: 8 }}>
						<h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: -0.4 }}>Robbe Verhelst</h1>
						<div
							className="rds-mono"
							style={{
								display: "flex",
								gap: 8,
								fontSize: 12,
								color: RDS_COLORS.fgMuted,
								marginTop: 6,
							}}
						>
							<span>@robbe</span>
							<span>·</span>
							<span>Sint-Amands, BE</span>
							<span>·</span>
							<span>Member since 2024</span>
						</div>
					</div>
					<Btn variant="primary">
						<I.plus size={14} /> Follow
					</Btn>
					<Btn>
						<I.share size={14} />
					</Btn>
				</div>

				<p
					style={{
						marginTop: 18,
						fontSize: 14,
						color: RDS_COLORS.fgMuted,
						maxWidth: 540,
						lineHeight: 1.55,
					}}
				>
					Cycling the Schelde, mostly recovery rides. Occasionally trail running. Sharing my favourite loops around
					Bornem and Hingene.
				</p>

				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(4, 1fr)",
						marginTop: 24,
						padding: 20,
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 14,
					}}
				>
					{STATS.map((s, i) => (
						<div
							key={s.label}
							style={{
								borderLeft: i ? `1px solid ${RDS_COLORS.border}` : "none",
								paddingLeft: i ? 18 : 0,
							}}
						>
							<SecTitle>{s.label}</SecTitle>
							<div className="rds-mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
								{s.value}
							</div>
						</div>
					))}
				</div>

				<div
					style={{
						display: "flex",
						gap: 4,
						marginTop: 28,
						borderBottom: `1px solid ${RDS_COLORS.border}`,
					}}
				>
					{["Public routes", "Activity", "About"].map((t, i) => (
						<button
							key={t}
							type="button"
							style={{
								padding: "10px 14px",
								border: 0,
								background: "transparent",
								fontSize: 13,
								fontWeight: 500,
								color: i === 0 ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
								borderBottom: i === 0 ? `2px solid ${RDS_COLORS.accent}` : "2px solid transparent",
								marginBottom: -1,
								cursor: "pointer",
							}}
						>
							{t}
						</button>
					))}
				</div>

				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
						gap: 14,
						marginTop: 18,
						paddingBottom: 32,
					}}
				>
					{ROUTES.map((r, i) => (
						<div
							key={r.name}
							style={{
								background: RDS_COLORS.bgPanel,
								border: `1px solid ${RDS_COLORS.border}`,
								borderRadius: 12,
								overflow: "hidden",
							}}
						>
							<div style={{ height: 110, background: RDS_COLORS.bgInput, position: "relative" }}>
								<svg
									viewBox="0 0 240 110"
									style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
									aria-hidden="true"
								>
									<path
										d={`M 30 ${80 + (i % 3) * 5} Q ${80 + i * 4} ${20 + (i % 4) * 6}, ${130 + i * 3} 60 T ${210 - i} 30`}
										stroke="var(--rds-accent)"
										strokeWidth="2"
										fill="none"
										strokeLinecap="round"
									/>
								</svg>
							</div>
							<div style={{ padding: 12 }}>
								<div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
								<div
									className="rds-mono"
									style={{
										display: "flex",
										gap: 8,
										fontSize: 11,
										color: RDS_COLORS.fgSubtle,
										marginTop: 4,
									}}
								>
									<span>{r.distance}</span>
									<span>·</span>
									<span>
										<I.heart size={10} /> {r.likes}
									</span>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
