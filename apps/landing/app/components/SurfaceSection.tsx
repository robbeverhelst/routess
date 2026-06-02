import type { Dict } from "@/lib/content";
import { AccentInline } from "./AccentText";

const BUCKET_COLORS = ["var(--ink)", "var(--sun)", "var(--terracotta)", "var(--moss)"];

function ElevationChart() {
	const points = [2, 4, 3, 5, 7, 6, 9, 12, 8, 10, 14, 11, 9, 12, 13, 10, 8, 11, 9, 7, 5, 8, 6, 4, 3, 5, 4, 3, 2];
	const W = 500;
	const H = 160;
	const max = Math.max(...points);
	const stepX = W / (points.length - 1);
	const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${H - (p / max) * (H - 20)}`).join(" ");
	const fill = `${path} L ${W} ${H} L 0 ${H} Z`;
	return (
		<svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 160 }} aria-hidden="true">
			<defs>
				<linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="var(--sun)" stopOpacity="0.6" />
					<stop offset="100%" stopColor="var(--sun)" stopOpacity="0.05" />
				</linearGradient>
			</defs>
			<path d={fill} fill="url(#elevGrad)" />
			<path d={path} stroke="var(--sun)" strokeWidth="2.5" fill="none" />
		</svg>
	);
}

export function SurfaceSection({ dict }: { dict: Dict }) {
	const buckets = dict.surface.buckets;
	return (
		<section style={{ background: "var(--ink)", color: "var(--paper)", overflow: "hidden" }}>
			<div className="container-x">
				<div className="section-header" style={{ color: "var(--paper)" }}>
					<span className="eyebrow" style={{ color: "oklch(0.78 0.04 80)" }}>
						{dict.surface.eyebrow}
					</span>
					<h2 className="display" style={{ color: "var(--paper)" }}>
						<AccentInline pieces={dict.surface.title} color="var(--sun)" />
					</h2>
					<p className="body-lg" style={{ color: "oklch(0.85 0.01 80)" }}>
						{dict.surface.body}
					</p>
				</div>

				<div
					className="grid-2"
					style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}
				>
					<div>
						<div style={{ display: "flex", height: 22, borderRadius: 12, overflow: "hidden", marginBottom: 32 }}>
							{buckets.map((s, i) => (
								<div
									key={s.name}
									style={{
										flex: s.pct,
										background: BUCKET_COLORS[i] ?? "var(--ink)",
										borderRight: i < buckets.length - 1 ? "2px solid var(--ink)" : "none",
									}}
								/>
							))}
						</div>
						<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
							{buckets.map((s, i) => (
								<div
									key={s.name}
									style={{ display: "grid", gridTemplateColumns: "16px 110px 60px 1fr", gap: 16, alignItems: "center" }}
								>
									<span
										style={{ width: 10, height: 10, borderRadius: 3, background: BUCKET_COLORS[i] ?? "var(--ink)" }}
									/>
									<span style={{ fontWeight: 600 }}>{s.name}</span>
									<span className="mono" style={{ color: "var(--sun)", fontWeight: 600 }}>
										{s.pct}%
									</span>
									<span style={{ color: "oklch(0.78 0.01 80)", fontSize: 14 }}>{s.desc}</span>
								</div>
							))}
						</div>
					</div>
					<div>
						<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
							<span className="eyebrow" style={{ color: "oklch(0.78 0.04 80)" }}>
								{dict.surface.elevationLabel}
							</span>
							<span className="mono" style={{ fontSize: 12, color: "oklch(0.78 0.04 80)" }}>
								{dict.surface.elevationStats}
							</span>
						</div>
						<ElevationChart />
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								marginTop: 8,
								fontSize: 11,
								color: "oklch(0.7 0.01 80)",
								fontFamily: "var(--font-mono)",
							}}
						>
							<span>0 km</span>
							<span>7</span>
							<span>14</span>
							<span>21</span>
							<span>28.5 km</span>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
