import { landingAccents, surfaceBucketColors } from "@routess/design-tokens";
import Image from "next/image";
import type { Dict } from "@/lib/content";

const SURFACE_FLEX = [46, 13, 38, 3];
// Same surface-breakdown colors as the app's RouteProfileChart.
// Explicit order: paired by index with SURFACE_FLEX and dict.surface.buckets.
const SURFACE_COLORS = [
	surfaceBucketColors.paved,
	surfaceBucketColors.compacted,
	surfaceBucketColors.unpaved,
	surfaceBucketColors.path,
];

export function Sharing({ dict }: { dict: Dict }) {
	const routes = dict.sharing.routes;
	return (
		<section id="community">
			<div className="container-x">
				<div className="section-header reveal">
					<span className="eyebrow">{dict.sharing.eyebrow}</span>
					<h2 className="display">{dict.sharing.title}</h2>
					<p className="body-lg">{dict.sharing.body}</p>
				</div>

				<div
					className="grid-sharing"
					style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 28, alignItems: "start" }}
				>
					<div className="card reveal" style={{ padding: 28 }}>
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
							<h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
								{dict.sharing.myRoutes}{" "}
								<span style={{ color: "var(--muted-color)", fontWeight: 400 }}>· {routes.length}</span>
							</h3>
							<div style={{ display: "flex", gap: 6 }}>
								<span className="chip">{dict.sharing.filters.all}</span>
								<span className="chip" style={{ background: "var(--paper)" }}>
									{dict.sharing.filters.run}
								</span>
								<span className="chip" style={{ background: "var(--paper)" }}>
									{dict.sharing.filters.cycle}
								</span>
							</div>
						</div>
						<div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
							{routes.map((r, i) => {
								return (
									<div
										key={r.name}
										className="card-lift"
										style={{
											border: "1px solid var(--line)",
											borderRadius: 16,
											padding: 16,
											position: "relative",
										}}
									>
										<div
											style={{
												height: 84,
												borderRadius: 10,
												marginBottom: 12,
												position: "relative",
												overflow: "hidden",
												background: landingAccents.cream,
											}}
										>
											{/* Real map tiles: Mapbox Static preview of actual Directions
											   geometry, baked by `bun run screenshots`. */}
											<Image
												src={`/previews/route-${i + 1}.png`}
												alt=""
												width={400}
												height={168}
												sizes="240px"
												style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
											/>
										</div>
										<div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{r.name}</div>
										<div
											style={{
												display: "flex",
												gap: 12,
												fontSize: 12,
												color: "var(--muted-color)",
												fontFamily: "var(--font-mono)",
											}}
										>
											<span>{r.dist}</span>
											<span>·</span>
											<span>{r.time}</span>
											<span>·</span>
											<span>↑{r.elev}</span>
										</div>
										<div style={{ marginTop: 8, height: 4, borderRadius: 2, overflow: "hidden", display: "flex" }}>
											{SURFACE_FLEX.map((flex, s) => (
												<div key={SURFACE_COLORS[s]} style={{ flex, background: SURFACE_COLORS[s] }} />
											))}
										</div>
									</div>
								);
							})}
						</div>
					</div>

					<div
						className="reveal"
						style={
							{ display: "flex", flexDirection: "column", gap: 16, "--reveal-delay": "120ms" } as React.CSSProperties
						}
					>
						<div className="card card-pad">
							<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
								<span
									style={{
										width: 36,
										height: 36,
										borderRadius: 10,
										background: "var(--indigo)",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										color: "white",
									}}
									aria-hidden="true"
								>
									<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
										<path
											d="M13 6l-4-4-4 4M9 2v10M3 12v3a1 1 0 001 1h10a1 1 0 001-1v-3"
											stroke="currentColor"
											strokeWidth="1.6"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</span>
								<div>
									<div style={{ fontWeight: 600 }}>{dict.sharing.shareTitle}</div>
									<div style={{ fontSize: 12, color: "var(--muted-color)" }}>{dict.sharing.shareSubtitle}</div>
								</div>
							</div>
							<div
								style={{
									fontFamily: "var(--font-mono)",
									fontSize: 12,
									padding: "10px 12px",
									background: "var(--paper-2)",
									borderRadius: 10,
									color: "var(--ink-soft)",
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
								}}
							>
								<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
									app.routess.com/?route=eNqrVi…
								</span>
								<button
									type="button"
									style={{
										background: "var(--ink)",
										color: "var(--paper)",
										border: "none",
										padding: "4px 10px",
										borderRadius: 6,
										fontSize: 11,
										cursor: "pointer",
										fontFamily: "inherit",
									}}
								>
									{dict.sharing.copy}
								</button>
							</div>
							<div
								className="grid-share-actions"
								style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}
							>
								{["GPX", "QR", "Email"].map((t) => (
									<button
										key={t}
										type="button"
										style={{
											padding: "10px 0",
											borderRadius: 10,
											border: "1px solid var(--line)",
											background: "var(--paper)",
											fontSize: 12,
											fontWeight: 600,
											cursor: "pointer",
											color: "var(--ink-soft)",
										}}
									>
										{t}
									</button>
								))}
							</div>
						</div>

						<div
							className="card card-pad"
							style={{
								background: "linear-gradient(135deg, var(--terracotta-soft), var(--paper))",
								borderColor: "transparent",
							}}
						>
							<div className="eyebrow" style={{ color: landingAccents.terracottaDeep, marginBottom: 8 }}>
								{dict.sharing.comingSoonEyebrow}
							</div>
							<div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{dict.sharing.comingSoonTitle}</div>
							<p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.5 }}>
								{dict.sharing.comingSoonBody}
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
