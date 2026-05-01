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
		sub: "Max gradient 6%",
		defaultOn: true,
		slider: true,
	},
	{ key: "unpaved", icon: I.flag, label: "Avoid unpaved", sub: "Stay on asphalt where possible", defaultOn: false },
	{ key: "highways", icon: I.trend, label: "Avoid highways", sub: "Always", defaultOn: true },
	{ key: "snap", icon: I.refresh, label: "Auto-snap waypoints", sub: "Drag onto nearest road", defaultOn: true },
];

export function RoutingModal() {
	const close = useModalsStore((s) => s.closeModal);
	const [profile, setProfile] = useState<(typeof PROFILES)[number]["key"]>("scenic");
	const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
		const out: Record<string, boolean> = {};
		for (const p of PREFS) out[p.key] = p.defaultOn;
		return out;
	});

	return (
		<ModalShell
			title="Routing preferences"
			sub="Affects new routes only · current route stays as-is"
			width={520}
			onClose={close}
			footer={
				<>
					<Btn variant="ghost">Reset</Btn>
					<div style={{ flex: 1 }} />
					<Btn onClick={close}>Cancel</Btn>
					<Btn variant="primary" onClick={close}>
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
							<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>{row.sub}</div>
							{row.slider && on && (
								<div
									style={{
										marginTop: 8,
										height: 4,
										background: RDS_COLORS.bgInput,
										borderRadius: 999,
										position: "relative",
									}}
								>
									<div
										style={{
											position: "absolute",
											left: 0,
											top: 0,
											height: "100%",
											width: "60%",
											background: RDS_COLORS.accent,
											borderRadius: 999,
										}}
									/>
									<div
										style={{
											position: "absolute",
											left: "60%",
											top: -4,
											width: 12,
											height: 12,
											borderRadius: 999,
											background: RDS_COLORS.bgPanel,
											border: `2px solid ${RDS_COLORS.accent}`,
											transform: "translateX(-6px)",
										}}
									/>
								</div>
							)}
						</div>
						<Toggle on={on} onChange={(v) => setPrefs({ ...prefs, [row.key]: v })} />
					</div>
				);
			})}
		</ModalShell>
	);
}
