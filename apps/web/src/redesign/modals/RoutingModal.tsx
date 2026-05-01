// TODO: persist + apply preferences to RouteCalculationService.
// These preferences are currently held in local component state only.
// When a routing-preferences store is introduced, swap useState for the store
// and feed the values into RouteCalculationService so they actually shape routes.
import { useState } from "react";
import { I } from "../components/icons";
import { ModalShell } from "../components/ModalShell";
import { Btn, RDS_COLORS, Toggle } from "../components/primitives";
import { useModalsStore } from "../stores/modalsStore";

const PROFILES = [
	{ key: "fast", label: "Fastest", icon: I.zap, hint: "Default" },
	{ key: "scenic", label: "Scenic", icon: I.mountain, hint: "+15% time" },
	{ key: "safe", label: "Safest", icon: I.flag, hint: "Bike paths" },
	{ key: "flat", label: "Flat", icon: I.trend, hint: "Avoid hills" },
] as const;

interface PrefRow {
	key: string;
	icon: React.ComponentType<{ size?: number }>;
	label: string;
	sub: string;
	defaultOn: boolean;
	slider?: boolean;
}

const PREFS: PrefRow[] = [
	{
		key: "bike",
		icon: I.bike,
		label: "Prefer bike infrastructure",
		sub: "Cycle paths, low-traffic streets",
		defaultOn: true,
	},
	{
		key: "climbs",
		icon: I.mountain,
		label: "Avoid steep climbs",
		sub: "Max gradient",
		defaultOn: true,
		slider: true,
	},
	{ key: "unpaved", icon: I.flag, label: "Avoid unpaved", sub: "Stay on asphalt where possible", defaultOn: false },
	{ key: "highways", icon: I.trend, label: "Avoid highways", sub: "Always", defaultOn: true },
	{ key: "snap", icon: I.target, label: "Auto-snap waypoints", sub: "Drag onto nearest road", defaultOn: true },
];

const DEFAULT_PROFILE: (typeof PROFILES)[number]["key"] = "scenic";
const DEFAULT_CLIMB_GRADIENT = 6;
const MIN_CLIMB_GRADIENT = 2;
const MAX_CLIMB_GRADIENT = 15;

function buildDefaultPrefs(): Record<string, boolean> {
	const out: Record<string, boolean> = {};
	for (const p of PREFS) out[p.key] = p.defaultOn;
	return out;
}

export function RoutingModal() {
	const close = useModalsStore((s) => s.closeModal);
	const [profile, setProfile] = useState<(typeof PROFILES)[number]["key"]>(DEFAULT_PROFILE);
	const [prefs, setPrefs] = useState<Record<string, boolean>>(() => buildDefaultPrefs());
	const [climbGradient, setClimbGradient] = useState<number>(DEFAULT_CLIMB_GRADIENT);

	const reset = () => {
		setProfile(DEFAULT_PROFILE);
		setPrefs(buildDefaultPrefs());
		setClimbGradient(DEFAULT_CLIMB_GRADIENT);
	};

	const apply = () => {
		// TODO: persist + apply preferences to RouteCalculationService.
		// For now we close the modal — values live in local state until a
		// routing-preferences store wires them into route calculation.
		close();
	};

	return (
		<ModalShell
			title="Routing preferences"
			sub="Affects new routes only · current route stays as-is"
			width={520}
			onClose={close}
			footer={
				<>
					<Btn variant="ghost" onClick={reset}>
						Reset
					</Btn>
					<div style={{ flex: 1 }} />
					<Btn onClick={close}>Cancel</Btn>
					<Btn variant="primary" onClick={apply}>
						Apply
					</Btn>
				</>
			}
		>
			{/* Profile selector */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 1fr 1fr 1fr",
					gap: 6,
					marginBottom: 16,
				}}
			>
				{PROFILES.map((p) => {
					const Icon = p.icon;
					const on = profile === p.key;
					return (
						<button
							key={p.key}
							type="button"
							onClick={() => setProfile(p.key)}
							style={{
								padding: 10,
								borderRadius: 8,
								background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
								border: on ? `1px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
								color: on ? RDS_COLORS.accent : RDS_COLORS.fg,
								display: "flex",
								flexDirection: "column",
								gap: 4,
								alignItems: "flex-start",
								cursor: "pointer",
							}}
						>
							<Icon size={16} />
							<div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.label}</div>
							<div className="rds-mono" style={{ fontSize: 10, color: RDS_COLORS.fgSubtle }}>
								{p.hint}
							</div>
						</button>
					);
				})}
			</div>

			{PREFS.map((row, i) => {
				const Icon = row.icon;
				const on = prefs[row.key];
				return (
					<div
						key={row.key}
						style={{
							display: "flex",
							alignItems: "flex-start",
							gap: 12,
							padding: "12px 0",
							borderBottom: i < PREFS.length - 1 ? `1px solid ${RDS_COLORS.border}` : "none",
						}}
					>
						<div
							style={{
								width: 28,
								height: 28,
								borderRadius: 6,
								background: RDS_COLORS.bgInput,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								color: RDS_COLORS.fgMuted,
								flexShrink: 0,
							}}
						>
							<Icon size={14} />
						</div>
						<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
							<div style={{ fontSize: 13, fontWeight: 500 }}>{row.label}</div>
							<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>
								{row.sub}
								{row.slider && on ? <span className="rds-mono"> · {climbGradient}%</span> : null}
							</div>
							{row.slider && on && (
								<input
									type="range"
									min={MIN_CLIMB_GRADIENT}
									max={MAX_CLIMB_GRADIENT}
									step={1}
									value={climbGradient}
									onChange={(e) => setClimbGradient(Number(e.target.value))}
									aria-label="Max climb gradient (%)"
									style={{
										marginTop: 8,
										width: "100%",
										accentColor: RDS_COLORS.accent,
										cursor: "pointer",
									}}
								/>
							)}
						</div>
						<Toggle on={on} onChange={(v) => setPrefs({ ...prefs, [row.key]: v })} />
					</div>
				);
			})}
		</ModalShell>
	);
}
