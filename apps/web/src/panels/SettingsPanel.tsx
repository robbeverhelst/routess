import type { ReactNode } from "react";
import { useLogout, useUserProfile } from "@/lib/api-queries";
import { type SupportedLanguage, t } from "@/lib/i18n";
import { getVersionDisplay } from "@/lib/version";
import { type RedesignMapStyle, useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { useRoutingPreferencesStore } from "@/stores/routingPreferencesStore";
import { useToastStore } from "@/stores/toastStore";
import { type RedesignAccent, type RedesignActivity, useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { Btn, RDS_COLORS, SecTitle, Toggle } from "../components/primitives";

const LANGUAGE_OPTIONS: { value: SupportedLanguage; label: string }[] = [
	{ value: "en", label: "English" },
	{ value: "nl", label: "Nederlands" },
	{ value: "fr", label: "Français" },
	{ value: "de", label: "Deutsch" },
];

const SPORT_OPTIONS: { key: RedesignActivity; labelKey: string; icon: React.ComponentType<{ size?: number }> }[] = [
	{ key: "run", labelKey: "sport.run", icon: I.run },
	{ key: "cycle", labelKey: "sport.cycle", icon: I.bike },
	{ key: "walk", labelKey: "sport.walk", icon: I.walk },
];

const SPORT_LABEL_KEYS: Record<RedesignActivity, string> = {
	run: "sport.run",
	cycle: "sport.cycle",
	walk: "sport.walk",
};

function Group({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div style={{ marginBottom: 22 }}>
			<SecTitle style={{ marginBottom: 10 }}>{title}</SecTitle>
			<div
				style={{
					background: RDS_COLORS.bgPanel,
					border: `1px solid ${RDS_COLORS.border}`,
					borderRadius: 10,
					overflow: "hidden",
				}}
			>
				{children}
			</div>
		</div>
	);
}

function Row({ label, sub, control, last }: { label: string; sub?: string; control: ReactNode; last?: boolean }) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "12px 14px",
				borderBottom: last ? "none" : `1px solid ${RDS_COLORS.border}`,
			}}
		>
			<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
				<div style={{ fontSize: 13, color: RDS_COLORS.fg }}>{label}</div>
				{sub && <div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>{sub}</div>}
			</div>
			{control}
		</div>
	);
}

function Segmented({
	value,
	onChange,
	options,
}: {
	value: string;
	onChange: (v: string) => void;
	options: { value: string; label: string }[];
}) {
	return (
		<div
			style={{
				display: "flex",
				gap: 4,
				background: RDS_COLORS.bgInput,
				padding: 2,
				borderRadius: 6,
			}}
		>
			{options.map((o) => {
				const on = value === o.value;
				return (
					<button
						key={o.value}
						type="button"
						onClick={() => onChange(o.value)}
						style={{
							padding: "4px 10px",
							borderRadius: 4,
							background: on ? RDS_COLORS.bgPanel : "transparent",
							border: 0,
							fontSize: 12,
							fontWeight: 500,
							color: on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
							cursor: "pointer",
						}}
					>
						{o.label}
					</button>
				);
			})}
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
	const { data: profile } = useUserProfile();
	const logout = useLogout();
	const pushToast = useToastStore((s) => s.push);
	const { accent, setAccent, theme, setTheme, activityType, setActivityType, language, setLanguage } = useUiStore();
	const {
		units,
		setUnits,
		showPois,
		setShowPois,
		terrain3d,
		setTerrain3d,
		publicProfile,
		setPublicProfile,
		hidePrivacy,
		setHidePrivacy,
		setDefaultActivity,
		selectedSports,
		toggleSport,
		mapStyle,
		setMapStyle,
	} = useRedesignSettingsStore();
	const autoSnap = useRoutingPreferencesStore((s) => s.snap);
	const setAutoSnap = useRoutingPreferencesStore((s) => s.setSnap);

	const defaultSport: RedesignActivity | null =
		selectedSports.length === 0 ? null : selectedSports.includes(activityType) ? activityType : selectedSports[0];

	const handleToggleSport = (sport: RedesignActivity) => {
		const wasOnly = selectedSports.length === 1 && selectedSports[0] === sport;
		if (wasOnly) {
			pushToast({ kind: "warn", title: t("settings.sports.minimum", language) });
			return;
		}
		toggleSport(sport);
		if (selectedSports.includes(sport) && sport === defaultSport) {
			const fallback = selectedSports.find((s) => s !== sport);
			if (fallback) {
				setActivityType(fallback);
				setDefaultActivity(t(SPORT_LABEL_KEYS[fallback], "en"));
			}
		} else if (!selectedSports.includes(sport) && selectedSports.length === 0) {
			setActivityType(sport);
			setDefaultActivity(t(SPORT_LABEL_KEYS[sport], "en"));
		}
	};

	const handleSetDefault = (sport: RedesignActivity) => {
		if (!selectedSports.includes(sport)) {
			toggleSport(sport);
		}
		setActivityType(sport);
		setDefaultActivity(t(SPORT_LABEL_KEYS[sport], "en"));
	};

	const userName = profile?.name ?? t("settings.profile.yourAccount", language);
	const userEmail = profile?.email ?? t("settings.profile.signInToSync", language);

	const handleEditProfile = () => {
		window.dispatchEvent(new CustomEvent("routess:open-account"));
	};

	const handleExportData = () => {
		window.dispatchEvent(new CustomEvent("routess:export-all-data"));
	};

	const handleMapStyleChange = (nextStyle: RedesignMapStyle) => {
		setMapStyle(nextStyle);
	};

	const handleShowPoisChange = (next: boolean) => {
		setShowPois(next);
	};

	const handleSignOut = () => {
		if (!profile) {
			window.dispatchEvent(new CustomEvent("routess:open-login"));
			return;
		}
		logout.mutate(undefined, {
			onSuccess: () => {
				pushToast({ kind: "success", title: t("common.signedOut", language) });
			},
		});
	};

	return (
		<div style={{ padding: "20px 20px", overflow: "auto", height: "100%" }}>
			<Group title={t("settings.profile", language)}>
				<Row
					label={userName}
					sub={userEmail}
					control={
						<Btn variant="ghost" onClick={handleEditProfile}>
							{t("settings.profile.edit", language)}
						</Btn>
					}
				/>
				<div
					style={{
						padding: "14px 14px 16px",
						borderBottom: `1px solid ${RDS_COLORS.border}`,
					}}
				>
					<div style={{ fontSize: 13, color: RDS_COLORS.fg }}>{t("settings.sports.title", language)}</div>
					<div
						style={{
							fontSize: 11.5,
							color: RDS_COLORS.fgSubtle,
							marginTop: 4,
							maxWidth: 360,
							lineHeight: 1.45,
						}}
					>
						{t("settings.sports.subtitle", language)}
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
							const sportLabel = t(s.labelKey, language);
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
												? t("settings.sports.removeAria", language, { sport: sportLabel })
												: t("settings.sports.addAria", language, { sport: sportLabel })
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
												? t("settings.sports.defaultTitle", language)
												: t("settings.sports.makeDefault", language, { sport: sportLabel })
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
				</div>
				<Row
					label={t("settings.units.label", language)}
					control={
						<Segmented
							value={units}
							onChange={(v) => setUnits(v as "km" | "mi")}
							options={[
								{ value: "km", label: t("settings.units.metric", language) },
								{ value: "mi", label: t("settings.units.imperial", language) },
							]}
						/>
					}
					last
				/>
			</Group>

			<Group title={t("settings.appearance", language)}>
				<Row
					label={t("settings.language", language)}
					control={
						<select
							value={language}
							onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
							style={{
								height: 30,
								padding: "0 8px",
								borderRadius: 6,
								background: RDS_COLORS.bgInput,
								border: `1px solid ${RDS_COLORS.border}`,
								color: RDS_COLORS.fg,
								fontSize: 12.5,
							}}
						>
							{LANGUAGE_OPTIONS.map((o) => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
					}
				/>
				<Row
					label={t("settings.theme", language)}
					control={
						<Segmented
							value={theme}
							onChange={(v) => setTheme(v as "light" | "dark")}
							options={[
								{ value: "light", label: t("settings.theme.light", language) },
								{ value: "dark", label: t("settings.theme.dark", language) },
							]}
						/>
					}
				/>
				<Row
					label={t("settings.accent.label", language)}
					control={
						<div style={{ display: "flex", gap: 6 }}>
							{ACCENT_OPTIONS.map((a) => {
								const on = accent === a.key;
								return (
									<button
										key={a.key}
										type="button"
										onClick={() => setAccent(a.key)}
										title={t(a.labelKey, language)}
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
					last
				/>
			</Group>

			<Group title={t("settings.map.label", language)}>
				<Row
					label={t("settings.map.styleLabel", language)}
					control={
						<select
							value={mapStyle}
							onChange={(e) => handleMapStyleChange(e.target.value as RedesignMapStyle)}
							style={{
								height: 30,
								padding: "0 8px",
								borderRadius: 6,
								background: RDS_COLORS.bgInput,
								border: `1px solid ${RDS_COLORS.border}`,
								color: RDS_COLORS.fg,
								fontSize: 12.5,
							}}
						>
							<option value="streets">{t("settings.map.streets", language)}</option>
							<option value="outdoors">{t("settings.map.outdoors", language)}</option>
							<option value="satellite">{t("settings.map.satellite", language)}</option>
						</select>
					}
				/>
				<Row
					label={t("settings.map.pois", language)}
					sub={t("common.comingSoon", language)}
					control={<Toggle on={showPois} onChange={handleShowPoisChange} disabled />}
				/>
				<Row
					label={t("settings.map.terrain3d", language)}
					sub={t("common.comingSoon", language)}
					control={<Toggle on={terrain3d} onChange={setTerrain3d} disabled />}
				/>
				<Row
					label={t("settings.map.autoSnap", language)}
					control={<Toggle on={autoSnap} onChange={setAutoSnap} />}
					last
				/>
			</Group>

			<Group title={t("settings.privacy", language)}>
				<Row
					label={t("settings.privacy.locationAccess", language)}
					sub={t("common.comingSoon", language)}
					control={
						<Btn variant="ghost" disabled title={t("common.comingSoon", language)}>
							{t("settings.privacy.enable", language)}
						</Btn>
					}
				/>
				<Row
					label={t("settings.privacy.publicProfile", language)}
					sub={t("settings.privacy.publicProfileSub", language)}
					control={<Toggle on={publicProfile} onChange={setPublicProfile} disabled />}
				/>
				<Row
					label={t("settings.privacy.hidePrivacy", language)}
					sub={t("settings.privacy.hidePrivacySub", language)}
					control={<Toggle on={hidePrivacy} onChange={setHidePrivacy} />}
					last
				/>
			</Group>

			<Group title={t("settings.account", language)}>
				<Row
					label={t("settings.account.exportAll", language)}
					control={
						<Btn variant="ghost" onClick={handleExportData}>
							<I.download size={14} />
						</Btn>
					}
				/>
				<Row
					label={profile ? t("common.signOut", language) : t("common.signIn", language)}
					control={
						<Btn
							variant={profile ? "ghost" : "primary"}
							onClick={handleSignOut}
							disabled={logout.isPending}
							style={profile ? { color: RDS_COLORS.danger } : undefined}
						>
							{logout.isPending
								? t("common.signingOut", language)
								: profile
									? t("common.signOut", language)
									: t("common.signIn", language)}
						</Btn>
					}
					last
				/>
			</Group>

			<Group title={t("settings.about", language)}>
				<Row
					label={t("settings.version", language)}
					control={
						<span style={{ fontSize: 12.5, color: RDS_COLORS.fgMuted, fontVariantNumeric: "tabular-nums" }}>
							{getVersionDisplay()}
						</span>
					}
					last
				/>
			</Group>
		</div>
	);
}
