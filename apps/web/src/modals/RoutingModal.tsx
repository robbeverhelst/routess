import {
	defaultPreferencesForActivity,
	type HillPreference,
	type RouteActivity,
	type RoutingPreferences,
	type SurfaceType,
} from "@routess/core";
import { useEffect, useState } from "react";
import { emitAppEvent } from "@/lib/app-events";
import { useT } from "@/lib/i18n";
import { useModalsStore } from "@/stores/modalsStore";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { useDraftActivity, useDraftRoutingPreferences, useSetRoutingPreferences } from "@/stores/routingStore";
import { useToastStore } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { ModalShell } from "../components/ModalShell";
import { Btn, RDS_COLORS, Toggle } from "../components/primitives";

const SURFACE_OPTIONS: { key: SurfaceType; labelKey: string }[] = [
	{ key: "paved", labelKey: "routing.surface.paved" },
	{ key: "mixed", labelKey: "routing.surface.mixed" },
	{ key: "unpaved", labelKey: "routing.surface.unpaved" },
];

const HILL_OPTIONS: { key: HillPreference; labelKey: string }[] = [
	{ key: "flat", labelKey: "routing.hill.flat" },
	{ key: "mixed", labelKey: "routing.hill.mixed" },
	{ key: "hilly", labelKey: "routing.hill.hilly" },
];

function Segmented<T extends string>({
	options,
	value,
	onChange,
	t,
}: {
	options: { key: T; labelKey: string }[];
	value: T;
	onChange: (v: T) => void;
	t: (k: string) => string;
}) {
	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: `repeat(${options.length}, 1fr)`,
				gap: 4,
				background: RDS_COLORS.bgInput,
				border: `1px solid ${RDS_COLORS.border}`,
				borderRadius: 8,
				padding: 3,
			}}
		>
			{options.map((opt) => {
				const on = value === opt.key;
				return (
					<button
						key={opt.key}
						type="button"
						onClick={() => onChange(opt.key)}
						style={{
							padding: "8px 6px",
							borderRadius: 6,
							background: on ? RDS_COLORS.accent : "transparent",
							color: on ? "white" : RDS_COLORS.fg,
							border: "none",
							fontSize: 12,
							fontWeight: 500,
							cursor: "pointer",
							transition: "background 120ms",
						}}
					>
						{t(opt.labelKey)}
					</button>
				);
			})}
		</div>
	);
}

function FieldRow({
	icon: Icon,
	label,
	hint,
	children,
}: {
	icon: React.ComponentType<{ size?: number }>;
	label: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 0" }}>
			<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
					}}
				>
					<Icon size={14} />
				</div>
				<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
					<div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
					{hint ? <div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>{hint}</div> : null}
				</div>
			</div>
			<div>{children}</div>
		</div>
	);
}

// Resolves the prefs that should populate the modal on open: prefer the
// draft's saved prefs (ADR-0023), fall back to the user's per-Activity default,
// final fallback is the built-in default for the activity.
function useResolvedPreferences(activity: RouteActivity): RoutingPreferences {
	const draftPrefs = useDraftRoutingPreferences();
	const userDefaults = useRedesignSettingsStore((s) => s.routingDefaults);
	if (draftPrefs) return draftPrefs;
	return userDefaults?.[activity] ?? defaultPreferencesForActivity(activity);
}

export function RoutingModal() {
	const close = useModalsStore((s) => s.closeModal);
	const pushToast = useToastStore((s) => s.push);
	const t = useT();

	const draftActivity = useDraftActivity();
	const globalActivity = useUiStore((s) => s.activityType);
	const activity = draftActivity ?? globalActivity;

	const committed = useResolvedPreferences(activity);
	const setRoutingPreferences = useSetRoutingPreferences();

	// Modal-local pending state (Q7 R3). Toggles do NOT mutate the draft until
	// Apply commits the whole bundle and recalc fires.
	const [pending, setPending] = useState<RoutingPreferences>(committed);

	// Re-seed pending state when activity changes under us. We intentionally
	// exclude `committed` from deps: the committed value is what populates the
	// initial pending state, and including it would clobber the user's pending
	// edits on every render.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	useEffect(() => {
		setPending(committed);
	}, [activity]);

	const dirty = JSON.stringify(pending) !== JSON.stringify(committed);

	const update = (patch: Partial<RoutingPreferences>) => setPending((p) => ({ ...p, ...patch }));
	const reset = () => setPending(defaultPreferencesForActivity(activity));

	const apply = () => {
		setRoutingPreferences(pending);
		emitAppEvent("routess:recalculate-route");
		pushToast({
			kind: "success",
			title: t("routing.appliedTitle"),
			body: t("routing.appliedBody"),
			durationMs: 2200,
		});
		close();
	};

	const cancel = () => close();

	return (
		<ModalShell
			title={t("routing.title")}
			sub={t("routing.subtitle")}
			width={520}
			onClose={cancel}
			footer={
				<>
					<Btn variant="ghost" onClick={reset} title={t("routing.restoreDefaults", { profile: "default" })}>
						{t("routing.reset")}
					</Btn>
					<div style={{ flex: 1 }} />
					<Btn onClick={cancel}>{t("common.cancel")}</Btn>
					<Btn variant="primary" onClick={apply} disabled={!dirty}>
						{t("routing.apply")}
					</Btn>
				</>
			}
		>
			<FieldRow icon={I.flag} label={t("routing.surface.label")} hint={t("routing.surface.hint")}>
				<Segmented<SurfaceType>
					options={SURFACE_OPTIONS}
					value={pending.surfacePreference}
					onChange={(v) => update({ surfacePreference: v })}
					t={t}
				/>
			</FieldRow>

			<FieldRow icon={I.mountain} label={t("routing.hill.label")} hint={t("routing.hill.hint")}>
				<Segmented<HillPreference>
					options={HILL_OPTIONS}
					value={pending.hillPreference}
					onChange={(v) => update({ hillPreference: v })}
					t={t}
				/>
			</FieldRow>

			{activity === "cycle" && (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 12,
						padding: "12px 0",
						borderTop: `1px solid ${RDS_COLORS.border}`,
						marginTop: 8,
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
						}}
					>
						<I.trend size={14} />
					</div>
					<div style={{ flex: 1 }}>
						<div style={{ fontSize: 13, fontWeight: 500 }}>{t("routing.pref.highways")}</div>
						<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>
							{t("routing.pref.highwaysSub")}
						</div>
					</div>
					<Toggle on={pending.avoidHighways} onChange={(v) => update({ avoidHighways: v })} />
				</div>
			)}

			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 12,
					padding: "12px 0",
					borderTop: `1px solid ${RDS_COLORS.border}`,
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
					}}
				>
					<I.share size={14} />
				</div>
				<div style={{ flex: 1 }}>
					<div style={{ fontSize: 13, fontWeight: 500 }}>{t("routing.ferries.label")}</div>
					<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>{t("routing.ferries.hint")}</div>
				</div>
				<Toggle on={pending.avoidFerries} onChange={(v) => update({ avoidFerries: v })} />
			</div>
		</ModalShell>
	);
}
