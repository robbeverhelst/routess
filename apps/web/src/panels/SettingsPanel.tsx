import type { RouteVisibility } from "@routess/core";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { apiService } from "@/lib/api";
import { useLogout, useUserProfile } from "@/lib/api-queries";
import { emitAppEvent } from "@/lib/app-events";
import { type SupportedLanguage, t, tIn } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { getVersionDisplay } from "@/lib/version";
import {
	DEFAULT_SPORT_SPEEDS_KMH,
	getSpeedForActivity,
	type RedesignMapStyle,
	SPORT_SPEED_MAX_KMH,
	SPORT_SPEED_MIN_KMH,
	useRedesignSettingsStore,
} from "@/stores/redesignSettingsStore";
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

async function resizeImageToDataUrl(file: File, maxDimension: number): Promise<string> {
	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error ?? new Error("read failed"));
		reader.readAsDataURL(file);
	});
	const img = await new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error("image decode failed"));
		image.src = dataUrl;
	});
	const ratio = Math.min(maxDimension / img.width, maxDimension / img.height, 1);
	const w = Math.round(img.width * ratio);
	const h = Math.round(img.height * ratio);
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("canvas 2d not available");
	ctx.drawImage(img, 0, 0, w, h);
	return canvas.toDataURL("image/jpeg", 0.85);
}

const VISIBILITY_OPTIONS: { key: RouteVisibility; labelKey: string; subKey: string }[] = [
	{ key: "private", labelKey: "save.visibility.private", subKey: "save.visibility.privateSub" },
	{ key: "unlisted", labelKey: "save.visibility.unlisted", subKey: "save.visibility.unlistedSub" },
	{ key: "public", labelKey: "save.visibility.public", subKey: "save.visibility.publicSub" },
];

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
	last,
}: {
	label: string;
	sub: string;
	kmh: number;
	units: "km" | "mi";
	onChange: (kmh: number) => void;
	onReset: () => void;
	isDefault: boolean;
	last?: boolean;
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
		<Row
			label={label}
			sub={sub}
			last={last}
			control={
				<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
					<input
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
						style={{
							width: 68,
							height: 30,
							padding: "0 8px",
							borderRadius: 6,
							background: RDS_COLORS.bgInput,
							border: `1px solid ${RDS_COLORS.border}`,
							color: RDS_COLORS.fg,
							fontSize: 12.5,
							textAlign: "right",
							fontVariantNumeric: "tabular-nums",
						}}
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
	const autoSnap = useRoutingPreferencesStore((s) => s.snap);
	const setAutoSnap = useRoutingPreferencesStore((s) => s.setSnap);

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

	const userName = profile?.name ?? t("settings.profile.yourAccount");
	const userEmail = profile?.email ?? t("settings.profile.signInToSync");

	const handleEditProfile = () => {
		emitAppEvent("routess:open-account");
	};

	const handleExportData = () => {
		const url = apiService.exportDataUrl();
		const a = document.createElement("a");
		a.href = url;
		a.download = "";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	};

	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const handleAvatarUploadClick = () => fileInputRef.current?.click();

	const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			pushToast({ kind: "warn", title: t("settings.profile.avatar.invalidType") });
			return;
		}
		try {
			const dataUrl = await resizeImageToDataUrl(file, 256);
			await apiService.updateCurrentUser({ avatar: dataUrl });
			pushToast({ kind: "success", title: t("settings.profile.avatar.updated") });
		} catch (error) {
			Logger.error("Avatar upload failed:", error);
			pushToast({ kind: "danger", title: t("settings.profile.avatar.failed") });
		}
	};

	const handleClearAvatar = async () => {
		try {
			await apiService.updateCurrentUser({ avatar: "" });
			pushToast({ kind: "success", title: t("settings.profile.avatar.cleared") });
		} catch (error) {
			Logger.error("Avatar clear failed:", error);
			pushToast({ kind: "danger", title: t("settings.profile.avatar.failed") });
		}
	};

	const handleChangePassword = async () => {
		const currentPassword = profile ? (window.prompt(t("settings.security.currentPasswordPrompt")) ?? "") : "";
		const newPassword = window.prompt(t("settings.security.newPasswordPrompt"));
		if (!newPassword) return;
		try {
			await apiService.setPassword({
				newPassword,
				currentPassword: currentPassword || undefined,
			});
			pushToast({ kind: "success", title: t("settings.security.passwordUpdated") });
		} catch (error) {
			Logger.error("Set password failed:", error);
			const message = error instanceof Error ? error.message : t("settings.security.passwordFailed");
			pushToast({ kind: "danger", title: t("settings.security.passwordFailed"), body: message });
		}
	};

	const handleLogoutEverywhere = async () => {
		if (!window.confirm(t("settings.security.logoutEverywhereConfirm"))) return;
		try {
			await apiService.logoutEverywhere();
			pushToast({ kind: "success", title: t("common.signedOut") });
			emitAppEvent("routess:open-login");
		} catch (error) {
			Logger.error("Logout everywhere failed:", error);
			pushToast({ kind: "danger", title: t("settings.security.logoutEverywhereFailed") });
		}
	};

	const handleDeleteAccount = async () => {
		if (!window.confirm(t("settings.account.deleteConfirm"))) return;
		try {
			await apiService.deleteAccount();
			pushToast({ kind: "success", title: t("settings.account.deleteScheduled") });
			emitAppEvent("routess:open-login");
		} catch (error) {
			Logger.error("Delete account failed:", error);
			pushToast({ kind: "danger", title: t("settings.account.deleteFailed") });
		}
	};

	const handleCancelDeletion = async () => {
		try {
			await apiService.cancelDeletion();
			pushToast({ kind: "success", title: t("settings.account.deletionCancelled") });
		} catch (error) {
			Logger.error("Cancel deletion failed:", error);
			pushToast({ kind: "danger", title: t("settings.account.deletionCancelFailed") });
		}
	};

	const isPendingDeletion = profile?.deletionStatus === "pending_hard_delete";

	const handleMapStyleChange = (nextStyle: RedesignMapStyle) => {
		setMapStyle(nextStyle);
	};

	const handleShowPoisChange = (next: boolean) => {
		setShowPois(next);
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

	return (
		<div style={{ padding: "20px 20px", overflow: "auto", height: "100%" }}>
			<Group title={t("settings.profile")}>
				<Row
					label={userName}
					sub={userEmail}
					control={
						<Btn variant="ghost" onClick={handleEditProfile}>
							{t("settings.profile.edit")}
						</Btn>
					}
				/>
				<div
					style={{
						padding: "14px 14px 16px",
						borderBottom: `1px solid ${RDS_COLORS.border}`,
					}}
				>
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
				</div>
				<Row
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
					last
				/>
			</Group>

			{selectedSports.length > 0 && (
				<Group title={t("settings.pace.title")}>
					{selectedSports.map((sport, idx) => {
						const cfg = SPORT_OPTIONS.find((s) => s.key === sport);
						if (!cfg) return null;
						const kmh = getSpeedForActivity(sport, sportSpeeds);
						const isLast = idx === selectedSports.length - 1;
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
								last={isLast}
							/>
						);
					})}
				</Group>
			)}

			<Group title={t("settings.appearance")}>
				<Row
					label={t("settings.language")}
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
				<Row
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

			<Group title={t("settings.map.label")}>
				<Row
					label={t("settings.map.styleLabel")}
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
							<option value="streets">{t("settings.map.streets")}</option>
							<option value="outdoors">{t("settings.map.outdoors")}</option>
							<option value="satellite">{t("settings.map.satellite")}</option>
						</select>
					}
				/>
				<Row
					label={t("settings.map.pois")}
					sub={t("common.comingSoon")}
					control={<Toggle on={showPois} onChange={handleShowPoisChange} disabled />}
				/>
				<Row
					label={t("settings.map.terrain3d")}
					sub={t("common.comingSoon")}
					control={<Toggle on={terrain3d} onChange={setTerrain3d} disabled />}
				/>
				<Row label={t("settings.map.autoSnap")} control={<Toggle on={autoSnap} onChange={setAutoSnap} />} last />
			</Group>

			<Group title={t("settings.privacy")}>
				<Row
					label={t("settings.privacy.locationAccess")}
					sub={t("common.comingSoon")}
					control={
						<Btn variant="ghost" disabled title={t("common.comingSoon")}>
							{t("settings.privacy.enable")}
						</Btn>
					}
					last
				/>
			</Group>

			<Group title={t("settings.routingDefaults")}>
				<Row
					label={t("settings.routingDefaults.visibility")}
					sub={t("settings.routingDefaults.visibilitySub")}
					control={
						<select
							value={defaultRouteVisibility}
							onChange={(e) => setDefaultRouteVisibility(e.target.value as RouteVisibility)}
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
							{VISIBILITY_OPTIONS.map((opt) => (
								<option key={opt.key} value={opt.key}>
									{t(opt.labelKey)}
								</option>
							))}
						</select>
					}
					last
				/>
			</Group>

			{profile && (
				<Group title={t("settings.security")}>
					<Row
						label={t("settings.profile.avatar")}
						sub={t("settings.profile.avatar.sub")}
						control={
							<>
								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									onChange={handleAvatarFileChange}
									style={{ display: "none" }}
								/>
								<Btn variant="ghost" onClick={handleAvatarUploadClick}>
									{t("settings.profile.avatar.upload")}
								</Btn>
								{profile.avatar && (
									<Btn variant="ghost" onClick={handleClearAvatar} style={{ marginLeft: 6 }}>
										{t("settings.profile.avatar.clear")}
									</Btn>
								)}
							</>
						}
					/>
					<Row
						label={t("settings.security.changePassword")}
						sub={t("settings.security.changePasswordSub")}
						control={
							<Btn variant="ghost" onClick={handleChangePassword}>
								{t("settings.security.changePasswordAction")}
							</Btn>
						}
					/>
					<Row
						label={t("settings.security.logoutEverywhere")}
						sub={t("settings.security.logoutEverywhereSub")}
						control={
							<Btn variant="ghost" onClick={handleLogoutEverywhere} style={{ color: RDS_COLORS.danger }}>
								{t("settings.security.logoutEverywhereAction")}
							</Btn>
						}
						last
					/>
				</Group>
			)}

			<Group title={t("settings.account")}>
				{isPendingDeletion && (
					<Row
						label={t("settings.account.pendingDeletion")}
						sub={t("settings.account.pendingDeletionSub")}
						control={
							<Btn variant="primary" onClick={handleCancelDeletion}>
								{t("settings.account.cancelDeletion")}
							</Btn>
						}
					/>
				)}
				<Row
					label={t("settings.account.exportAll")}
					sub={t("settings.account.exportAllSub")}
					control={
						<Btn variant="ghost" onClick={handleExportData}>
							<I.download size={14} />
						</Btn>
					}
				/>
				{profile && !isPendingDeletion && (
					<Row
						label={t("settings.account.deleteAccount")}
						sub={t("settings.account.deleteAccountSub")}
						control={
							<Btn variant="ghost" onClick={handleDeleteAccount} style={{ color: RDS_COLORS.danger }}>
								{t("settings.account.deleteAccountAction")}
							</Btn>
						}
					/>
				)}
				<Row
					label={profile ? t("common.signOut") : t("common.signIn")}
					control={
						<Btn
							variant={profile ? "ghost" : "primary"}
							onClick={handleSignOut}
							disabled={logout.isPending}
							style={profile ? { color: RDS_COLORS.danger } : undefined}
						>
							{logout.isPending ? t("common.signingOut") : profile ? t("common.signOut") : t("common.signIn")}
						</Btn>
					}
					last
				/>
			</Group>

			<Group title={t("settings.about")}>
				<Row
					label={t("settings.version")}
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
