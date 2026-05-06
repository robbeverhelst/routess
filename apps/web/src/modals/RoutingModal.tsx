import { t } from "@/lib/i18n";
import { useModalsStore } from "@/stores/modalsStore";
import {
	DEFAULT_ROUTING_PREFERENCES,
	MAX_CLIMB_GRADIENT,
	MIN_CLIMB_GRADIENT,
	type RoutingProfile,
	useRoutingPreferencesStore,
} from "@/stores/routingPreferencesStore";
import { useToastStore } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { ModalShell } from "../components/ModalShell";
import { Btn, RDS_COLORS, Toggle } from "../components/primitives";

const PROFILES = [
	{ key: "fast", labelKey: "routing.profile.fast", icon: I.zap, hintKey: "routing.profile.fastHint" },
	{ key: "scenic", labelKey: "routing.profile.scenic", icon: I.mountain, hintKey: "routing.profile.scenicHint" },
	{ key: "safe", labelKey: "routing.profile.safe", icon: I.flag, hintKey: "routing.profile.safeHint" },
	{ key: "flat", labelKey: "routing.profile.flat", icon: I.trend, hintKey: "routing.profile.flatHint" },
] as const;

interface PrefRow {
	key: "bike" | "climbs" | "unpaved" | "highways" | "snap";
	icon: React.ComponentType<{ size?: number }>;
	labelKey: string;
	subKey: string;
	slider?: boolean;
	comingSoon?: boolean;
}

const PREFS: PrefRow[] = [
	{ key: "bike", icon: I.bike, labelKey: "routing.pref.bike", subKey: "common.comingSoon", comingSoon: true },
	{
		key: "climbs",
		icon: I.mountain,
		labelKey: "routing.pref.climbs",
		subKey: "common.comingSoon",
		slider: true,
		comingSoon: true,
	},
	{ key: "unpaved", icon: I.flag, labelKey: "routing.pref.unpaved", subKey: "common.comingSoon", comingSoon: true },
	{ key: "highways", icon: I.trend, labelKey: "routing.pref.highways", subKey: "routing.pref.highwaysSub" },
	{ key: "snap", icon: I.target, labelKey: "routing.pref.snap", subKey: "routing.pref.snapSub" },
];

export function RoutingModal() {
	const close = useModalsStore((s) => s.closeModal);
	const pushToast = useToastStore((s) => s.push);
	const language = useUiStore((s) => s.language);
	const prefs = useRoutingPreferencesStore();

	const reset = () => prefs.reset();

	const apply = () => {
		window.dispatchEvent(new CustomEvent("routess:recalculate-route"));
		pushToast({
			kind: "success",
			title: t("routing.appliedTitle", language),
			body: t("routing.appliedBody", language),
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
			title={t("routing.title", language)}
			sub={t("routing.subtitle", language)}
			width={520}
			onClose={close}
			footer={
				<>
					<Btn
						variant="ghost"
						onClick={reset}
						title={t("routing.restoreDefaults", language, { profile: DEFAULT_ROUTING_PREFERENCES.profile })}
					>
						{t("routing.reset", language)}
					</Btn>
					<div style={{ flex: 1 }} />
					<Btn onClick={close}>{t("common.cancel", language)}</Btn>
					<Btn variant="primary" onClick={apply}>
						{t("routing.apply", language)}
					</Btn>
				</>
			}
		>
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
							<div style={{ fontSize: 12.5, fontWeight: 600 }}>{t(p.labelKey, language)}</div>
							<div className="rds-mono" style={{ fontSize: 10, color: RDS_COLORS.fgSubtle }}>
								{t(p.hintKey, language)}
							</div>
						</button>
					);
				})}
			</div>

			{PREFS.map((row, i) => {
				const Icon = row.icon;
				const on = getPref(row.key);
				const disabled = row.comingSoon === true;
				return (
					<div
						key={row.key}
						style={{
							display: "flex",
							alignItems: "flex-start",
							gap: 12,
							padding: "12px 0",
							borderBottom: i < PREFS.length - 1 ? `1px solid ${RDS_COLORS.border}` : "none",
							opacity: disabled ? 0.5 : 1,
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
							<div style={{ fontSize: 13, fontWeight: 500 }}>{t(row.labelKey, language)}</div>
							<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>
								{t(row.subKey, language)}
								{row.slider && on && !disabled ? <span className="rds-mono"> · {prefs.climbGradient}%</span> : null}
							</div>
							{row.slider && on && !disabled && (
								<input
									type="range"
									min={MIN_CLIMB_GRADIENT}
									max={MAX_CLIMB_GRADIENT}
									step={1}
									value={prefs.climbGradient}
									onChange={(e) => prefs.setClimbGradient(Number(e.target.value))}
									aria-label={t("routing.maxGradient", language)}
									style={{
										marginTop: 8,
										width: "100%",
										accentColor: RDS_COLORS.accent,
										cursor: "pointer",
									}}
								/>
							)}
						</div>
						<Toggle on={on} onChange={(v) => setPref(row.key, v)} disabled={disabled} />
					</div>
				);
			})}
		</ModalShell>
	);
}
