import { I } from "../components/icons";
import { Btn, IconBtn, RDS_COLORS } from "../components/primitives";

const A = { name: "Schelde loop — long", distance: "12.4", time: "1:04", elev: "186", pace: "27.3" };
const B = { name: "Hingene castle ride", distance: "18.6", time: "1:32", elev: "242", pace: "26.1" };

const ROWS: { label: string; av: string; bv: string; unit: string; better: "a" | "b" }[] = [
	{ label: "Distance", av: A.distance, bv: B.distance, unit: "km", better: "b" },
	{ label: "Time", av: A.time, bv: B.time, unit: "h", better: "a" },
	{ label: "Elev gain", av: A.elev, bv: B.elev, unit: "m", better: "a" },
	{ label: "Avg speed", av: A.pace, bv: B.pace, unit: "km/h", better: "a" },
];

export function CompareScreen({ onClose }: { onClose?: () => void }) {
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background: RDS_COLORS.bgCanvas,
				overflow: "auto",
			}}
		>
			<div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 24px" }}>
				<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
					<IconBtn title="Back" onClick={onClose}>
						<I.chevronL size={16} />
					</IconBtn>
					<h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>Compare routes</h1>
					<div style={{ flex: 1 }} />
					<Btn>
						<I.swap size={14} /> Swap
					</Btn>
					<Btn>
						<I.share size={14} /> Share comparison
					</Btn>
				</div>

				{/* Map overlay */}
				<div
					style={{
						height: 280,
						borderRadius: 14,
						border: `1px solid ${RDS_COLORS.border}`,
						overflow: "hidden",
						position: "relative",
						background: RDS_COLORS.bgInput,
					}}
				>
					<svg
						viewBox="0 0 880 280"
						style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
						aria-hidden="true"
					>
						<path
							d="M 60 220 Q 200 80, 360 160 T 700 100 Q 760 90, 800 70"
							stroke="var(--rds-accent)"
							strokeWidth="3"
							fill="none"
							strokeLinecap="round"
							opacity="0.85"
						/>
						<path
							d="M 60 220 Q 240 140, 380 220 T 720 160 Q 800 150, 820 110"
							stroke="oklch(0.62 0.18 30)"
							strokeWidth="3"
							fill="none"
							strokeLinecap="round"
							strokeDasharray="6 4"
							opacity="0.85"
						/>
						<circle cx="60" cy="220" r="6" fill="var(--rds-success)" stroke="white" strokeWidth="2" />
					</svg>
					<div
						style={{
							position: "absolute",
							left: 12,
							top: 12,
							display: "flex",
							flexDirection: "column",
							gap: 6,
						}}
					>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								padding: "6px 10px",
								background: RDS_COLORS.bgPanel,
								borderRadius: 999,
								border: `1px solid ${RDS_COLORS.border}`,
								fontSize: 12,
							}}
						>
							<div style={{ width: 12, height: 2, background: "var(--rds-accent)" }} /> A · {A.name}
						</div>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								padding: "6px 10px",
								background: RDS_COLORS.bgPanel,
								borderRadius: 999,
								border: `1px solid ${RDS_COLORS.border}`,
								fontSize: 12,
							}}
						>
							<div
								style={{
									width: 12,
									height: 2,
									backgroundImage: "linear-gradient(to right, oklch(0.62 0.18 30) 50%, transparent 50%)",
									backgroundSize: "4px 2px",
								}}
							/>{" "}
							B · {B.name}
						</div>
					</div>
				</div>

				{/* Stat table */}
				<div
					style={{
						marginTop: 22,
						padding: "0 20px",
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 12,
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							padding: "14px 0",
							borderBottom: `1px solid ${RDS_COLORS.border}`,
						}}
					>
						<div style={{ width: 100 }} />
						<div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{A.name}</div>
						<div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{B.name}</div>
					</div>
					{ROWS.map((r) => (
						<div
							key={r.label}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 12,
								padding: "12px 0",
								borderBottom: `1px solid ${RDS_COLORS.border}`,
							}}
						>
							<div style={{ width: 100, fontSize: 12, color: RDS_COLORS.fgMuted }}>{r.label}</div>
							<div
								className="rds-mono"
								style={{
									flex: 1,
									fontSize: 16,
									fontWeight: 600,
									color: r.better === "a" ? RDS_COLORS.accent : RDS_COLORS.fg,
									display: "flex",
									alignItems: "center",
									gap: 6,
								}}
							>
								{r.av}
								<span
									style={{
										fontSize: 10,
										color: RDS_COLORS.fgSubtle,
										marginLeft: 3,
										fontWeight: 400,
									}}
								>
									{r.unit}
								</span>
								{r.better === "a" && <I.zap size={12} />}
							</div>
							<div
								className="rds-mono"
								style={{
									flex: 1,
									fontSize: 16,
									fontWeight: 600,
									color: r.better === "b" ? RDS_COLORS.accent : RDS_COLORS.fg,
									display: "flex",
									alignItems: "center",
									gap: 6,
								}}
							>
								{r.bv}
								<span
									style={{
										fontSize: 10,
										color: RDS_COLORS.fgSubtle,
										marginLeft: 3,
										fontWeight: 400,
									}}
								>
									{r.unit}
								</span>
								{r.better === "b" && <I.zap size={12} />}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
