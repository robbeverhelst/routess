import { useEffect, useState } from "react";
import { I } from "../components/icons";
import { Btn, Kbd, RDS_COLORS } from "../components/primitives";
import { DEFAULT_SPORT_SPEEDS_KMH, type RedesignUnits, useRedesignSettingsStore } from "../stores/settingsStore";
import { type RedesignActivity, useUiStore } from "../stores/uiStore";

const STEPS = [
	{ title: "Pick your sports", sub: "Choose one or more — you can switch any time." },
	{ title: "Units", sub: "How would you like distances and speeds shown?" },
	{ title: "Average speed", sub: "We'll use this to estimate route durations." },
	{ title: "Your map style", sub: "Streets keeps things light. Outdoors highlights trails and elevation." },
	{ title: "Save your first route", sub: "Drop start, drop end. Build it in 2 clicks. Or generate a loop." },
];

const SPORTS: {
	key: RedesignActivity;
	icon: React.ComponentType<{ size?: number }>;
	label: string;
	sub: string;
	defaultLabel: string;
}[] = [
	{ key: "run", icon: I.run, label: "Running", sub: "Pace · splits", defaultLabel: "Running" },
	{ key: "cycle", icon: I.bike, label: "Cycling", sub: "Speed · routes", defaultLabel: "Cycling" },
	{ key: "walk", icon: I.walk, label: "Walking", sub: "Distance · POIs", defaultLabel: "Walking" },
];

const KMH_TO_MPH = 0.621371;

function toDisplay(kmh: number, units: RedesignUnits): number {
	return units === "mi" ? kmh * KMH_TO_MPH : kmh;
}

function fromDisplay(value: number, units: RedesignUnits): number {
	return units === "mi" ? value / KMH_TO_MPH : value;
}

export function WelcomeScreen({ onComplete }: { onComplete?: () => void }) {
	const [step, setStep] = useState(0);

	const setActivityType = useUiStore((s) => s.setActivityType);

	const selectedSports = useRedesignSettingsStore((s) => s.selectedSports);
	const toggleSport = useRedesignSettingsStore((s) => s.toggleSport);
	const sportSpeeds = useRedesignSettingsStore((s) => s.sportSpeeds);
	const setSportSpeed = useRedesignSettingsStore((s) => s.setSportSpeed);
	const setDefaultActivity = useRedesignSettingsStore((s) => s.setDefaultActivity);
	const units = useRedesignSettingsStore((s) => s.units);
	const setUnits = useRedesignSettingsStore((s) => s.setUnits);
	const mapStyle = useRedesignSettingsStore((s) => s.mapStyle);
	const setMapStyle = useRedesignSettingsStore((s) => s.setMapStyle);

	useEffect(() => {
		for (const sport of selectedSports) {
			if (sportSpeeds[sport] === undefined) {
				setSportSpeed(sport, DEFAULT_SPORT_SPEEDS_KMH[sport]);
			}
		}
	}, [selectedSports, sportSpeeds, setSportSpeed]);

	const canContinue = step === 0 ? selectedSports.length > 0 : true;

	const finish = () => {
		const primary = selectedSports[0];
		if (primary) {
			setActivityType(primary);
			const sportLabel = SPORTS.find((s) => s.key === primary)?.defaultLabel;
			if (sportLabel) setDefaultActivity(sportLabel);
		}
		onComplete?.();
	};

	const next = () => {
		if (!canContinue) return;
		if (step === STEPS.length - 1) {
			finish();
		} else {
			setStep(step + 1);
		}
	};

	const speedSports = selectedSports.length > 0 ? selectedSports : (["cycle"] as RedesignActivity[]);
	const unitLabel = units === "mi" ? "mph" : "km/h";

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 24,
				background: RDS_COLORS.bgCanvas,
			}}
		>
			<div
				style={{
					position: "absolute",
					inset: 0,
					background: `color-mix(in oklch, ${RDS_COLORS.bgCanvas} 80%, transparent)`,
					backdropFilter: "blur(10px)",
				}}
			/>
			<div
				style={{
					position: "relative",
					width: 540,
					maxWidth: "100%",
					padding: 36,
					background: RDS_COLORS.bgPanel,
					border: `1px solid ${RDS_COLORS.border}`,
					borderRadius: 18,
					boxShadow: "var(--rds-shadow-lg)",
				}}
			>
				<div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
					{STEPS.map((s, i) => (
						<div
							key={s.title}
							data-step={i}
							style={{
								flex: 1,
								height: 3,
								borderRadius: 999,
								background: i <= step ? RDS_COLORS.accent : RDS_COLORS.border,
							}}
						/>
					))}
				</div>

				<div
					style={{
						fontSize: 11,
						color: RDS_COLORS.fgSubtle,
						textTransform: "uppercase",
						letterSpacing: 0.6,
						fontWeight: 600,
					}}
				>
					Step {step + 1} of {STEPS.length}
				</div>
				<h2 style={{ fontSize: 26, fontWeight: 600, margin: "8px 0 6px", letterSpacing: -0.5 }}>{STEPS[step].title}</h2>
				<p style={{ fontSize: 14, color: RDS_COLORS.fgMuted, margin: 0, lineHeight: 1.5 }}>{STEPS[step].sub}</p>

				<div style={{ marginTop: 26 }}>
					{step === 0 && (
						<div style={{ display: "flex", gap: 12 }}>
							{SPORTS.map((a) => {
								const Icon = a.icon;
								const on = selectedSports.includes(a.key);
								return (
									<button
										key={a.key}
										type="button"
										aria-pressed={on}
										onClick={() => toggleSport(a.key)}
										style={{
											flex: 1,
											position: "relative",
											padding: 18,
											borderRadius: 12,
											background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
											border: on ? `2px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
											color: on ? RDS_COLORS.accent : RDS_COLORS.fg,
											display: "flex",
											flexDirection: "column",
											gap: 8,
											alignItems: "flex-start",
											cursor: "pointer",
											transition: "background 120ms, border-color 120ms, color 120ms",
										}}
									>
										<span
											style={{
												position: "absolute",
												top: 10,
												right: 10,
												width: 18,
												height: 18,
												borderRadius: 999,
												display: "inline-flex",
												alignItems: "center",
												justifyContent: "center",
												background: on ? RDS_COLORS.accent : "transparent",
												color: on ? RDS_COLORS.accentFg : "transparent",
												border: on ? "none" : `1.5px solid ${RDS_COLORS.border}`,
												transition: "background 120ms, color 120ms",
											}}
										>
											{on && <I.check size={11} />}
										</span>
										<Icon size={22} />
										<div style={{ fontSize: 14, fontWeight: 600 }}>{a.label}</div>
										<div style={{ fontSize: 11.5, color: on ? RDS_COLORS.accent : RDS_COLORS.fgSubtle }}>{a.sub}</div>
									</button>
								);
							})}
						</div>
					)}

					{step === 1 && (
						<div style={{ display: "flex", gap: 12 }}>
							{[
								{ key: "km" as const, label: "Metric", sub: "km · m · km/h" },
								{ key: "mi" as const, label: "Imperial", sub: "mi · ft · mph" },
							].map((u) => {
								const on = units === u.key;
								return (
									<button
										key={u.key}
										type="button"
										aria-pressed={on}
										onClick={() => setUnits(u.key)}
										style={{
											flex: 1,
											padding: 22,
											borderRadius: 12,
											background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
											border: on ? `2px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
											color: on ? RDS_COLORS.accent : RDS_COLORS.fg,
											display: "flex",
											flexDirection: "column",
											alignItems: "flex-start",
											gap: 6,
											cursor: "pointer",
											transition: "background 120ms, border-color 120ms, color 120ms",
										}}
									>
										<div style={{ fontSize: 15, fontWeight: 600 }}>{u.label}</div>
										<div style={{ fontSize: 12, color: on ? RDS_COLORS.accent : RDS_COLORS.fgSubtle }}>{u.sub}</div>
									</button>
								);
							})}
						</div>
					)}

					{step === 2 && (
						<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
							{speedSports.map((sport) => {
								const cfg = SPORTS.find((s) => s.key === sport);
								if (!cfg) return null;
								const Icon = cfg.icon;
								const kmh = sportSpeeds[sport] ?? DEFAULT_SPORT_SPEEDS_KMH[sport];
								const display = toDisplay(kmh, units);
								return (
									<div
										key={sport}
										style={{
											display: "flex",
											alignItems: "center",
											gap: 14,
											padding: "14px 16px",
											background: RDS_COLORS.bgInput,
											border: `1px solid ${RDS_COLORS.border}`,
											borderRadius: 12,
										}}
									>
										<div
											style={{
												width: 36,
												height: 36,
												borderRadius: 10,
												background: RDS_COLORS.accentSoft,
												color: RDS_COLORS.accent,
												display: "inline-flex",
												alignItems: "center",
												justifyContent: "center",
												flexShrink: 0,
											}}
										>
											<Icon size={18} />
										</div>
										<div style={{ flex: 1, minWidth: 0 }}>
											<div style={{ fontSize: 13, fontWeight: 600, color: RDS_COLORS.fg }}>{cfg.label}</div>
											<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>Average pace</div>
										</div>
										<input
											type="number"
											min={1}
											max={100}
											step={units === "mi" ? 0.5 : 1}
											value={Number.isFinite(display) ? Math.round(display * 10) / 10 : ""}
											onChange={(e) => {
												const n = Number.parseFloat(e.target.value);
												if (Number.isFinite(n) && n > 0) {
													setSportSpeed(sport, fromDisplay(n, units));
												}
											}}
											style={{
												width: 72,
												height: 34,
												padding: "0 10px",
												borderRadius: 8,
												background: RDS_COLORS.bgPanel,
												border: `1px solid ${RDS_COLORS.border}`,
												color: RDS_COLORS.fg,
												fontSize: 13,
												textAlign: "right",
											}}
										/>
										<span style={{ fontSize: 12, color: RDS_COLORS.fgMuted, width: 36 }}>{unitLabel}</span>
									</div>
								);
							})}
						</div>
					)}

					{step === 3 && (
						<div style={{ display: "flex", gap: 12 }}>
							{(
								[
									{
										key: "streets",
										bg: "linear-gradient(135deg, oklch(0.93 0.02 240), oklch(0.95 0.03 220))",
										label: "Streets",
									},
									{
										key: "outdoors",
										bg: "linear-gradient(135deg, oklch(0.92 0.05 145), oklch(0.88 0.07 95))",
										label: "Outdoors",
									},
									{
										key: "satellite",
										bg: "linear-gradient(135deg, oklch(0.4 0.04 240), oklch(0.3 0.05 145))",
										label: "Satellite",
									},
								] as const
							).map((m) => {
								const on = mapStyle === m.key;
								return (
									<button
										key={m.key}
										type="button"
										onClick={() => setMapStyle(m.key)}
										style={{
											flex: 1,
											padding: 0,
											borderRadius: 12,
											overflow: "hidden",
											border: on ? `2px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
											background: m.bg,
											height: 140,
											position: "relative",
											display: "flex",
											alignItems: "flex-end",
											cursor: "pointer",
										}}
									>
										<div
											style={{
												width: "100%",
												padding: 10,
												background: `color-mix(in oklch, ${RDS_COLORS.bgPanel} 90%, transparent)`,
												textAlign: "left",
												fontSize: 12.5,
												fontWeight: 600,
												color: RDS_COLORS.fg,
											}}
										>
											{m.label}
										</div>
									</button>
								);
							})}
						</div>
					)}

					{step === 4 && (
						<div
							style={{
								background: RDS_COLORS.bgInput,
								border: `1px solid ${RDS_COLORS.border}`,
								borderRadius: 12,
								padding: 24,
								textAlign: "center",
							}}
						>
							<div
								style={{
									display: "inline-flex",
									gap: 4,
									alignItems: "center",
									padding: "6px 12px",
									borderRadius: 999,
									background: RDS_COLORS.accentSoft,
									color: RDS_COLORS.accent,
									fontSize: 12,
									fontWeight: 600,
									marginBottom: 14,
								}}
							>
								<I.zap size={12} /> Pro tip
							</div>
							<p style={{ margin: 0, fontSize: 13, color: RDS_COLORS.fgMuted, lineHeight: 1.55 }}>
								Press <Kbd>⌘</Kbd> <Kbd>K</Kbd> from anywhere to search, jump to a route, or run a command.
							</p>
						</div>
					)}
				</div>

				<div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 28 }}>
					<Btn variant="ghost" onClick={finish} style={{ color: RDS_COLORS.fgMuted }}>
						Skip
					</Btn>
					<div style={{ flex: 1 }} />
					{step > 0 && <Btn onClick={() => setStep(step - 1)}>Back</Btn>}
					<Btn variant="primary" onClick={next} disabled={!canContinue}>
						{step === STEPS.length - 1 ? (
							<>
								Get started <I.chevronR size={12} />
							</>
						) : (
							<>
								Continue <I.chevronR size={12} />
							</>
						)}
					</Btn>
				</div>
			</div>
		</div>
	);
}
