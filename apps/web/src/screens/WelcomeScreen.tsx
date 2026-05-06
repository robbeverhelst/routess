import { type ReactNode, useEffect, useMemo, useState } from "react";
import { loadLastMapViewFromLocalStorage } from "@/features/routing/services/LocalStorageService";
import { type SupportedLanguage, t } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { type LocationPermission, useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { useToastStore } from "@/stores/toastStore";
import { type RedesignActivity, useUiStore } from "@/stores/uiStore";
import { AUTH_CARD_STYLE, AuthBackdrop, AuthCardAccentBar } from "../components/auth-shared";
import { I } from "../components/icons";
import { Btn, RDS_COLORS } from "../components/primitives";
import { useViewport } from "../hooks/useViewport";

const PREVIEW_FALLBACK = { lng: 4.4025, lat: 51.2194, zoom: 11 };

const STYLE_PREVIEWS = [
	{
		key: "streets" as const,
		styleId: "streets-v12",
		fallbackBg: "linear-gradient(135deg, oklch(0.93 0.02 240), oklch(0.95 0.03 220))",
		labelKey: "welcome.styles.streets.title",
		subKey: "welcome.styles.streets.body",
	},
	{
		key: "outdoors" as const,
		styleId: "outdoors-v12",
		fallbackBg: "linear-gradient(135deg, oklch(0.92 0.05 145), oklch(0.88 0.07 95))",
		labelKey: "welcome.styles.outdoors.title",
		subKey: "welcome.styles.outdoors.body",
	},
	{
		key: "satellite" as const,
		styleId: "satellite-streets-v12",
		fallbackBg: "linear-gradient(135deg, oklch(0.4 0.04 240), oklch(0.3 0.05 145))",
		labelKey: "welcome.styles.satellite.title",
		subKey: "welcome.styles.satellite.body",
	},
];

function buildStylePreviewUrl(styleId: string, lng: number, lat: number, zoom: number, token: string) {
	const safeZoom = Math.min(Math.max(Math.round(zoom * 10) / 10, 4), 16);
	return `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/${lng.toFixed(4)},${lat.toFixed(4)},${safeZoom}/300x280@2x?access_token=${token}&logo=false&attribution=false`;
}

interface StepDef {
	titleKey: string;
	subKey: string;
	whyKey: string;
}

const STEPS: StepDef[] = [
	{
		titleKey: "welcome.steps.sports.title",
		subKey: "welcome.steps.sports.subtitle",
		whyKey: "welcome.steps.sports.help",
	},
	{
		titleKey: "welcome.steps.units.title",
		subKey: "welcome.steps.units.subtitle",
		whyKey: "welcome.steps.units.help",
	},
	{
		titleKey: "welcome.steps.style.title",
		subKey: "welcome.steps.style.subtitle",
		whyKey: "welcome.steps.style.help",
	},
	{
		titleKey: "welcome.steps.location.title",
		subKey: "welcome.steps.location.subtitle",
		whyKey: "welcome.steps.location.help",
	},
];

const SPORTS: {
	key: RedesignActivity;
	icon: React.ComponentType<{ size?: number }>;
	labelKey: string;
	subKey: string;
}[] = [
	{ key: "run", icon: I.run, labelKey: "sport.run", subKey: "sport.tag.run" },
	{ key: "cycle", icon: I.bike, labelKey: "sport.cycle", subKey: "sport.tag.cycle" },
	{ key: "walk", icon: I.walk, labelKey: "sport.walk", subKey: "sport.tag.walk" },
];

function ChangeLaterHint({ children }: { children: ReactNode }) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				marginTop: 16,
				padding: "10px 12px",
				background: `color-mix(in oklch, ${RDS_COLORS.accent} 6%, ${RDS_COLORS.bgInput})`,
				border: `1px solid color-mix(in oklch, ${RDS_COLORS.accent} 18%, ${RDS_COLORS.border})`,
				borderRadius: 10,
				fontSize: 12,
				color: RDS_COLORS.fgMuted,
				lineHeight: 1.5,
			}}
		>
			<I.refresh size={12} style={{ flexShrink: 0, color: RDS_COLORS.accent }} />
			<span>{children}</span>
		</div>
	);
}

export function WelcomeScreen({ onComplete }: { onComplete?: () => void }) {
	const [step, setStep] = useState(0);
	const [requestingLocation, setRequestingLocation] = useState(false);
	const pushToast = useToastStore((s) => s.push);
	const language = useUiStore((s) => s.language);

	const setActivityType = useUiStore((s) => s.setActivityType);
	const activityType = useUiStore((s) => s.activityType);

	const selectedSports = useRedesignSettingsStore((s) => s.selectedSports);
	const toggleSport = useRedesignSettingsStore((s) => s.toggleSport);
	const setDefaultActivity = useRedesignSettingsStore((s) => s.setDefaultActivity);
	const units = useRedesignSettingsStore((s) => s.units);
	const setUnits = useRedesignSettingsStore((s) => s.setUnits);
	const mapStyle = useRedesignSettingsStore((s) => s.mapStyle);
	const setMapStyle = useRedesignSettingsStore((s) => s.setMapStyle);
	const locationPermission = useRedesignSettingsStore((s) => s.locationPermission);
	const setLocationPermission = useRedesignSettingsStore((s) => s.setLocationPermission);

	const stylePreviewUrls = useMemo(() => {
		const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined;
		if (!token) return null;
		const view = loadLastMapViewFromLocalStorage();
		const lng = view?.longitude ?? PREVIEW_FALLBACK.lng;
		const lat = view?.latitude ?? PREVIEW_FALLBACK.lat;
		const zoom = view?.zoom ?? PREVIEW_FALLBACK.zoom;
		return Object.fromEntries(
			STYLE_PREVIEWS.map((s) => [s.key, buildStylePreviewUrl(s.styleId, lng, lat, zoom, token)]),
		) as Record<(typeof STYLE_PREVIEWS)[number]["key"], string>;
	}, []);

	const defaultSport: RedesignActivity | null = useMemo(() => {
		if (selectedSports.length === 0) return null;
		if (selectedSports.includes(activityType)) return activityType;
		return selectedSports[0];
	}, [selectedSports, activityType]);

	useEffect(() => {
		if (defaultSport && defaultSport !== activityType) {
			setActivityType(defaultSport);
			const labelKey = SPORTS.find((s) => s.key === defaultSport)?.labelKey;
			if (labelKey) setDefaultActivity(t(labelKey, "en"));
		}
	}, [defaultSport, activityType, setActivityType, setDefaultActivity]);

	const handleSportClick = (sport: RedesignActivity) => {
		toggleSport(sport);
	};

	const handleSetDefault = (sport: RedesignActivity) => {
		if (!selectedSports.includes(sport)) {
			toggleSport(sport);
		}
		setActivityType(sport);
		const labelKey = SPORTS.find((s) => s.key === sport)?.labelKey;
		if (labelKey) setDefaultActivity(t(labelKey, "en"));
	};

	const requestLocation = async () => {
		if (typeof navigator === "undefined" || !navigator.geolocation) {
			pushToast({
				kind: "warn",
				title: t("welcome.toast.unavailable", language),
				body: t("welcome.toast.unavailableSub", language),
			});
			setLocationPermission("denied");
			return;
		}
		setRequestingLocation(true);
		try {
			await new Promise<void>((resolve, reject) => {
				navigator.geolocation.getCurrentPosition(
					() => resolve(),
					(err) => reject(err),
					{ timeout: 10000 },
				);
			});
			setLocationPermission("granted");
			pushToast({ kind: "success", title: t("welcome.location.enabled", language) });
		} catch (err) {
			Logger.warn("Location permission denied", err);
			setLocationPermission("denied");
			pushToast({
				kind: "warn",
				title: t("welcome.toast.declined", language),
				body: t("welcome.toast.declinedSub", language),
			});
		} finally {
			setRequestingLocation(false);
		}
	};

	const skipLocation = () => {
		setLocationPermission("skipped");
	};

	const canContinue = step === 0 ? selectedSports.length > 0 : true;

	const finish = () => {
		const primary = defaultSport ?? selectedSports[0];
		if (primary) {
			setActivityType(primary);
			const labelKey = SPORTS.find((s) => s.key === primary)?.labelKey;
			if (labelKey) setDefaultActivity(t(labelKey, "en"));
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

	const stepDef = STEPS[step];
	const totalSteps = STEPS.length;
	const { width } = useViewport();
	const layout: "side" | "stacked" | "card-only" = width >= 1024 ? "side" : width >= 560 ? "stacked" : "card-only";

	return (
		<AuthBackdrop>
			<div
				style={{
					display: "flex",
					flexDirection: layout === "side" ? "row" : "column",
					alignItems: "center",
					justifyContent: "center",
					gap: layout === "side" ? 32 : 16,
					width: "100%",
					maxWidth: layout === "side" ? 1020 : 580,
				}}
			>
				{layout === "side" && <WelcomeHero step={step} totalSteps={totalSteps} steps={STEPS} language={language} />}
				{layout === "stacked" && (
					<WelcomeHeroStacked step={step} totalSteps={totalSteps} stepDef={stepDef} language={language} />
				)}
				<div
					style={{
						...AUTH_CARD_STYLE,
						width: layout === "side" ? 540 : "100%",
						maxWidth: "100%",
						flexShrink: 0,
						padding: "32px 32px 26px",
					}}
				>
					<AuthCardAccentBar />

					<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
						<img
							src="/logo.png"
							alt="routess"
							width={28}
							height={28}
							style={{ borderRadius: 7, display: "block", flexShrink: 0 }}
						/>
						<span
							style={{
								fontSize: 15,
								fontWeight: 600,
								color: RDS_COLORS.fg,
								letterSpacing: -0.2,
							}}
						>
							routess
						</span>
						<div style={{ flex: 1 }} />
						<span
							style={{
								fontSize: 11,
								color: RDS_COLORS.fgSubtle,
								textTransform: "uppercase",
								letterSpacing: 0.6,
								fontWeight: 600,
							}}
						>
							{t("welcome.stepIndicator", language, { n: String(step + 1), total: String(totalSteps) })}
						</span>
					</div>

					<div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
						{STEPS.map((s, i) => (
							<div
								key={s.titleKey}
								data-step={i}
								style={{
									flex: 1,
									height: 3,
									borderRadius: 999,
									background:
										i < step
											? RDS_COLORS.accent
											: i === step
												? `linear-gradient(90deg, ${RDS_COLORS.accent}, color-mix(in oklch, ${RDS_COLORS.accent} 60%, ${RDS_COLORS.success}))`
												: RDS_COLORS.border,
								}}
							/>
						))}
					</div>

					<h2 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px", letterSpacing: -0.4, lineHeight: 1.2 }}>
						{t(stepDef.titleKey, language)}
					</h2>
					<p style={{ fontSize: 14, color: RDS_COLORS.fgMuted, margin: 0, lineHeight: 1.5 }}>
						{t(stepDef.subKey, language)}
					</p>

					<div
						style={{
							display: "flex",
							alignItems: "flex-start",
							gap: 8,
							marginTop: 12,
							fontSize: 12,
							color: RDS_COLORS.fgSubtle,
							lineHeight: 1.55,
						}}
					>
						<I.zap size={12} style={{ marginTop: 3, flexShrink: 0, color: RDS_COLORS.accent }} />
						<span>{t(stepDef.whyKey, language)}</span>
					</div>

					<div style={{ marginTop: 22 }}>
						{step === 0 && (
							<>
								<div style={{ display: "flex", gap: 10 }}>
									{SPORTS.map((a) => {
										const Icon = a.icon;
										const on = selectedSports.includes(a.key);
										const isDefault = on && defaultSport === a.key;
										return (
											<div key={a.key} style={{ flex: 1, position: "relative" }}>
												<button
													type="button"
													aria-pressed={on}
													onClick={() => handleSportClick(a.key)}
													style={{
														width: "100%",
														position: "relative",
														padding: on ? "16px 14px 42px" : "16px 14px 14px",
														borderRadius: 12,
														background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
														border: on ? `2px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
														color: on ? RDS_COLORS.accent : RDS_COLORS.fg,
														display: "flex",
														flexDirection: "column",
														gap: 8,
														alignItems: "flex-start",
														cursor: "pointer",
														transition: "background 120ms, border-color 120ms, color 120ms, padding 120ms",
														textAlign: "left",
														fontFamily: "inherit",
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
													<div style={{ fontSize: 14, fontWeight: 600 }}>{t(a.labelKey, language)}</div>
													<div
														style={{
															fontSize: 11.5,
															color: on ? RDS_COLORS.accent : RDS_COLORS.fgSubtle,
														}}
													>
														{t(a.subKey, language)}
													</div>
												</button>

												{on && (
													<button
														type="button"
														onClick={() => handleSetDefault(a.key)}
														aria-pressed={isDefault}
														style={{
															position: "absolute",
															left: 14,
															bottom: 12,
															display: "inline-flex",
															alignItems: "center",
															gap: 4,
															padding: "3px 8px",
															borderRadius: 999,
															background: isDefault ? RDS_COLORS.accent : RDS_COLORS.bgPanel,
															color: isDefault ? RDS_COLORS.accentFg : RDS_COLORS.accent,
															border: isDefault ? "none" : `1px solid ${RDS_COLORS.accent}`,
															fontSize: 10.5,
															fontWeight: 600,
															letterSpacing: 0.2,
															cursor: isDefault ? "default" : "pointer",
															textTransform: "uppercase",
															fontFamily: "inherit",
														}}
													>
														<I.check size={10} />
														{isDefault ? t("welcome.default", language) : t("welcome.setDefault", language)}
													</button>
												)}
											</div>
										);
									})}
								</div>
								<ChangeLaterHint>{t("welcome.changeLater", language)}</ChangeLaterHint>
							</>
						)}

						{step === 1 && (
							<>
								<div style={{ display: "flex", gap: 10 }}>
									{[
										{
											key: "km" as const,
											label: t("welcome.units.metric", language),
											sub: t("welcome.units.metricSub", language),
										},
										{
											key: "mi" as const,
											label: t("welcome.units.imperial", language),
											sub: t("welcome.units.imperialSub", language),
										},
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
													padding: 20,
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
													textAlign: "left",
												}}
											>
												<div style={{ fontSize: 15, fontWeight: 600 }}>{u.label}</div>
												<div style={{ fontSize: 12, color: on ? RDS_COLORS.accent : RDS_COLORS.fgSubtle }}>{u.sub}</div>
											</button>
										);
									})}
								</div>
								<ChangeLaterHint>{t("welcome.units.changeLater", language)}</ChangeLaterHint>
							</>
						)}

						{step === 2 && (
							<>
								<div style={{ display: "flex", gap: 10 }}>
									{STYLE_PREVIEWS.map((m) => {
										const on = mapStyle === m.key;
										const previewUrl = stylePreviewUrls?.[m.key];
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
													background: m.fallbackBg,
													backgroundImage: previewUrl ? `url("${previewUrl}")` : undefined,
													backgroundSize: "cover",
													backgroundPosition: "center",
													height: 150,
													position: "relative",
													display: "flex",
													alignItems: "flex-end",
													cursor: "pointer",
												}}
											>
												<div
													style={{
														width: "100%",
														padding: "10px 12px",
														background: `color-mix(in oklch, ${RDS_COLORS.bgPanel} 92%, transparent)`,
														textAlign: "left",
													}}
												>
													<div
														style={{
															fontSize: 13,
															fontWeight: 600,
															color: RDS_COLORS.fg,
															marginBottom: 2,
														}}
													>
														{t(m.labelKey, language)}
													</div>
													<div style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, lineHeight: 1.35 }}>
														{t(m.subKey, language)}
													</div>
												</div>
											</button>
										);
									})}
								</div>
								<ChangeLaterHint>{t("welcome.styles.flipLater", language)}</ChangeLaterHint>
							</>
						)}

						{step === 3 && (
							<>
								<LocationStep
									permission={locationPermission}
									requesting={requestingLocation}
									onAllow={requestLocation}
									onSkip={skipLocation}
									language={language}
								/>
								<ChangeLaterHint>{t("welcome.location.changeLater", language)}</ChangeLaterHint>
							</>
						)}
					</div>

					<div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24 }}>
						<Btn variant="ghost" onClick={finish} style={{ color: RDS_COLORS.fgMuted }}>
							{t("welcome.skip", language)}
						</Btn>
						<div style={{ flex: 1 }} />
						{step > 0 && <Btn onClick={() => setStep(step - 1)}>{t("common.back", language)}</Btn>}
						<Btn variant="primary" onClick={next} disabled={!canContinue}>
							{step === STEPS.length - 1 ? (
								<>
									{t("welcome.getStarted", language)} <I.chevronR size={12} />
								</>
							) : (
								<>
									{t("welcome.continue", language)} <I.chevronR size={12} />
								</>
							)}
						</Btn>
					</div>
				</div>
			</div>
		</AuthBackdrop>
	);
}

function WelcomeHero({
	step,
	totalSteps,
	steps,
	language,
}: {
	step: number;
	totalSteps: number;
	steps: StepDef[];
	language: SupportedLanguage;
}) {
	return (
		<div
			style={{
				position: "relative",
				width: 400,
				height: 540,
				borderRadius: 22,
				overflow: "hidden",
				background: `linear-gradient(155deg,
					color-mix(in oklch, ${RDS_COLORS.accent} 88%, black),
					color-mix(in oklch, ${RDS_COLORS.accent} 78%, black) 55%,
					color-mix(in oklch, ${RDS_COLORS.accent} 65%, ${RDS_COLORS.success}))`,
				boxShadow: `
					0 1px 0 oklch(1 0 0 / 0.06) inset,
					0 20px 50px -12px color-mix(in oklch, ${RDS_COLORS.accent} 35%, transparent),
					0 40px 100px -24px oklch(0 0 0 / 0.28)
				`,
				border: "1px solid oklch(1 0 0 / 0.12)",
				color: "white",
				flexShrink: 0,
				padding: 32,
				display: "flex",
				flexDirection: "column",
				gap: 20,
			}}
		>
			<div
				aria-hidden
				style={{
					position: "absolute",
					top: -80,
					right: -80,
					width: 280,
					height: 280,
					borderRadius: "50%",
					background: `radial-gradient(circle, color-mix(in oklch, ${RDS_COLORS.warn} 35%, transparent), transparent 70%)`,
					filter: "blur(60px)",
					pointerEvents: "none",
				}}
			/>
			<div
				aria-hidden
				style={{
					position: "absolute",
					bottom: -100,
					left: -60,
					width: 320,
					height: 320,
					borderRadius: "50%",
					background: `radial-gradient(circle, color-mix(in oklch, ${RDS_COLORS.success} 35%, transparent), transparent 65%)`,
					filter: "blur(70px)",
					pointerEvents: "none",
				}}
			/>

			<div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
				<I.compass size={16} style={{ opacity: 0.85 }} />
				<span
					style={{
						fontSize: 12,
						fontWeight: 500,
						letterSpacing: 0.4,
						textTransform: "uppercase",
						opacity: 0.85,
					}}
				>
					routess
				</span>
			</div>

			<div style={{ position: "relative" }}>
				<div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.4, lineHeight: 1.15, marginBottom: 8 }}>
					{t("welcome.youreIn", language)}
					<br />
					{t("welcome.letsSetUp", language)}
				</div>
				<div style={{ fontSize: 13.5, opacity: 0.85, lineHeight: 1.5 }}>{t("welcome.minute", language)}</div>
			</div>

			<div
				aria-hidden
				style={{
					position: "relative",
					height: 1,
					background: "oklch(1 0 0 / 0.18)",
				}}
			/>

			<ol
				style={{
					position: "relative",
					margin: 0,
					padding: 0,
					listStyle: "none",
					display: "flex",
					flexDirection: "column",
					gap: 12,
				}}
			>
				{steps.map((s, i) => {
					const done = i < step;
					const active = i === step;
					return (
						<li
							key={s.titleKey}
							style={{
								display: "flex",
								alignItems: "flex-start",
								gap: 12,
								opacity: done ? 0.7 : active ? 1 : 0.55,
								transition: "opacity 200ms",
							}}
						>
							<span
								style={{
									width: 22,
									height: 22,
									borderRadius: 999,
									background: done ? "white" : active ? "oklch(1 0 0 / 0.22)" : "oklch(1 0 0 / 0.08)",
									border: active ? "1px solid oklch(1 0 0 / 0.5)" : "1px solid oklch(1 0 0 / 0.18)",
									color: done ? RDS_COLORS.accent : "white",
									display: "inline-flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 11,
									fontWeight: 600,
									flexShrink: 0,
									marginTop: 1,
								}}
							>
								{done ? <I.check size={12} /> : i + 1}
							</span>
							<span
								style={{
									fontSize: 13,
									fontWeight: active ? 600 : 500,
									lineHeight: 1.4,
									textDecoration: done ? "line-through" : "none",
								}}
							>
								{t(s.titleKey, language)}
							</span>
						</li>
					);
				})}
			</ol>

			<div style={{ flex: 1 }} />

			<div
				style={{
					position: "relative",
					fontSize: 11,
					opacity: 0.7,
					letterSpacing: 0.3,
				}}
			>
				{t("welcome.stepFraction", language, { n: String(step + 1), total: String(totalSteps) })}
			</div>
		</div>
	);
}

function WelcomeHeroStacked({
	step,
	totalSteps,
	stepDef,
	language,
}: {
	step: number;
	totalSteps: number;
	stepDef: StepDef;
	language: SupportedLanguage;
}) {
	const progress = (step / Math.max(totalSteps - 1, 1)) * 100;
	return (
		<div
			style={{
				position: "relative",
				width: "100%",
				borderRadius: 18,
				overflow: "hidden",
				background: `linear-gradient(120deg,
					color-mix(in oklch, ${RDS_COLORS.accent} 88%, black),
					color-mix(in oklch, ${RDS_COLORS.accent} 75%, black) 60%,
					color-mix(in oklch, ${RDS_COLORS.accent} 60%, ${RDS_COLORS.success}))`,
				boxShadow: `
					0 1px 0 oklch(1 0 0 / 0.06) inset,
					0 16px 40px -14px color-mix(in oklch, ${RDS_COLORS.accent} 35%, transparent)
				`,
				border: "1px solid oklch(1 0 0 / 0.12)",
				color: "white",
				padding: "20px 22px 18px",
			}}
		>
			<div
				aria-hidden
				style={{
					position: "absolute",
					top: -60,
					right: -40,
					width: 200,
					height: 200,
					borderRadius: "50%",
					background: `radial-gradient(circle, color-mix(in oklch, ${RDS_COLORS.warn} 35%, transparent), transparent 70%)`,
					filter: "blur(50px)",
					pointerEvents: "none",
				}}
			/>
			<div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
				<I.compass size={14} style={{ opacity: 0.9 }} />
				<span style={{ fontSize: 11.5, fontWeight: 500, letterSpacing: 0.4, textTransform: "uppercase", opacity: 0.9 }}>
					routess
				</span>
				<div style={{ flex: 1 }} />
				<span style={{ fontSize: 11, opacity: 0.8, letterSpacing: 0.3 }}>
					{t("welcome.stepFractionShort", language, { n: String(step + 1), total: String(totalSteps) })}
				</span>
			</div>

			<div
				style={{
					position: "relative",
					fontSize: 19,
					fontWeight: 600,
					letterSpacing: -0.3,
					lineHeight: 1.2,
					marginBottom: 4,
				}}
			>
				{t(stepDef.titleKey, language)}
			</div>
			<div style={{ position: "relative", fontSize: 12.5, opacity: 0.85, lineHeight: 1.45 }}>
				{t("welcome.minute", language)}
			</div>

			<div
				style={{
					position: "relative",
					marginTop: 14,
					height: 4,
					borderRadius: 999,
					background: "oklch(1 0 0 / 0.18)",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						width: `${progress}%`,
						height: "100%",
						background: "white",
						borderRadius: 999,
						transition: "width 240ms ease-out",
					}}
				/>
			</div>
		</div>
	);
}

function LocationStep({
	permission,
	requesting,
	onAllow,
	onSkip,
	language,
}: {
	permission: LocationPermission;
	requesting: boolean;
	onAllow: () => void;
	onSkip: () => void;
	language: SupportedLanguage;
}) {
	const granted = permission === "granted";
	const denied = permission === "denied";
	const skipped = permission === "skipped";
	const decided = granted || denied || skipped;

	const statusLabel = granted
		? t("welcome.location.enabled", language)
		: denied
			? t("welcome.location.denied", language)
			: skipped
				? t("welcome.location.skipped", language)
				: t("welcome.location.notDecided", language);

	const statusColor = granted ? RDS_COLORS.success : denied ? RDS_COLORS.danger : RDS_COLORS.fgSubtle;

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 12,
				padding: 18,
				background: RDS_COLORS.bgInput,
				border: `1px solid ${RDS_COLORS.border}`,
				borderRadius: 12,
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
				<div
					style={{
						width: 38,
						height: 38,
						borderRadius: 10,
						background: RDS_COLORS.accentSoft,
						color: RDS_COLORS.accent,
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						flexShrink: 0,
					}}
				>
					<I.locate size={18} />
				</div>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div style={{ fontSize: 13.5, fontWeight: 600, color: RDS_COLORS.fg }}>
						{t("welcome.location.useMyLocation", language)}
					</div>
					<div style={{ fontSize: 11.5, color: statusColor, marginTop: 2 }}>{statusLabel}</div>
				</div>
			</div>

			<ul
				style={{
					margin: 0,
					padding: 0,
					listStyle: "none",
					display: "flex",
					flexDirection: "column",
					gap: 6,
					fontSize: 12.5,
					color: RDS_COLORS.fgMuted,
					lineHeight: 1.5,
				}}
			>
				<li style={{ display: "flex", gap: 8 }}>
					<I.check size={12} style={{ marginTop: 4, color: RDS_COLORS.success, flexShrink: 0 }} />
					<span>{t("welcome.location.benefit1", language)}</span>
				</li>
				<li style={{ display: "flex", gap: 8 }}>
					<I.check size={12} style={{ marginTop: 4, color: RDS_COLORS.success, flexShrink: 0 }} />
					<span>{t("welcome.location.benefit2", language)}</span>
				</li>
				<li style={{ display: "flex", gap: 8 }}>
					<I.lock size={12} style={{ marginTop: 4, color: RDS_COLORS.fgSubtle, flexShrink: 0 }} />
					<span>{t("welcome.location.benefit3", language)}</span>
				</li>
			</ul>

			<div style={{ display: "flex", gap: 8, marginTop: 4 }}>
				<Btn variant="primary" onClick={onAllow} disabled={requesting || granted} style={{ flex: 1, height: 40 }}>
					{requesting
						? t("welcome.location.requesting", language)
						: granted
							? t("welcome.location.granted", language)
							: decided
								? t("welcome.location.tryAgain", language)
								: t("welcome.location.allow", language)}
				</Btn>
				<Btn onClick={onSkip} disabled={requesting} style={{ flex: 1, height: 40 }}>
					{t("welcome.location.maybeLater", language)}
				</Btn>
			</div>
		</div>
	);
}
