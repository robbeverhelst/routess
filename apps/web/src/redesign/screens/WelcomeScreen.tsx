import { useState } from "react";
import { I } from "../components/icons";
import { Btn, Kbd, RDS_COLORS } from "../components/primitives";
import { type RedesignActivity, useUiStore } from "../stores/uiStore";

const STEPS = [
	{ title: "Pick your sport", sub: "We'll set up units, default activity, and routing preferences." },
	{ title: "Your map style", sub: "Streets keeps things light. Outdoors highlights trails and elevation." },
	{ title: "Save your first route", sub: "Drop start, drop end. Build it in 2 clicks. Or generate a loop." },
];

export function WelcomeScreen({ onComplete }: { onComplete?: () => void }) {
	const [step, setStep] = useState(0);
	const { activityType, setActivityType } = useUiStore();
	const [mapStyle, setMapStyle] = useState<"streets" | "outdoors" | "satellite">("outdoors");

	const next = () => {
		if (step === STEPS.length - 1) {
			onComplete?.();
		} else {
			setStep(step + 1);
		}
	};

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
				<div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
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
							{(
								[
									{ key: "run", icon: I.run, label: "Running", sub: "Pace · splits" },
									{ key: "cycle", icon: I.bike, label: "Cycling", sub: "Speed · routes" },
									{ key: "walk", icon: I.walk, label: "Walking", sub: "Distance · POIs" },
								] as {
									key: RedesignActivity;
									icon: React.ComponentType<{ size?: number }>;
									label: string;
									sub: string;
								}[]
							).map((a) => {
								const Icon = a.icon;
								const on = activityType === a.key;
								return (
									<button
										key={a.key}
										type="button"
										onClick={() => setActivityType(a.key)}
										style={{
											flex: 1,
											padding: 18,
											borderRadius: 12,
											background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
											border: on ? `1.5px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
											color: on ? RDS_COLORS.accent : RDS_COLORS.fg,
											display: "flex",
											flexDirection: "column",
											gap: 8,
											alignItems: "flex-start",
											cursor: "pointer",
										}}
									>
										<Icon size={22} />
										<div style={{ fontSize: 14, fontWeight: 600 }}>{a.label}</div>
										<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>{a.sub}</div>
									</button>
								);
							})}
						</div>
					)}
					{step === 1 && (
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
										onClick={() => setMapStyle(m.key as typeof mapStyle)}
										style={{
											flex: 1,
											padding: 0,
											borderRadius: 12,
											overflow: "hidden",
											border: on ? `1.5px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
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
					{step === 2 && (
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
					<Btn variant="ghost" onClick={onComplete} style={{ color: RDS_COLORS.fgMuted }}>
						Skip
					</Btn>
					<div style={{ flex: 1 }} />
					{step > 0 && <Btn onClick={() => setStep(step - 1)}>Back</Btn>}
					<Btn variant="primary" onClick={next}>
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
