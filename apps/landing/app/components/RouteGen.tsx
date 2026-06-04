"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { Dict } from "@/lib/content";
import { AccentInline } from "./AccentText";

export function RouteGen({ dict }: { dict: Dict }) {
	const prompts = dict.routegen.prompts;
	// Typewriter: hold the current prompt, delete it, type the next one.
	const [text, setText] = useState(prompts[0] ?? "");
	useEffect(() => {
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduce || prompts.length < 2) return;
		let idx = 0;
		let pos = (prompts[0] ?? "").length;
		let deleting = true;
		let timer: ReturnType<typeof setTimeout>;
		const tick = () => {
			const full = prompts[idx] ?? "";
			if (deleting) {
				pos = Math.max(0, pos - 3);
				setText(full.slice(0, pos));
				if (pos === 0) {
					deleting = false;
					idx = (idx + 1) % prompts.length;
					timer = setTimeout(tick, 350);
					return;
				}
				timer = setTimeout(tick, 20);
			} else {
				pos += 1;
				setText((prompts[idx] ?? "").slice(0, pos));
				if (pos >= (prompts[idx] ?? "").length) {
					deleting = true;
					timer = setTimeout(tick, 2400);
					return;
				}
				timer = setTimeout(tick, 34);
			}
		};
		timer = setTimeout(tick, 2400);
		return () => clearTimeout(timer);
	}, [prompts]);

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
								<span>{text}</span>
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
									height: 160,
									borderRadius: 12,
									overflow: "hidden",
									position: "relative",
									background: "oklch(0.96 0.03 80)",
								}}
							>
								{/* Real map tiles: a loop routed via Mapbox Directions, baked
								   by `bun run screenshots`. */}
								<Image
									src="/previews/routegen-loop.png"
									alt=""
									width={1280}
									height={560}
									sizes="(max-width: 900px) 100vw, 520px"
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
