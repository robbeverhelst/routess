/**
 * Rich SVG/HTML mock of the planner UI. Rendered standalone at `/_screenshot`
 * so a headless browser can capture it to `public/hero-screenshot.png`, which
 * the production `<HeroAppScreenshot>` then loads.
 *
 * To re-capture: `bun run --filter landing screenshot:hero` (apps/landing).
 */
const ELEV = [3, 5, 4, 6, 9, 7, 11, 14, 10, 12, 16, 13, 11, 14, 15, 12, 10, 13, 11, 9, 7, 10, 8, 6, 5, 7, 6, 5, 4];

function WindowChrome() {
	return (
		<div
			style={{
				height: 38,
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "0 14px",
				background: "oklch(0.96 0.012 80)",
				borderBottom: "1px solid oklch(0.9 0.012 80)",
			}}
		>
			<div style={{ display: "flex", gap: 6 }}>
				<div style={{ width: 11, height: 11, borderRadius: "50%", background: "oklch(0.78 0.16 25)" }} />
				<div style={{ width: 11, height: 11, borderRadius: "50%", background: "oklch(0.84 0.15 85)" }} />
				<div style={{ width: 11, height: 11, borderRadius: "50%", background: "oklch(0.78 0.13 145)" }} />
			</div>
			<div
				style={{
					flex: 1,
					maxWidth: 460,
					margin: "0 auto",
					height: 22,
					borderRadius: 6,
					background: "oklch(0.99 0.005 80)",
					border: "1px solid oklch(0.92 0.012 80)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontFamily: "var(--font-mono)",
					fontSize: 11,
					color: "var(--ink-soft)",
					gap: 6,
				}}
			>
				<span style={{ color: "var(--moss)" }}>●</span>
				app.routess.com/plan/sint-amands-loop
			</div>
			<div style={{ width: 60 }} />
		</div>
	);
}

function NavRail() {
	const icons = [
		{ key: "plan", active: true, path: "M4 12 L 12 4 L 20 12 M 6 10 L 6 20 L 18 20 L 18 10" },
		{ key: "lib", active: false, path: "M4 6 H 20 M 4 12 H 20 M 4 18 H 14" },
		{ key: "hist", active: false, path: "M12 4 A 8 8 0 1 0 20 12 M 12 8 V 12 L 15 14" },
		{
			key: "set",
			active: false,
			path: "M12 8 A 4 4 0 1 0 12 16 A 4 4 0 1 0 12 8 M 12 2 V 5 M 12 19 V 22 M 5 12 H 2 M 22 12 H 19",
		},
	];
	return (
		<div
			style={{
				width: 56,
				background: "oklch(0.97 0.018 80)",
				borderRight: "1px solid oklch(0.9 0.012 80)",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				padding: "14px 0",
				gap: 8,
				flexShrink: 0,
			}}
		>
			<div
				style={{
					width: 32,
					height: 32,
					borderRadius: 8,
					background: "var(--indigo)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					marginBottom: 6,
				}}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path d="M5 17 C 9 13, 11 10, 14 8 S 18 5, 21 4" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
					<circle cx="5" cy="17" r="2" fill="oklch(0.66 0.13 145)" stroke="white" strokeWidth="1.2" />
					<circle cx="21" cy="4" r="2" fill="oklch(0.66 0.16 45)" stroke="white" strokeWidth="1.2" />
				</svg>
			</div>
			{icons.map((it) => (
				<div
					key={it.key}
					style={{
						width: 36,
						height: 36,
						borderRadius: 8,
						background: it.active ? "var(--indigo-soft)" : "transparent",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path
							d={it.path}
							stroke={it.active ? "var(--indigo-deep)" : "var(--ink-soft)"}
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
							fill="none"
						/>
					</svg>
				</div>
			))}
		</div>
	);
}

function MapArea() {
	return (
		<div style={{ flex: 1, position: "relative", overflow: "hidden", background: "oklch(0.97 0.018 80)" }}>
			<svg
				viewBox="0 0 800 600"
				preserveAspectRatio="xMidYMid slice"
				style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
				aria-hidden="true"
			>
				<defs>
					<pattern id="fh" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
						<rect width="6" height="6" fill="oklch(0.86 0.1 145)" />
						<line x1="0" y1="0" x2="0" y2="6" stroke="oklch(0.78 0.13 145)" strokeWidth="0.6" />
					</pattern>
				</defs>
				<rect width="800" height="600" fill="oklch(0.97 0.018 80)" />

				<path
					d="M -50 440 C 80 410, 180 460, 280 430 S 460 380, 560 410 S 720 460, 880 440 L 880 620 L -50 620 Z"
					fill="oklch(0.86 0.06 225)"
				/>

				<path
					d="M 480 60 Q 560 50, 620 80 Q 670 120, 660 180 Q 620 220, 540 220 Q 480 200, 470 150 Q 450 100, 480 60 Z"
					fill="oklch(0.9 0.075 145)"
				/>
				<path
					d="M 60 320 Q 130 300, 190 320 Q 220 360, 200 410 Q 140 430, 80 410 Q 40 380, 60 320 Z"
					fill="oklch(0.91 0.075 145)"
				/>
				<path
					d="M 640 300 Q 720 280, 790 320 Q 800 380, 770 420 Q 700 450, 650 420 Q 610 370, 640 300 Z"
					fill="url(#fh)"
					opacity="0.7"
				/>

				<g fill="oklch(0.86 0.012 80)" stroke="oklch(0.78 0.014 80)" strokeWidth="0.4">
					{[
						[300, 230, 22, 14],
						[326, 230, 18, 14],
						[348, 232, 16, 12],
						[300, 248, 22, 12],
						[326, 246, 18, 12],
						[348, 248, 16, 14],
						[368, 230, 14, 14],
						[368, 248, 14, 12],
						[300, 264, 22, 14],
						[326, 264, 26, 14],
						[358, 264, 24, 14],
						[280, 310, 18, 12],
						[302, 310, 16, 12],
						[322, 310, 20, 14],
						[346, 310, 22, 14],
						[280, 326, 18, 14],
						[302, 328, 16, 12],
						[322, 328, 20, 12],
						[395, 170, 14, 12],
						[412, 170, 16, 12],
						[432, 170, 14, 12],
						[395, 186, 14, 14],
						[412, 188, 16, 12],
						[432, 186, 14, 14],
						[170, 80, 18, 12],
						[192, 82, 16, 12],
						[212, 80, 18, 14],
						[170, 98, 18, 14],
						[560, 310, 18, 12],
						[582, 310, 16, 14],
						[602, 312, 18, 12],
					].map(([x, y, w, h]) => (
						<rect key={`b-${x}-${y}`} x={x} y={y} width={w} height={h} rx="1.5" />
					))}
				</g>

				<g stroke="oklch(0.95 0.012 80)" strokeWidth="11" fill="none" strokeLinecap="round">
					<path d="M -20 140 C 100 150, 200 120, 320 140 S 540 180, 660 160 S 820 120, 880 130" />
					<path d="M 200 -20 C 220 100, 200 200, 240 320 S 280 480, 260 620" />
				</g>
				<g stroke="oklch(0.99 0.005 80)" strokeWidth="6" fill="none" strokeLinecap="round">
					<path d="M -20 140 C 100 150, 200 120, 320 140 S 540 180, 660 160 S 820 120, 880 130" />
					<path d="M 200 -20 C 220 100, 200 200, 240 320 S 280 480, 260 620" />
				</g>

				<g stroke="oklch(0.93 0.012 80)" strokeWidth="6" fill="none" strokeLinecap="round">
					<path d="M -20 300 Q 120 290, 240 305 T 460 290 T 680 300 T 880 290" />
					<path d="M 460 -20 Q 470 100, 460 220 T 480 400 T 460 620" />
				</g>
				<g stroke="white" strokeWidth="3" fill="none" strokeLinecap="round">
					<path d="M -20 300 Q 120 290, 240 305 T 460 290 T 680 300 T 880 290" />
					<path d="M 460 -20 Q 470 100, 460 220 T 480 400 T 460 620" />
				</g>

				<g stroke="oklch(0.91 0.012 80)" strokeWidth="2.2" fill="none">
					<path d="M -20 60 Q 120 55, 240 65 T 470 50 T 680 60 T 880 55" />
					<path d="M -20 220 Q 120 230, 240 220 T 470 235 T 680 225 T 880 230" />
					<path d="M -20 380 Q 120 385, 240 380 T 470 390 T 680 380 T 880 385" />
					<path d="M -20 540 Q 120 535, 240 545 T 470 535 T 680 545 T 880 540" />
					<path d="M 80 -20 Q 90 100, 80 220 T 100 400 T 80 620" />
					<path d="M 320 -20 Q 330 100, 320 220 T 340 400 T 320 620" />
					<path d="M 580 -20 Q 590 100, 580 220 T 600 400 T 580 620" />
					<path d="M 720 -20 Q 730 100, 720 220 T 740 400 T 720 620" />
				</g>

				<g stroke="oklch(0.7 0.04 45)" strokeWidth="1.4" strokeDasharray="3 3" fill="none" opacity="0.7">
					<path d="M 90 410 Q 140 400, 180 420 Q 220 450, 260 470" />
					<path d="M 470 140 Q 510 160, 560 180 Q 620 220, 640 300" />
				</g>

				<g>
					<path
						d="M 100 400 C 160 370, 220 340, 260 320 S 340 300, 380 260 S 440 210, 480 170 S 560 120, 620 80"
						stroke="var(--indigo)"
						strokeWidth="5.5"
						fill="none"
						strokeLinecap="round"
						style={{ filter: "drop-shadow(0 2px 3px oklch(0.42 0.19 280 / 0.35))" }}
					/>
					{[
						{ cx: 220, cy: 340, label: "5" },
						{ cx: 380, cy: 260, label: "10" },
						{ cx: 540, cy: 130, label: "15" },
					].map((m) => (
						<g key={m.label}>
							<circle cx={m.cx} cy={m.cy} r="13" fill="white" stroke="var(--indigo)" strokeWidth="2.4" />
							<text
								x={m.cx}
								y={m.cy + 4}
								fontSize="10"
								fontWeight="700"
								textAnchor="middle"
								fill="var(--indigo-deep)"
								fontFamily="var(--font-mono)"
							>
								{m.label}
							</text>
						</g>
					))}
					<circle cx="100" cy="400" r="9" fill="var(--moss)" stroke="white" strokeWidth="2.5" />
					<g transform="translate(606,60)">
						<path
							d="M14 0 C 6 0, 0 6, 0 14 C 0 24, 14 32, 14 32 C 14 32, 28 24, 28 14 C 28 6, 22 0, 14 0 Z"
							fill="var(--terracotta)"
							stroke="white"
							strokeWidth="2.5"
						/>
						<circle cx="14" cy="13" r="5" fill="white" />
					</g>
					{[
						{ cx: 160, cy: 380 },
						{ cx: 320, cy: 290 },
						{ cx: 460, cy: 200 },
					].map((w) => (
						<circle
							key={`wp-${w.cx}`}
							cx={w.cx}
							cy={w.cy}
							r="6"
							fill="white"
							stroke="var(--indigo)"
							strokeWidth="2.5"
						/>
					))}
				</g>
			</svg>

			<div
				style={{
					position: "absolute",
					top: 14,
					left: 14,
					right: 14,
					maxWidth: 360,
					height: 38,
					background: "var(--paper)",
					border: "1px solid var(--line)",
					borderRadius: 10,
					display: "flex",
					alignItems: "center",
					padding: "0 12px",
					gap: 10,
					boxShadow: "0 4px 10px oklch(0.2 0.02 270 / 0.08)",
				}}
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<circle cx="11" cy="11" r="6" stroke="var(--muted-color)" strokeWidth="2" />
					<path d="M16 16 L 21 21" stroke="var(--muted-color)" strokeWidth="2" strokeLinecap="round" />
				</svg>
				<span style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: 500 }}>Sint-Amands, België</span>
			</div>

			<div
				style={{
					position: "absolute",
					top: 14,
					right: 14,
					padding: 4,
					background: "var(--paper)",
					borderRadius: 999,
					border: "1px solid var(--line)",
					display: "flex",
					gap: 4,
					boxShadow: "0 4px 10px oklch(0.2 0.02 270 / 0.08)",
				}}
			>
				{[
					{ label: "Run", active: false, icon: "🏃" },
					{ label: "Cycle", active: true, icon: "🚴" },
					{ label: "Walk", active: false, icon: "🥾" },
				].map((m) => (
					<div
						key={m.label}
						style={{
							padding: "6px 12px",
							borderRadius: 999,
							fontSize: 12,
							fontWeight: 600,
							background: m.active ? "var(--ink)" : "transparent",
							color: m.active ? "var(--paper)" : "var(--ink-soft)",
							display: "flex",
							alignItems: "center",
							gap: 6,
						}}
					>
						<span aria-hidden="true">{m.icon}</span>
						{m.label}
					</div>
				))}
			</div>

			<div
				style={{
					position: "absolute",
					right: 14,
					bottom: 60,
					display: "flex",
					flexDirection: "column",
					background: "var(--paper)",
					border: "1px solid var(--line)",
					borderRadius: 10,
					overflow: "hidden",
					boxShadow: "0 4px 10px oklch(0.2 0.02 270 / 0.08)",
				}}
			>
				<div
					style={{
						width: 32,
						height: 32,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						borderBottom: "1px solid var(--line)",
						fontSize: 16,
						color: "var(--ink-soft)",
					}}
				>
					+
				</div>
				<div
					style={{
						width: 32,
						height: 32,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: 16,
						color: "var(--ink-soft)",
					}}
				>
					−
				</div>
			</div>

			<div
				style={{
					position: "absolute",
					bottom: 6,
					left: 8,
					fontSize: 9,
					color: "var(--muted-color)",
					fontFamily: "var(--font-mono)",
					opacity: 0.7,
				}}
			>
				© routess · valhalla · OSM
			</div>
		</div>
	);
}

function ElevationProfileSmall() {
	const W = 280;
	const H = 64;
	const max = Math.max(...ELEV);
	const step = W / (ELEV.length - 1);
	const line = ELEV.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${H - (p / max) * (H - 8)}`).join(" ");
	const fill = `${line} L ${W} ${H} L 0 ${H} Z`;
	return (
		<svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 64 }} aria-hidden="true">
			<defs>
				<linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="var(--sun)" stopOpacity="0.5" />
					<stop offset="100%" stopColor="var(--sun)" stopOpacity="0.05" />
				</linearGradient>
			</defs>
			<path d={fill} fill="url(#eg)" />
			<path d={line} stroke="var(--sun)" strokeWidth="2" fill="none" />
		</svg>
	);
}

function RightPanel() {
	return (
		<div
			style={{
				width: 280,
				borderLeft: "1px solid oklch(0.9 0.012 80)",
				background: "var(--paper)",
				display: "flex",
				flexDirection: "column",
				flexShrink: 0,
			}}
		>
			<div style={{ padding: "16px 18px", borderBottom: "1px solid var(--line)" }}>
				<div className="eyebrow" style={{ marginBottom: 6, fontSize: 10 }}>
					Route
				</div>
				<div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Sint-Amands loop</div>
				<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
					<span
						style={{
							padding: "2px 8px",
							borderRadius: 999,
							background: "var(--moss-soft)",
							color: "oklch(0.32 0.08 145)",
							fontSize: 11,
							fontWeight: 600,
						}}
					>
						loop
					</span>
					<span
						style={{
							padding: "2px 8px",
							borderRadius: 999,
							background: "var(--terracotta-soft)",
							color: "oklch(0.42 0.13 45)",
							fontSize: 11,
							fontWeight: 600,
						}}
					>
						gravel
					</span>
				</div>
			</div>

			<div
				style={{
					padding: "14px 18px",
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: 10,
					borderBottom: "1px solid var(--line)",
				}}
			>
				{[
					{ label: "dist", value: "28.5", unit: "km" },
					{ label: "time", value: "5.7", unit: "h" },
					{ label: "↑", value: "46", unit: "m" },
					{ label: "↓", value: "44", unit: "m" },
				].map((s) => (
					<div key={`${s.label}-${s.unit}`}>
						<div
							style={{
								fontSize: 9,
								color: "var(--muted-color)",
								textTransform: "uppercase",
								letterSpacing: "0.08em",
								fontFamily: "var(--font-mono)",
							}}
						>
							{s.label}
						</div>
						<div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-display)" }}>
							{s.value}
							<span style={{ fontSize: 11, color: "var(--muted-color)", marginLeft: 2, fontWeight: 500 }}>
								{s.unit}
							</span>
						</div>
					</div>
				))}
			</div>

			<div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
				<div className="eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>
					Surface
				</div>
				<div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
					<div style={{ flex: 46, background: "var(--ink)" }} />
					<div style={{ flex: 13, background: "var(--sun)" }} />
					<div style={{ flex: 38, background: "var(--terracotta)" }} />
					<div style={{ flex: 3, background: "var(--moss)" }} />
				</div>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 4,
						fontSize: 11,
						color: "var(--ink-soft)",
						fontFamily: "var(--font-mono)",
					}}
				>
					{[
						{ c: "var(--ink)", n: "paved", p: 46 },
						{ c: "var(--sun)", n: "compacted", p: 13 },
						{ c: "var(--terracotta)", n: "unpaved", p: 38 },
						{ c: "var(--moss)", n: "path", p: 3 },
					].map((s) => (
						<div key={s.n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
							<span style={{ width: 6, height: 6, borderRadius: 2, background: s.c }} />
							<span style={{ flex: 1 }}>{s.n}</span>
							<span style={{ color: "var(--ink)" }}>{s.p}%</span>
						</div>
					))}
				</div>
			</div>

			<div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
				<div
					className="eyebrow"
					style={{ fontSize: 10, marginBottom: 6, display: "flex", justifyContent: "space-between" }}
				>
					<span>Elevation</span>
					<span style={{ color: "var(--muted-color)" }}>↑46 ↓44</span>
				</div>
				<ElevationProfileSmall />
			</div>

			<div
				style={{
					padding: "14px 18px",
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: 8,
					marginTop: "auto",
				}}
			>
				<button
					type="button"
					style={{
						height: 34,
						borderRadius: 8,
						border: "1px solid var(--line)",
						background: "var(--paper)",
						fontSize: 12,
						fontWeight: 600,
						color: "var(--ink-soft)",
						cursor: "pointer",
					}}
				>
					Export
				</button>
				<button
					type="button"
					style={{
						height: 34,
						borderRadius: 8,
						border: "none",
						background: "var(--indigo)",
						color: "white",
						fontSize: 12,
						fontWeight: 600,
						cursor: "pointer",
					}}
				>
					Share
				</button>
			</div>
		</div>
	);
}

export function HeroAppScreenshotMock() {
	return (
		<div
			id="hero-screenshot-target"
			style={{
				width: 920,
				height: 560,
				display: "flex",
				flexDirection: "column",
				background: "var(--paper)",
				border: "1px solid oklch(0.86 0.012 80)",
				borderRadius: 24,
				overflow: "hidden",
				fontFamily: "var(--font-body)",
			}}
		>
			<WindowChrome />
			<div style={{ display: "flex", flex: 1, minHeight: 0 }}>
				<NavRail />
				<MapArea />
				<RightPanel />
			</div>
		</div>
	);
}
