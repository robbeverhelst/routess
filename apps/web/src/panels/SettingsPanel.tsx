import type { RouteVisibility } from "@routess/core";
import { type ComponentType, useEffect, useState } from "react";
import { useLogout, useUserProfile } from "@/lib/api-queries";
import { emitAppEvent } from "@/lib/app-events";
import { type SupportedLanguage, t, tIn } from "@/lib/i18n";
import { getVersionDisplay } from "@/lib/version";
import { usePreferencesSyncStore } from "@/stores/preferencesSyncStore";
import {
	DEFAULT_SPORT_SPEEDS_KMH,
	getSpeedForActivity,
	type RedesignMapStyle,
	SPORT_SPEED_MAX_KMH,
	SPORT_SPEED_MIN_KMH,
	useRedesignSettingsStore,
} from "@/stores/redesignSettingsStore";
import { useToastStore } from "@/stores/toastStore";
import { type RedesignAccent, type RedesignActivity, useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { Btn, RDS_COLORS, Toggle } from "../components/primitives";
import {
	Segmented,
	Select,
	SettingsBlock,
	SettingsDetailHeader,
	SettingsNavRow,
	SettingsRow,
	SettingsSection,
	TextInput,
} from "../components/settings";
import { ApiTokensSection } from "./ApiTokensSection";

type SettingsSectionKey = "account" | "sports" | "mapDisplay" | "privacy" | "advanced";

const SECTIONS: {
	key: SettingsSectionKey;
	icon: ComponentType<{ size?: number }>;
	titleKey: string;
	subKey: string;
}[] = [
	{ key: "account", icon: I.user, titleKey: "settings.section.account", subKey: "settings.section.accountSub" },
	{ key: "sports", icon: I.activity, titleKey: "settings.section.sports", subKey: "settings.section.sportsSub" },
	{
		key: "mapDisplay",
		icon: I.layers,
		titleKey: "settings.section.mapDisplay",
		subKey: "settings.section.mapDisplaySub",
	},
	{ key: "privacy", icon: I.shield, titleKey: "settings.section.privacy", subKey: "settings.section.privacySub" },
	{ key: "advanced", icon: I.sliders, titleKey: "settings.section.advanced", subKey: "settings.section.advancedSub" },
];

const LANGUAGE_OPTIONS: { value: SupportedLanguage; label: string }[] = [
	{ value: "en", label: "English" },
	{ value: "nl", label: "Nederlands" },
	{ value: "fr", label: "Français" },
	{ value: "de", label: "Deutsch" },
];

const SPORT_OPTIONS: { key: RedesignActivity; labelKey: string; icon: ComponentType<{ size?: number }> }[] = [
	{ key: "run", labelKey: "sport.run", icon: I.run },
	{ key: "cycle", labelKey: "sport.cycle", icon: I.bike },
	{ key: "walk", labelKey: "sport.walk", icon: I.walk },
];

const SPORT_LABEL_KEYS: Record<RedesignActivity, string> = {
	run: "sport.run",
	cycle: "sport.cycle",
	walk: "sport.walk",
};

const VISIBILITY_OPTIONS: { key: RouteVisibility; labelKey: string; subKey: string }[] = [
	{ key: "private", labelKey: "save.visibility.private", subKey: "save.visibility.privateSub" },
	{ key: "unlisted", labelKey: "save.visibility.unlisted", subKey: "save.visibility.unlistedSub" },
	{ key: "public", labelKey: "save.visibility.public", subKey: "save.visibility.publicSub" },
];

const KM_PER_MILE = 1.609344;

function formatSpeedDraft(kmh: number, units: "km" | "mi"): string {
	const display = units === "mi" ? kmh / KM_PER_MILE : kmh;
	return Number.isFinite(display) ? String(Math.round(display * 10) / 10) : "";
}

function SpeedRow({
	label,
	sub,
	kmh,
	units,
	onChange,
	onReset,
	isDefault,
}: {
	label: string;
	sub: string;
	kmh: number;
	units: "km" | "mi";
	onChange: (kmh: number) => void;
	onReset: () => void;
	isDefault: boolean;
}) {
	const unitLabel = units === "mi" ? "mph" : "km/h";
	const [draft, setDraft] = useState(() => formatSpeedDraft(kmh, units));
	const [isEditing, setIsEditing] = useState(false);

	useEffect(() => {
		if (!isEditing) {
			setDraft(formatSpeedDraft(kmh, units));
		}
	}, [isEditing, kmh, units]);

	const commitDraft = () => {
		const n = Number.parseFloat(draft);
		if (Number.isFinite(n) && n > 0) {
			onChange(units === "mi" ? n * KM_PER_MILE : n);
			return;
		}
		setDraft(formatSpeedDraft(kmh, units));
	};

	return (
		<SettingsRow
			label={label}
			sub={sub}
			control={
				<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
					<TextInput
						type="number"
						inputMode="decimal"
						min={units === "mi" ? Math.round((SPORT_SPEED_MIN_KMH / KM_PER_MILE) * 10) / 10 : SPORT_SPEED_MIN_KMH}
						max={units === "mi" ? Math.round(SPORT_SPEED_MAX_KMH / KM_PER_MILE) : SPORT_SPEED_MAX_KMH}
						step={units === "mi" ? 0.5 : 1}
						value={draft}
						onChange={(e) => {
							setDraft(e.target.value);
						}}
						onFocus={() => setIsEditing(true)}
						onBlur={() => {
							setIsEditing(false);
							commitDraft();
						}}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.currentTarget.blur();
							}
							if (e.key === "Escape") {
								setDraft(formatSpeedDraft(kmh, units));
								e.currentTarget.blur();
							}
						}}
						style={{ width: 68, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
					/>
					<span style={{ fontSize: 11.5, color: RDS_COLORS.fgMuted, width: 32 }}>{unitLabel}</span>
					<Btn
						variant="ghost"
						onClick={onReset}
						disabled={isDefault}
						title={isDefault ? "Already at default" : "Reset to default"}
					>
						<I.refresh size={12} />
					</Btn>
				</div>
			}
		/>
	);
}

function SyncStatusPill() {
	const status = usePreferencesSyncStore((s) => s.status);
	if (status === "idle") return null;
	const label =
		status === "saving"
			? t("settings.sync.saving")
			: status === "saved"
				? t("settings.sync.saved")
				: t("settings.sync.failed");
	return (
		<div
			role="status"
			style={{
				position: "sticky",
				bottom: 8,
				display: "flex",
				justifyContent: "center",
				pointerEvents: "none",
				marginTop: 10,
			}}
		>
			<span
				style={{
					padding: "4px 12px",
					borderRadius: 999,
					background: RDS_COLORS.bgPanelElev,
					border: `1px solid ${RDS_COLORS.border}`,
					fontSize: 11.5,
					color: status === "error" ? RDS_COLORS.danger : RDS_COLORS.fgMuted,
					boxShadow: "var(--rds-shadow-lg)",
				}}
			>
				{label}
			</span>
		</div>
	);
}

const ACCENT_OPTIONS: { key: RedesignAccent; labelKey: string; swatch: string }[] = [
	{ key: "violet", labelKey: "settings.accent.violet", swatch: "oklch(0.5 0.17 282)" },
	{ key: "cobalt", labelKey: "settings.accent.cobalt", swatch: "oklch(0.5 0.17 250)" },
	{ key: "forest", labelKey: "settings.accent.forest", swatch: "oklch(0.48 0.13 155)" },
	{ key: "ember", labelKey: "settings.accent.ember", swatch: "oklch(0.55 0.18 30)" },
];

export function SettingsPanel() {
	const [section, setSection] = useState<SettingsSectionKey | null>(null);
	const { data: profile } = useUserProfile();
	const logout = useLogout();
	const pushToast = useToastStore((s) => s.push);
	const { accent, setAccent, theme, setTheme, activityType, setActivityType, language, setLanguage } = useUiStore();
	const {
		units,
		setUnits,
		setDefaultActivity,
		selectedSports,
		toggleSport,
		sportSpeeds,
		setSportSpeed,
		mapStyle,
		setMapStyle,
		defaultRouteVisibility,
		setDefaultRouteVisibility,
	} = useRedesignSettingsStore();
	const autoSnap = useRedesignSettingsStore((s) => s.autoSnap);
	const setAutoSnap = useRedesignSettingsStore((s) => s.setAutoSnap);
	const showOffTrackGuideLine = useRedesignSettingsStore((s) => s.showOffTrackGuideLine);
	const setShowOffTrackGuideLine = useRedesignSettingsStore((s) => s.setShowOffTrackGuideLine);
	const showHeadingCone = useRedesignSettingsStore((s) => s.showHeadingCone);
	const setShowHeadingCone = useRedesignSettingsStore((s) => s.setShowHeadingCone);
	const showNodeNetworkOverlays = useRedesignSettingsStore((s) => s.showNodeNetworkOverlays);
	const setShowNodeNetworkOverlays = useRedesignSettingsStore((s) => s.setShowNodeNetworkOverlays);

	const defaultSport: RedesignActivity | null =
		selectedSports.length === 0 ? null : selectedSports.includes(activityType) ? activityType : selectedSports[0];

	const handleToggleSport = (sport: RedesignActivity) => {
		const wasOnly = selectedSports.length === 1 && selectedSports[0] === sport;
		if (wasOnly) {
			pushToast({ kind: "warn", title: t("settings.sports.minimum") });
			return;
		}
		toggleSport(sport);
		if (selectedSports.includes(sport) && sport === defaultSport) {
			const fallback = selectedSports.find((s) => s !== sport);
			if (fallback) {
				setActivityType(fallback);
				setDefaultActivity(tIn("en", SPORT_LABEL_KEYS[fallback]));
			}
		} else if (!selectedSports.includes(sport) && selectedSports.length === 0) {
			setActivityType(sport);
			setDefaultActivity(tIn("en", SPORT_LABEL_KEYS[sport]));
		}
	};

	const handleSetDefault = (sport: RedesignActivity) => {
		if (!selectedSports.includes(sport)) {
			toggleSport(sport);
		}
		setActivityType(sport);
		setDefaultActivity(tIn("en", SPORT_LABEL_KEYS[sport]));
	};

	const handleEditProfile = () => {
		emitAppEvent("routess:open-account");
	};

	const handleSignOut = () => {
		if (!profile) {
			emitAppEvent("routess:open-login");
			return;
		}
		logout.mutate(undefined, {
			onSuccess: () => {
				pushToast({ kind: "success", title: t("common.signedOut") });
			},
		});
	};

	const active = section ? SECTIONS.find((s) => s.key === section) : null;

	if (!active) {
		return (
			<div style={{ padding: 20, overflow: "auto", height: "100%" }}>
				<SettingsSection>
					{SECTIONS.map((s) => (
						<SettingsNavRow
							key={s.key}
							icon={s.icon}
							label={t(s.titleKey)}
							sub={t(s.subKey)}
							onClick={() => setSection(s.key)}
						/>
					))}
				</SettingsSection>
				<div
					style={{
						textAlign: "center",
						fontSize: 11.5,
						color: RDS_COLORS.fgSubtle,
						fontVariantNumeric: "tabular-nums",
					}}
				>
					routess {getVersionDisplay()}
				</div>
				<SyncStatusPill />
			</div>
		);
	}

	return (
		<div style={{ padding: 20, overflow: "auto", height: "100%" }}>
			<SettingsDetailHeader title={t(active.titleKey)} backLabel={t("nav.settings")} onBack={() => setSection(null)} />

			{section === "account" && (
				<SettingsSection>
					<SettingsRow
						label={profile ? t("settings.account.manage") : t("settings.account.signInPrompt")}
						sub={profile ? t("settings.account.manageSub") : t("settings.account.signInSub")}
						control={
							<Btn
								variant={profile ? "ghost" : "primary"}
								onClick={profile ? handleEditProfile : handleSignOut}
								disabled={!profile && logout.isPending}
							>
								{profile ? t("settings.account.open") : t("common.signIn")}
							</Btn>
						}
					/>
				</SettingsSection>
			)}

			{section === "sports" && (
				<>
					<SettingsSection>
						<SettingsBlock>
							<div style={{ fontSize: 13, color: RDS_COLORS.fg }}>{t("settings.sports.title")}</div>
							<div
								style={{
									fontSize: 11.5,
									color: RDS_COLORS.fgSubtle,
									marginTop: 4,
									maxWidth: 360,
									lineHeight: 1.45,
								}}
							>
								{t("settings.sports.subtitle")}
							</div>
							<div
								style={{
									display: "flex",
									flexWrap: "wrap",
									gap: 10,
									marginTop: 14,
								}}
							>
								{SPORT_OPTIONS.map((s) => {
									const on = selectedSports.includes(s.key);
									const isDefault = on && defaultSport === s.key;
									const Icon = s.icon;
									const sportLabel = t(s.labelKey);
									return (
										<div
											key={s.key}
											style={{
												display: "inline-flex",
												alignItems: "center",
												gap: 6,
												padding: 4,
												borderRadius: 999,
												background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
												border: `1px solid ${on ? RDS_COLORS.accent : RDS_COLORS.border}`,
											}}
										>
											<button
												type="button"
												onClick={() => handleToggleSport(s.key)}
												aria-pressed={on}
												title={
													on
														? t("settings.sports.removeAria", { sport: sportLabel })
														: t("settings.sports.addAria", { sport: sportLabel })
												}
												style={{
													display: "inline-flex",
													alignItems: "center",
													gap: 7,
													padding: "6px 10px",
													borderRadius: 999,
													background: "transparent",
													border: 0,
													color: on ? RDS_COLORS.accent : RDS_COLORS.fgMuted,
													fontSize: 12.5,
													fontWeight: 600,
													cursor: "pointer",
												}}
											>
												<Icon size={12} />
												{sportLabel}
											</button>
											<button
												type="button"
												onClick={() => handleSetDefault(s.key)}
												aria-pressed={isDefault}
												title={
													isDefault
														? t("settings.sports.defaultTitle")
														: t("settings.sports.makeDefault", { sport: sportLabel })
												}
												style={{
													width: 26,
													height: 26,
													padding: 0,
													borderRadius: 999,
													background: isDefault ? RDS_COLORS.accent : RDS_COLORS.bgPanel,
													color: isDefault ? RDS_COLORS.accentFg : on ? RDS_COLORS.accent : RDS_COLORS.fgSubtle,
													border: isDefault ? "none" : `1px solid ${on ? RDS_COLORS.accent : RDS_COLORS.border}`,
													display: "inline-flex",
													alignItems: "center",
													justifyContent: "center",
													cursor: isDefault ? "default" : "pointer",
													boxShadow: isDefault ? "0 0 0 1px rgba(255,255,255,0.24) inset" : "none",
												}}
											>
												<I.check size={12} />
											</button>
										</div>
									);
								})}
							</div>
						</SettingsBlock>
						<SettingsRow
							label={t("settings.units.label")}
							control={
								<Segmented
									value={units}
									onChange={(v) => setUnits(v as "km" | "mi")}
									options={[
										{ value: "km", label: t("settings.units.metric") },
										{ value: "mi", label: t("settings.units.imperial") },
									]}
								/>
							}
						/>
					</SettingsSection>

					{selectedSports.length > 0 && (
						<SettingsSection title={t("settings.pace.title")}>
							{selectedSports.map((sport) => {
								const cfg = SPORT_OPTIONS.find((s) => s.key === sport);
								if (!cfg) return null;
								const kmh = getSpeedForActivity(sport, sportSpeeds);
								return (
									<SpeedRow
										key={sport}
										label={t(cfg.labelKey)}
										sub={t("settings.pace.subtitle")}
										kmh={kmh}
										units={units}
										onChange={(next) => setSportSpeed(sport, next)}
										onReset={() => setSportSpeed(sport, DEFAULT_SPORT_SPEEDS_KMH[sport])}
										isDefault={kmh === DEFAULT_SPORT_SPEEDS_KMH[sport]}
									/>
								);
							})}
						</SettingsSection>
					)}
				</>
			)}

			{section === "mapDisplay" && (
				<>
					<SettingsSection title={t("settings.map.label")}>
						<SettingsRow
							label={t("settings.map.styleLabel")}
							control={
								<Select
									value={mapStyle}
									onChange={(e) => setMapStyle(e.target.value as RedesignMapStyle)}
									aria-label={t("settings.map.styleLabel")}
								>
									<option value="streets">{t("settings.map.streets")}</option>
									<option value="outdoors">{t("settings.map.outdoors")}</option>
									<option value="satellite">{t("settings.map.satellite")}</option>
								</Select>
							}
						/>
						<SettingsRow
							label={t("settings.map.autoSnap")}
							control={<Toggle on={autoSnap} onChange={setAutoSnap} label={t("settings.map.autoSnap")} />}
						/>
						<SettingsRow
							label={t("settings.map.offTrackGuide")}
							sub={t("settings.map.offTrackGuideSub")}
							control={
								<Toggle
									on={showOffTrackGuideLine}
									onChange={setShowOffTrackGuideLine}
									label={t("settings.map.offTrackGuide")}
								/>
							}
						/>
						<SettingsRow
							label={t("settings.map.headingCone")}
							sub={t("settings.map.headingConeSub")}
							control={
								<Toggle on={showHeadingCone} onChange={setShowHeadingCone} label={t("settings.map.headingCone")} />
							}
						/>
					</SettingsSection>

					<SettingsSection title={t("settings.appearance")}>
						<SettingsRow
							label={t("settings.language")}
							control={
								<Select
									value={language}
									onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
									aria-label={t("settings.language")}
								>
									{LANGUAGE_OPTIONS.map((o) => (
										<option key={o.value} value={o.value}>
											{o.label}
										</option>
									))}
								</Select>
							}
						/>
						<SettingsRow
							label={t("settings.theme")}
							control={
								<Segmented
									value={theme}
									onChange={(v) => setTheme(v as "light" | "dark")}
									options={[
										{ value: "light", label: t("settings.theme.light") },
										{ value: "dark", label: t("settings.theme.dark") },
									]}
								/>
							}
						/>
						<SettingsRow
							label={t("settings.accent.label")}
							control={
								<div style={{ display: "flex", gap: 6 }}>
									{ACCENT_OPTIONS.map((a) => {
										const on = accent === a.key;
										return (
											<button
												key={a.key}
												type="button"
												onClick={() => setAccent(a.key)}
												title={t(a.labelKey)}
												aria-pressed={on}
												style={{
													width: 22,
													height: 22,
													borderRadius: 999,
													background: a.swatch,
													border: on ? `2px solid ${RDS_COLORS.fg}` : `2px solid ${RDS_COLORS.border}`,
													cursor: "pointer",
													padding: 0,
												}}
											/>
										);
									})}
								</div>
							}
						/>
					</SettingsSection>
				</>
			)}

			{section === "privacy" && (
				<SettingsSection title={t("settings.routingDefaults")}>
					<SettingsRow
						label={t("settings.routingDefaults.visibility")}
						sub={t("settings.routingDefaults.visibilitySub")}
						control={
							<Select
								value={defaultRouteVisibility}
								onChange={(e) => setDefaultRouteVisibility(e.target.value as RouteVisibility)}
								aria-label={t("settings.routingDefaults.visibility")}
							>
								{VISIBILITY_OPTIONS.map((opt) => (
									<option key={opt.key} value={opt.key}>
										{t(opt.labelKey)}
									</option>
								))}
							</Select>
						}
					/>
				</SettingsSection>
			)}

			{section === "advanced" && (
				<>
					{profile && <ApiTokensSection />}
					<SettingsSection title={t("settings.experimental")}>
						<SettingsRow
							label={t("settings.experimental.nodeNetworkOverlays")}
							sub={t("settings.experimental.nodeNetworkOverlaysSub")}
							control={
								<Toggle
									on={showNodeNetworkOverlays}
									onChange={setShowNodeNetworkOverlays}
									label={t("settings.experimental.nodeNetworkOverlays")}
								/>
							}
						/>
					</SettingsSection>
				</>
			)}

			<SyncStatusPill />
		</div>
	);
}
