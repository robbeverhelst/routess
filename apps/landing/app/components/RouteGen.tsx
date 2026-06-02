"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/lib/content";
import { AccentInline } from "./AccentText";

export function RouteGen({ dict }: { dict: Dict }) {
	const prompts = dict.routegen.prompts;
	const [active, setActive] = useState(0);
	useEffect(() => {
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduce) return;
		const t = setInterval(() => setActive((i) => (i + 1) % prompts.length), 3500);
		return () => clearInterval(t);
	}, [prompts.length]);

	return (
		<section style={{ background: "var(--paper-2)" }}>
			<div className="container-x">
				<div
					className="grid-2"
					style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}
				>
					<div>
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

					<div style={{ position: "relative" }}>
						<div className="card" style={{ padding: 28, position: "relative", overflow: "hidden" }}>
							<div className="eyebrow" style={{ marginBottom: 14 }}>
								{dict.routegen.promptLabel}
							</div>
							<div
								style={{
									fontFamily: "var(--font-mono)",
									fontSize: 17,
									lineHeight: 1.5,
									padding: 18,
									borderRadius: 12,
									background: "var(--paper-2)",
									border: "1px dashed var(--line)",
									minHeight: 80,
									color: "var(--ink)",
								}}
							>
								<span>{prompts[active]}</span>
								<span
									style={{
										display: "inline-block",
										width: 8,
										height: 18,
										background: "var(--indigo)",
										marginLeft: 4,
										verticalAlign: "middle",
										animation: "blink 1s steps(2) infinite",
									}}
								/>
							</div>
							<div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
								<span className="chip" style={{ background: "var(--moss-soft)", borderColor: "transparent" }}>
									~30 km
								</span>
								<span className="chip" style={{ background: "var(--terracotta-soft)", borderColor: "transparent" }}>
									gravel
								</span>
								<span className="chip" style={{ background: "var(--indigo-soft)", borderColor: "transparent" }}>
									loop
								</span>
								<span className="chip" style={{ background: "var(--sun-soft)", borderColor: "transparent" }}>
									low traffic
								</span>
							</div>
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
									height: 140,
									borderRadius: 12,
									overflow: "hidden",
									position: "relative",
									background: "oklch(0.96 0.03 80)",
								}}
							>
								<svg viewBox="0 0 400 140" style={{ width: "100%", height: "100%" }} aria-hidden="true">
									<g stroke="white" strokeWidth="3" fill="none">
										<path d="M0 30 L 400 30" />
										<path d="M0 70 L 400 70" />
										<path d="M0 110 L 400 110" />
										<path d="M80 0 L 80 140" />
										<path d="M200 0 L 200 140" />
										<path d="M320 0 L 320 140" />
									</g>
									<path
										d="M 50 100 Q 130 30, 200 60 T 350 50 Q 320 100, 250 110 T 100 100 Q 60 110, 50 100 Z"
										fill="none"
										stroke="var(--indigo)"
										strokeWidth="3.5"
										strokeLinejoin="round"
									/>
									<circle cx="50" cy="100" r="6" fill="var(--moss)" stroke="white" strokeWidth="2" />
								</svg>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
