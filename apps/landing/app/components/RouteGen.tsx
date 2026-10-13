import { landingAccents } from "@routess/design-tokens";
import type { Dict } from "@/lib/content";
import routegenLoop from "../../public/previews/routegen-loop.webp";
import { AccentInline } from "./AccentText";
import { BakedImage } from "./BakedImage";

export function RouteGen({ dict }: { dict: Dict }) {
	return (
		<section style={{ background: "var(--paper-2)" }}>
			<div className="container-x">
				<div
					className="grid-2"
					style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}
				>
					<div className="reveal">
						<span className="eyebrow">{dict.routegen.eyebrow}</span>
						<h2 className="display" style={{ fontSize: "clamp(36px, 4.4vw, 64px)", margin: "14px 0 18px" }}>
							<AccentInline pieces={dict.routegen.title} color="var(--terracotta)" />
						</h2>
						<p className="body-lg" style={{ marginBottom: 28 }}>
							{dict.routegen.body}
						</p>
						<ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
							{dict.routegen.bullets.map((t) => (
								<li key={t} style={{ display: "flex", gap: 10, alignItems: "center", color: "var(--ink-soft)" }}>
									<span
										style={{
											width: 18,
											height: 18,
											borderRadius: "50%",
											background: "var(--moss)",
											display: "inline-flex",
											alignItems: "center",
											justifyContent: "center",
											color: "white",
											fontSize: 11,
										}}
										aria-hidden="true"
									>
										✓
									</span>
									{t}
								</li>
							))}
						</ul>
					</div>

					<div className="reveal" style={{ position: "relative", "--reveal-delay": "120ms" } as React.CSSProperties}>
						<div className="card" style={{ padding: 28, position: "relative", overflow: "hidden" }}>
							<div className="eyebrow" style={{ marginBottom: 14 }}>
								{dict.routegen.formTitle}
							</div>
							<dl
								style={{
									margin: 0,
									padding: "6px 18px",
									borderRadius: 12,
									background: "var(--paper-2)",
									border: "1px dashed var(--line)",
								}}
							>
								{dict.routegen.formFields.map((f) => (
									<div
										key={f.label}
										style={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
											gap: 12,
											padding: "8px 0",
										}}
									>
										<dt style={{ color: "var(--ink-soft)" }}>{f.label}</dt>
										<dd
											className="chip"
											style={{ margin: 0, background: "var(--moss-soft)", borderColor: "transparent" }}
										>
											{f.value}
										</dd>
									</div>
								))}
							</dl>
							<button
								type="button"
								className="btn btn-indigo"
								style={{ width: "100%", marginTop: 18, justifyContent: "center" }}
							>
								{dict.routegen.generateBtn}
							</button>

							<div
								style={{
									marginTop: 20,
									height: 160,
									borderRadius: 12,
									overflow: "hidden",
									position: "relative",
									background: landingAccents.cream,
								}}
							>
								{/* Real map tiles: a loop routed via Mapbox Directions, baked
								   by `bun run screenshots`. */}
								<BakedImage
									src={routegenLoop}
									style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
