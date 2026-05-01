import { I } from "../components/icons";
import { Badge, Btn, RDS_COLORS, SecTitle } from "../components/primitives";

const STATS = [
	{ label: "Distance", value: "12.4", unit: "km" },
	{ label: "Time", value: "1:04", unit: "h" },
	{ label: "Avg pace", value: "27.3", unit: "km/h" },
	{ label: "Elev", value: "186", unit: "m" },
];

const SPLITS = [
	{ km: "1", time: "2:18", pace: "26.1 km/h", bar: 70 },
	{ km: "2", time: "2:14", pace: "26.9 km/h", bar: 75 },
	{ km: "3", time: "2:08", pace: "28.1 km/h", bar: 86, fastest: true },
	{ km: "4", time: "2:21", pace: "25.5 km/h", bar: 64 },
	{ km: "5", time: "2:26", pace: "24.7 km/h", bar: 58 },
];

const PRS = [
	{ label: "PR", value: "Heidestraat climb" },
	{ label: "+1", value: "achievement" },
	{ label: "Top 8%", value: "this segment" },
];

export function PostActivityScreen() {
	return (
		<div style={{ position: "absolute", inset: 0, background: RDS_COLORS.bgCanvas, overflow: "auto" }}>
			<div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 80px" }}>
				<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
					<Badge variant="accent" dot>
						Saved
					</Badge>
					<span className="rds-mono" style={{ fontSize: 12, color: RDS_COLORS.fgSubtle }}>
						Apr 28 · 09:42 → 10:51
					</span>
				</div>
				<h1 style={{ fontSize: 30, fontWeight: 600, margin: 0, letterSpacing: -0.6 }}>
					Morning ride along the Schelde
				</h1>
				<p style={{ fontSize: 14, color: RDS_COLORS.fgMuted, margin: "6px 0 0" }}>
					You finished the route. Personal best on segment <strong>Heidestraat climb</strong>.
				</p>

				{/* Hero map */}
				<div
					style={{
						marginTop: 24,
						height: 220,
						borderRadius: 14,
						border: `1px solid ${RDS_COLORS.border}`,
						overflow: "hidden",
						position: "relative",
						background: RDS_COLORS.bgInput,
					}}
				>
					<svg
						viewBox="0 0 600 220"
						style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
						aria-hidden="true"
					>
						<path
							d="M 80 180 Q 180 60, 280 130 T 480 90 Q 540 80, 540 50"
							stroke="var(--rds-accent)"
							strokeWidth="3.5"
							fill="none"
							strokeLinecap="round"
						/>
						<circle cx="80" cy="180" r="7" fill="var(--rds-success)" stroke="white" strokeWidth="2.5" />
						<circle cx="540" cy="50" r="7" fill="var(--rds-danger)" stroke="white" strokeWidth="2.5" />
					</svg>
				</div>

				{/* PR strip */}
				<div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
					{PRS.map((p) => (
						<div
							key={p.label}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								padding: "8px 12px",
								background: RDS_COLORS.accentSoft,
								color: RDS_COLORS.accent,
								borderRadius: 999,
							}}
						>
							<I.zap size={12} />
							<span style={{ fontSize: 12.5, fontWeight: 600 }}>{p.label}</span>
							<span style={{ fontSize: 12.5, opacity: 0.85 }}>{p.value}</span>
						</div>
					))}
				</div>

				{/* Big stats */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(4, 1fr)",
						marginTop: 18,
						padding: 18,
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
							<div className="rds-mono" style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>
								{s.value}
								<span
									style={{
										fontSize: 11,
										color: RDS_COLORS.fgSubtle,
										marginLeft: 3,
										fontWeight: 400,
									}}
								>
									{s.unit}
								</span>
							</div>
						</div>
					))}
				</div>

				{/* Splits */}
				<div style={{ marginTop: 24 }}>
					<SecTitle style={{ marginBottom: 10 }}>Splits</SecTitle>
					<div
						style={{
							background: RDS_COLORS.bgPanel,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 12,
							overflow: "hidden",
						}}
					>
						{SPLITS.map((s, i) => (
							<div
								key={s.km}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 12,
									padding: "10px 14px",
									borderBottom: i < SPLITS.length - 1 ? `1px solid ${RDS_COLORS.border}` : "none",
								}}
							>
								<div className="rds-mono" style={{ fontSize: 12, color: RDS_COLORS.fgSubtle, width: 28 }}>
									km {s.km}
								</div>
								<div
									style={{
										flex: 1,
										height: 16,
										background: RDS_COLORS.bgInput,
										borderRadius: 4,
										overflow: "hidden",
									}}
								>
									<div
										style={{
											height: "100%",
											width: `${s.bar}%`,
											background: s.fastest ? RDS_COLORS.accent : RDS_COLORS.borderStrong,
										}}
									/>
								</div>
								<div className="rds-mono" style={{ fontSize: 12, fontWeight: 600, width: 56, textAlign: "right" }}>
									{s.time}
								</div>
								<div
									className="rds-mono"
									style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, width: 80, textAlign: "right" }}
								>
									{s.pace}
								</div>
								{s.fastest && (
									<Badge variant="accent" style={{ fontSize: 10 }}>
										fastest
									</Badge>
								)}
							</div>
						))}
					</div>
				</div>

				{/* Notes */}
				<div style={{ marginTop: 24 }}>
					<SecTitle style={{ marginBottom: 8 }}>Notes</SecTitle>
					<textarea
						defaultValue="Headwind on the way out, tailwind back. Legs felt fresh."
						style={{
							width: "100%",
							height: 80,
							padding: 12,
							background: RDS_COLORS.bgInput,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 8,
							color: RDS_COLORS.fg,
							fontSize: 13.5,
							resize: "vertical",
							outline: "none",
							fontFamily: "inherit",
						}}
						placeholder="How did it feel?"
					/>
				</div>

				{/* Actions */}
				<div style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
					<Btn variant="primary">
						<I.share size={14} /> Share
					</Btn>
					<Btn>
						<I.download size={14} /> Export GPX
					</Btn>
					<Btn>
						<I.zap size={14} /> Add photos
					</Btn>
					<div style={{ flex: 1 }} />
					<Btn variant="ghost" style={{ color: RDS_COLORS.danger }}>
						<I.trash size={14} /> Discard
					</Btn>
				</div>
			</div>
		</div>
	);
}
