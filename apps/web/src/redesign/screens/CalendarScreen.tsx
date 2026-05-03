import { PreviewBanner, RDS_COLORS, SecTitle } from "../components/primitives";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WEEKS = 53;

const HEATMAP_COLORS = [
	"var(--rds-bg-input)",
	"color-mix(in oklch, var(--rds-accent) 22%, var(--rds-bg-input))",
	"color-mix(in oklch, var(--rds-accent) 45%, var(--rds-bg-input))",
	"color-mix(in oklch, var(--rds-accent) 70%, var(--rds-bg-input))",
	"var(--rds-accent)",
];

interface Cell {
	w: number;
	d: number;
	intensity: number;
}

const CELLS: Cell[] = (() => {
	const out: Cell[] = [];
	for (let w = 0; w < WEEKS; w++) {
		for (let d = 0; d < 7; d++) {
			const seed = ((w * 7 + d) * 7919) % 100;
			const intensity = seed < 55 ? 0 : seed < 70 ? 1 : seed < 85 ? 2 : seed < 95 ? 3 : 4;
			out.push({ w, d, intensity });
		}
	}
	return out;
})();

const MONTHLY_DISTANCE = [120, 145, 188, 212, 168, 240, 208, 195, 178, 144, 92, 56];

export function CalendarScreen() {
	const maxMonthly = Math.max(...MONTHLY_DISTANCE);
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				background: RDS_COLORS.bgCanvas,
				overflow: "auto",
			}}
		>
			<div style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 24px" }}>
				<h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>Training year</h1>
				<p style={{ fontSize: 13, color: RDS_COLORS.fgMuted, margin: "4px 0 0" }}>
					2025 · 184 activities · 2,148 km · 12,840 m climbed
				</p>

				<PreviewBanner
					style={{ marginTop: 18 }}
					body="Heatmap and monthly totals use placeholder data. They'll switch to your actual activity once the activities backend is live."
				/>

				{/* Heatmap */}
				<div
					style={{
						marginTop: 28,
						padding: 22,
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 14,
						overflowX: "auto",
					}}
				>
					<svg
						viewBox={`0 0 ${WEEKS * 14 + 30} ${7 * 14 + 30}`}
						style={{ width: "100%", minWidth: 760 }}
						aria-hidden="true"
					>
						{MONTHS.map((m, i) => (
							<text
								key={m}
								x={20 + (i * (WEEKS * 14)) / 12}
								y={12}
								fill="var(--rds-fg-subtle)"
								fontSize="9"
								fontFamily="JetBrains Mono"
							>
								{m}
							</text>
						))}
						{["Mon", "Wed", "Fri"].map((d, i) => (
							<text key={d} x={0} y={32 + i * 28} fill="var(--rds-fg-subtle)" fontSize="9" fontFamily="JetBrains Mono">
								{d}
							</text>
						))}
						{CELLS.map((c) => (
							<rect
								key={`${c.w}_${c.d}`}
								x={20 + c.w * 14}
								y={20 + c.d * 14}
								width="11"
								height="11"
								rx="2"
								fill={HEATMAP_COLORS[c.intensity]}
							/>
						))}
					</svg>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							marginTop: 14,
							fontSize: 11,
							color: RDS_COLORS.fgSubtle,
							justifyContent: "flex-end",
						}}
					>
						<span>Less</span>
						{HEATMAP_COLORS.map((c, i) => (
							<div key={c} data-step={i} style={{ width: 11, height: 11, borderRadius: 2, background: c }} />
						))}
						<span>More</span>
					</div>
				</div>

				{/* Monthly bars */}
				<div
					style={{
						marginTop: 22,
						padding: 22,
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 14,
					}}
				>
					<SecTitle style={{ marginBottom: 14 }}>Monthly distance</SecTitle>
					<div
						style={{
							display: "flex",
							alignItems: "flex-end",
							gap: 8,
							height: 140,
						}}
					>
						{MONTHLY_DISTANCE.map((v, i) => (
							<div
								key={MONTHS[i]}
								style={{
									flex: 1,
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: 6,
								}}
							>
								<div className="rds-mono" style={{ fontSize: 10, color: RDS_COLORS.fgSubtle }}>
									{v}
								</div>
								<div
									style={{
										width: "100%",
										height: (v / maxMonthly) * 110,
										background: i === 5 ? RDS_COLORS.accent : RDS_COLORS.borderStrong,
										borderRadius: 4,
									}}
								/>
								<div className="rds-mono" style={{ fontSize: 10, color: RDS_COLORS.fgSubtle }}>
									{MONTHS[i]}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
