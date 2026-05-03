import { I } from "../components/icons";
import { ModalShell } from "../components/ModalShell";
import { Btn, RDS_COLORS, Toggle } from "../components/primitives";
import { useModalsStore } from "../stores/modalsStore";
import {
	DEFAULT_ROUTING_PREFERENCES,
	MAX_CLIMB_GRADIENT,
	MIN_CLIMB_GRADIENT,
	type RoutingProfile,
	useRoutingPreferencesStore,
} from "../stores/routingPreferencesStore";
import { useToastStore } from "../stores/toastStore";

const PROFILES = [
	{ key: "fast", label: "Fastest", icon: I.zap, hint: "Default" },
	{ key: "scenic", label: "Scenic", icon: I.mountain, hint: "+15% time" },
	{ key: "safe", label: "Safest", icon: I.flag, hint: "Bike paths" },
	{ key: "flat", label: "Flat", icon: I.trend, hint: "Avoid hills" },
] as const;

interface PrefRow {
	key: "bike" | "climbs" | "unpaved" | "highways" | "snap";
	icon: React.ComponentType<{ size?: number }>;
	label: string;
	sub: string;
	slider?: boolean;
}

const PREFS: PrefRow[] = [
	{
		key: "bike",
		icon: I.bike,
		label: "Prefer bike infrastructure",
		sub: "Cycle paths, low-traffic streets",
	},
	{
		key: "climbs",
		icon: I.mountain,
		label: "Avoid steep climbs",
		sub: "Max gradient",
		slider: true,
	},
	{ key: "unpaved", icon: I.flag, label: "Avoid unpaved", sub: "Stay on asphalt where possible" },
	{ key: "highways", icon: I.trend, label: "Avoid highways", sub: "Excludes motorway segments from routing" },
	{ key: "snap", icon: I.target, label: "Auto-snap waypoints", sub: "Drag onto nearest road" },
];

export function RoutingModal() {
	const close = useModalsStore((s) => s.closeModal);
	const pushToast = useToastStore((s) => s.push);
	const prefs = useRoutingPreferencesStore();

	const reset = () => prefs.reset();

	const apply = () => {
		// Preferences are already persisted to the store via setters; trigger a
		// recalculation of the current route so the new options take effect.
		window.dispatchEvent(new CustomEvent("routess:recalculate-route"));
		pushToast({
			kind: "success",
			title: "Routing preferences applied",
			body: "New routes and recalculations use these settings.",
			durationMs: 2200,
		});
		close();
	};

	const setPref = (key: PrefRow["key"], value: boolean) => {
		switch (key) {
			case "bike":
				prefs.setBike(value);
				return;
			case "climbs":
				prefs.setClimbs(value);
				return;
			case "unpaved":
				prefs.setUnpaved(value);
				return;
			case "highways":
				prefs.setHighways(value);
				return;
			case "snap":
				prefs.setSnap(value);
				return;
		}
	};

	const getPref = (key: PrefRow["key"]): boolean => {
		switch (key) {
			case "bike":
				return prefs.bike;
			case "climbs":
				return prefs.climbs;
			case "unpaved":
				return prefs.unpaved;
			case "highways":
				return prefs.highways;
			case "snap":
				return prefs.snap;
		}
	};

	return (
		<ModalShell
			title="Routing preferences"
			sub="Saved to this device · applied on Apply"
			width={520}
			onClose={close}
			footer={
				<>
					<Btn variant="ghost" onClick={reset} title={`Restore defaults (${DEFAULT_ROUTING_PREFERENCES.profile})`}>
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
					const on = prefs.profile === p.key;
					return (
						<button
							key={p.key}
							type="button"
							onClick={() => prefs.setProfile(p.key as RoutingProfile)}
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
				const on = getPref(row.key);
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
								{row.slider && on ? <span className="rds-mono"> · {prefs.climbGradient}%</span> : null}
							</div>
							{row.slider && on && (
								<input
									type="range"
									min={MIN_CLIMB_GRADIENT}
									max={MAX_CLIMB_GRADIENT}
									step={1}
									value={prefs.climbGradient}
									onChange={(e) => prefs.setClimbGradient(Number(e.target.value))}
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
						<Toggle on={on} onChange={(v) => setPref(row.key, v)} />
					</div>
				);
			})}
		</ModalShell>
	);
}
