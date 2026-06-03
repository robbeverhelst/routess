"use client";

import { useMemo, useState } from "react";
import type { Dict } from "@/lib/content";
import { APP_HOST } from "@/lib/i18n";
import { AccentInline } from "./AccentText";
import { ArrowIcon, Dot } from "./Icons";

interface Pt {
	x: number;
	y: number;
}

const W = 640;
const H = 420;

const SURFACES = [
	{ id: "paved", c: "var(--ink)" },
	{ id: "mixed", c: "var(--sun)" },
	{ id: "unpaved", c: "var(--terracotta)" },
] as const;

type SurfaceId = (typeof SURFACES)[number]["id"];

const SVG_TO_LATLNG = (p: Pt) => {
	// Pure illustration: map the SVG point to a plausible Belgian latlng so the
	// "open in app" link can center the real planner there. Numbers are illustrative.
	const lat = 51.04 + (p.y / H) * 0.04;
	const lng = 4.27 + (p.x / W) * 0.08;
	return { lat: lat.toFixed(5), lng: lng.toFixed(5) };
};

export function MiniPlanner({ dict }: { dict: Dict }) {
	const [pts, setPts] = useState<Pt[]>([
		{ x: 80, y: 320 },
		{ x: 250, y: 200 },
		{ x: 420, y: 280 },
	]);
	const [mode, setMode] = useState<keyof Dict["planner"]["modes"]>("run");
	const [surface, setSurface] = useState<SurfaceId>("mixed");

	const path = useMemo(() => {
		const head = pts[0];
		if (!head || pts.length < 2) return "";
		let d = `M ${head.x} ${head.y}`;
		for (let i = 1; i < pts.length; i++) {
			const p = pts[i - 1];
			const n = pts[i];
			if (!p || !n) continue;
			const mx = (p.x + n.x) / 2;
			const my = (p.y + n.y) / 2 - 12;
			d += ` Q ${mx} ${my}, ${n.x} ${n.y}`;
		}
		return d;
	}, [pts]);

	const distance = useMemo(() => {
		let total = 0;
		for (let i = 1; i < pts.length; i++) {
			const p = pts[i - 1];
			const n = pts[i];
			if (!p || !n) continue;
			total += Math.hypot(n.x - p.x, n.y - p.y);
		}
		return (total / 18).toFixed(1);
	}, [pts]);

	const time = useMemo(() => {
		const dist = parseFloat(distance);
		const pace = mode === "run" ? 0.1 : mode === "cycle" ? 0.04 : 0.18;
		return (dist * pace).toFixed(1);
	}, [distance, mode]);

	const onSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
		const svg = e.currentTarget;
		const r = svg.getBoundingClientRect();
		const x = ((e.clientX - r.left) / r.width) * W;
		const y = ((e.clientY - r.top) / r.height) * H;
		setPts((prev) => (prev.length >= 8 ? prev : [...prev, { x, y }]));
	};

	const reset = () =>
		setPts([
			{ x: 80, y: 320 },
			{ x: 250, y: 200 },
			{ x: 420, y: 280 },
		]);

	const openInAppHref = useMemo(() => {
		const base = `https://${APP_HOST}/`;
		const first = pts[0];
		if (!first) return base;
		const { lat, lng } = SVG_TO_LATLNG(first);
		return `${base}?center=${lat},${lng}&zoom=13`;
	}, [pts]);

	return (
		<section id="planner" style={{ background: "var(--paper-2)" }}>
			<div className="container-x">
				<div className="section-header">
					<span className="eyebrow">{dict.planner.eyebrow}</span>
					<h2 className="display">
						<AccentInline pieces={dict.planner.title} />
					</h2>
					<p className="body-lg">{dict.planner.body}</p>
				</div>

				<div className="grid-planner" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
					<div className="card" style={{ overflow: "hidden", padding: 0, position: "relative" }}>
						{/* Decorative mouse-only enhancement; the Reset button and Open-in-app link are the real controls. */}
						<svg
							viewBox={`0 0 ${W} ${H}`}
							onClick={onSvgClick}
							style={{
								width: "100%",
								height: 420,
								display: "block",
								cursor: "crosshair",
								background: "oklch(0.96 0.03 80)",
							}}
							aria-hidden="true"
						>
							<g>
								<rect x="0" y="0" width={W} height={H} fill="oklch(0.96 0.03 80)" />
								<path
									d="M0 100 Q 100 80, 200 110 T 400 90 T 640 120 L 640 0 L 0 0 Z"
									fill="oklch(0.92 0.08 145)"
									opacity="0.55"
								/>
								<path
									d="M380 280 Q 480 260, 560 300 T 700 360 L 700 420 L 380 420 Z"
									fill="oklch(0.86 0.09 230)"
									opacity="0.5"
								/>
								<ellipse cx="180" cy="320" rx="80" ry="40" fill="oklch(0.92 0.08 145)" opacity="0.5" />
							</g>
							<g stroke="white" strokeWidth="6" fill="none">
								<path d="M-20 80 L 200 100 L 400 70 L 660 110" />
								<path d="M-20 200 L 200 230 L 400 200 L 660 240" />
								<path d="M-20 320 L 220 360 L 440 320 L 660 360" />
								<path d="M120 -20 L 100 220 L 140 440" />
								<path d="M340 -20 L 320 200 L 360 440" />
								<path d="M520 -20 L 480 220 L 520 440" />
							</g>
							<g style={{ pointerEvents: "none" }}>
								<path
									d={path}
									stroke="var(--indigo)"
									strokeWidth="5"
									fill="none"
									strokeLinecap="round"
									strokeDasharray={surface === "unpaved" ? "8 6" : "0"}
								/>
								{pts.map((p, i) => (
									<g key={`${p.x.toFixed(2)},${p.y.toFixed(2)}`}>
										<circle cx={p.x} cy={p.y} r="9" fill="white" stroke="var(--indigo)" strokeWidth="2.5" />
										{i === 0 && <circle cx={p.x} cy={p.y} r="5" fill="var(--moss)" />}
										{i === pts.length - 1 && i > 0 && <circle cx={p.x} cy={p.y} r="5" fill="var(--terracotta)" />}
									</g>
								))}
							</g>
						</svg>
						<div style={{ position: "absolute", left: 16, bottom: 16, display: "flex", gap: 8 }}>
							<button
								type="button"
								className="chip"
								onClick={reset}
								style={{ cursor: "pointer", background: "white", border: "1px solid var(--line)" }}
							>
								↻ {dict.planner.reset}
							</button>
							<span className="chip" style={{ background: "white" }}>
								{pts.length} {dict.planner.waypoints}
							</span>
						</div>
						<div style={{ position: "absolute", right: 16, top: 16 }}>
							<span className="chip" style={{ background: "white" }}>
								<Dot color="var(--indigo)" /> {dict.planner.clickHint}
							</span>
						</div>
					</div>

					<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
						<div className="card card-pad">
							<div className="eyebrow" style={{ marginBottom: 10 }}>
								{dict.planner.mode}
							</div>
							<div style={{ display: "flex", gap: 6, padding: 4, background: "var(--paper-2)", borderRadius: 999 }}>
								{(["run", "cycle", "walk"] as const).map((m) => (
									<button
										key={m}
										type="button"
										onClick={() => setMode(m)}
										style={{
											flex: 1,
											height: 36,
											borderRadius: 999,
											border: "none",
											cursor: "pointer",
											fontSize: 13,
											fontWeight: 600,
											background: mode === m ? "var(--ink)" : "transparent",
											color: mode === m ? "var(--paper)" : "var(--ink-soft)",
										}}
									>
										{dict.planner.modes[m]}
									</button>
								))}
							</div>

							<div className="eyebrow" style={{ marginTop: 18, marginBottom: 10 }}>
								{dict.planner.surface}
							</div>
							<div style={{ display: "flex", gap: 6 }}>
								{SURFACES.map((s) => (
									<button
										key={s.id}
										type="button"
										onClick={() => setSurface(s.id)}
										style={{
											flex: 1,
											height: 36,
											borderRadius: 10,
											cursor: "pointer",
											border: surface === s.id ? "2px solid var(--indigo)" : "1.5px solid var(--line)",
											background: "var(--paper)",
											fontSize: 12,
											fontWeight: 600,
											color: "var(--ink-soft)",
											display: "flex",
											flexDirection: "column",
											alignItems: "center",
											justifyContent: "center",
											gap: 3,
											textTransform: "capitalize",
										}}
									>
										<span style={{ width: "70%", height: 4, borderRadius: 2, background: s.c }} />
										{dict.planner.surfaces[s.id]}
									</button>
								))}
							</div>
						</div>

						<div className="card card-pad" style={{ background: "var(--ink)", color: "var(--paper)" }}>
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
								<span
									style={{
										fontSize: 11,
										opacity: 0.7,
										fontFamily: "var(--font-mono)",
										letterSpacing: "0.08em",
										textTransform: "uppercase",
									}}
								>
									{dict.planner.total}
								</span>
								<span style={{ fontSize: 11, opacity: 0.7, fontFamily: "var(--font-mono)" }}>
									{dict.planner.computedLive}
								</span>
							</div>
							<div style={{ display: "flex", gap: 22, marginTop: 8 }}>
								<div>
									<div className="display" style={{ fontSize: 36, color: "var(--paper)" }}>
										{distance}
									</div>
									<div
										style={{
											fontSize: 11,
											opacity: 0.6,
											fontFamily: "var(--font-mono)",
											textTransform: "uppercase",
											letterSpacing: "0.08em",
										}}
									>
										km
									</div>
								</div>
								<div>
									<div className="display" style={{ fontSize: 36, color: "var(--paper)" }}>
										{time}
									</div>
									<div
										style={{
											fontSize: 11,
											opacity: 0.6,
											fontFamily: "var(--font-mono)",
											textTransform: "uppercase",
											letterSpacing: "0.08em",
										}}
									>
										h
									</div>
								</div>
							</div>
							<a
								className="btn"
								href={openInAppHref}
								style={{
									width: "100%",
									marginTop: 18,
									background: "var(--indigo)",
									color: "white",
									height: 44,
									justifyContent: "center",
								}}
							>
								{dict.planner.openInApp} <ArrowIcon />
							</a>
						</div>

						<div
							style={{ fontSize: 12, color: "var(--muted-color)", fontFamily: "var(--font-mono)", textAlign: "center" }}
						>
							{dict.planner.hint}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
