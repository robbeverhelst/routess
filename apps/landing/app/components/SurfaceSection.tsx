import Image from "next/image";
import type { Dict } from "@/lib/content";
import { AccentInline } from "./AccentText";

// The app's surface-breakdown colors (apps/web/src/components/RouteProfileChart.tsx).
const BUCKET_COLORS = ["oklch(0.55 0.025 240)", "oklch(0.72 0.07 75)", "oklch(0.6 0.11 50)", "oklch(0.62 0.13 145)"];

export function SurfaceSection({ dict }: { dict: Dict }) {
	const buckets = dict.surface.buckets;
	return (
		<section style={{ background: "var(--ink)", color: "var(--paper)", overflow: "hidden" }}>
			<div className="container-x">
				<div className="section-header reveal" style={{ color: "var(--paper)" }}>
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
					<div className="reveal">
						<div style={{ display: "flex", height: 22, borderRadius: 12, overflow: "hidden", marginBottom: 32 }}>
							{buckets.map((s, i) => (
								<div
									key={s.name}
									className="surface-seg"
									style={
										{
											flex: s.pct,
											background: BUCKET_COLORS[i] ?? "var(--ink)",
											borderRight: i < buckets.length - 1 ? "2px solid var(--ink)" : "none",
											"--seg-delay": `${i * 120}ms`,
										} as React.CSSProperties
									}
								/>
							))}
						</div>
						<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
							{buckets.map((s, i) => (
								<div
									key={s.name}
									style={{ display: "grid", gridTemplateColumns: "16px 110px 1fr", gap: 16, alignItems: "center" }}
								>
									<span
										style={{ width: 10, height: 10, borderRadius: 3, background: BUCKET_COLORS[i] ?? "var(--ink)" }}
									/>
									<span style={{ fontWeight: 600 }}>{s.name}</span>
									<span style={{ color: "oklch(0.78 0.01 80)", fontSize: 14 }}>{s.desc}</span>
								</div>
							))}
						</div>
					</div>
					<div className="reveal" style={{ "--reveal-delay": "120ms" } as React.CSSProperties}>
						<div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
							<span className="eyebrow" style={{ color: "oklch(0.78 0.04 80)" }}>
								{dict.surface.elevationLabel}
							</span>
							<span className="mono" style={{ fontSize: 12, color: "oklch(0.78 0.04 80)" }}>
								{dict.surface.elevationStats}
							</span>
						</div>
						{/* The real plan panel (elevation profile + surface strip), captured
						   from the app by `bun run screenshots`. */}
						<div
							style={{
								borderRadius: 14,
								overflow: "hidden",
								border: "1px solid oklch(1 0 0 / 0.14)",
								boxShadow: "0 30px 60px oklch(0 0 0 / 0.4)",
								maxWidth: 380,
								height: 460,
							}}
						>
							<Image
								src="/app-panel.png"
								alt=""
								width={720}
								height={1120}
								sizes="(max-width: 900px) 100vw, 380px"
								style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
							/>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
