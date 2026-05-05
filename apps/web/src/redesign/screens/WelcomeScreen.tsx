import { type ReactNode, useEffect, useMemo, useState } from "react";
import { loadLastMapViewFromLocalStorage } from "@/features/routing/services/LocalStorageService";
import { Logger } from "@/lib/logger";
import { AUTH_CARD_STYLE, AuthBackdrop, AuthCardAccentBar } from "../components/auth-shared";
import { I } from "../components/icons";
import { Btn, RDS_COLORS } from "../components/primitives";
import {
	DEFAULT_SPORT_SPEEDS_KMH,
	type LocationPermission,
	type RedesignUnits,
	useRedesignSettingsStore,
} from "../stores/settingsStore";
import { useToastStore } from "../stores/toastStore";
import { type RedesignActivity, useUiStore } from "../stores/uiStore";

const PREVIEW_FALLBACK = { lng: 4.4025, lat: 51.2194, zoom: 11 };

const STYLE_PREVIEWS = [
	{
		key: "streets" as const,
		styleId: "streets-v12",
		fallbackBg: "linear-gradient(135deg, oklch(0.93 0.02 240), oklch(0.95 0.03 220))",
		label: "Streets",
		sub: "Clean, light, easy to read in the city.",
	},
	{
		key: "outdoors" as const,
		styleId: "outdoors-v12",
		fallbackBg: "linear-gradient(135deg, oklch(0.92 0.05 145), oklch(0.88 0.07 95))",
		label: "Outdoors",
		sub: "Trails, contour lines, terrain detail.",
	},
	{
		key: "satellite" as const,
		styleId: "satellite-streets-v12",
		fallbackBg: "linear-gradient(135deg, oklch(0.4 0.04 240), oklch(0.3 0.05 145))",
		label: "Satellite",
		sub: "Real imagery with street labels on top.",
	},
];

function buildStylePreviewUrl(styleId: string, lng: number, lat: number, zoom: number, token: string) {
	const safeZoom = Math.min(Math.max(Math.round(zoom * 10) / 10, 4), 16);
	return `https://api.mapbox.com/styles/v1/mapbox/${styleId}/static/${lng.toFixed(4)},${lat.toFixed(4)},${safeZoom}/300x280@2x?access_token=${token}&logo=false&attribution=false`;
}

interface StepDef {
	title: string;
	sub: string;
	why: string;
}

const STEPS: StepDef[] = [
	{
		title: "Pick your default sport(s)",
		sub: "Tap one or more. The first one becomes your default — tap the star on another to swap.",
		why: "We use this to suggest the right routing profile and average speed when you start a new map.",
	},
	{
		title: "Choose your units",
		sub: "How would you like distances and speeds shown across the app?",
		why: "Affects every distance, elevation and pace number you'll see.",
	},
	{
		title: "Set your average speed",
		sub: "We use this to estimate how long a route will take. A rough number is fine.",
		why: "Per-sport so a 5 km walk and a 5 km ride don't share the same ETA.",
	},
	{
		title: "Pick your map style",
		sub: "Three flavours. You can flip between them any time from the layers menu.",
		why: "Different styles surface different details — trails, traffic, real imagery.",
	},
	{
		title: "Allow location access?",
		sub: "Centre the map on you and snap routes to where you actually are.",
		why: "Location stays on your device. Routess never stores or shares it.",
	},
];

const SPORTS: {
	key: RedesignActivity;
	icon: React.ComponentType<{ size?: number }>;
	label: string;
	sub: string;
	defaultLabel: string;
}[] = [
	{ key: "run", icon: I.run, label: "Running", sub: "Pace · splits", defaultLabel: "Running" },
	{ key: "cycle", icon: I.bike, label: "Cycling", sub: "Speed · routes", defaultLabel: "Cycling" },
	{ key: "walk", icon: I.walk, label: "Walking", sub: "Distance · POIs", defaultLabel: "Walking" },
];

const KMH_TO_MPH = 0.621371;

function toDisplay(kmh: number, units: RedesignUnits): number {
	return units === "mi" ? kmh * KMH_TO_MPH : kmh;
}

function fromDisplay(value: number, units: RedesignUnits): number {
	return units === "mi" ? value / KMH_TO_MPH : value;
}

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

	const setActivityType = useUiStore((s) => s.setActivityType);
	const activityType = useUiStore((s) => s.activityType);

	const selectedSports = useRedesignSettingsStore((s) => s.selectedSports);
	const toggleSport = useRedesignSettingsStore((s) => s.toggleSport);
	const sportSpeeds = useRedesignSettingsStore((s) => s.sportSpeeds);
	const setSportSpeed = useRedesignSettingsStore((s) => s.setSportSpeed);
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

	useEffect(() => {
		for (const sport of selectedSports) {
			if (sportSpeeds[sport] === undefined) {
				setSportSpeed(sport, DEFAULT_SPORT_SPEEDS_KMH[sport]);
			}
		}
	}, [selectedSports, sportSpeeds, setSportSpeed]);

	const defaultSport: RedesignActivity | null = useMemo(() => {
		if (selectedSports.length === 0) return null;
		if (selectedSports.includes(activityType)) return activityType;
		return selectedSports[0];
	}, [selectedSports, activityType]);

	useEffect(() => {
		if (defaultSport && defaultSport !== activityType) {
			setActivityType(defaultSport);
			const label = SPORTS.find((s) => s.key === defaultSport)?.defaultLabel;
			if (label) setDefaultActivity(label);
		}
	}, [defaultSport, activityType, setActivityType, setDefaultActivity]);

	const handleSportClick = (sport: RedesignActivity) => {
		toggleSport(sport);
	};

	const handleSetDefault = (sport: RedesignActivity, e: React.MouseEvent) => {
		e.stopPropagation();
		if (!selectedSports.includes(sport)) {
			toggleSport(sport);
		}
		setActivityType(sport);
		const label = SPORTS.find((s) => s.key === sport)?.defaultLabel;
		if (label) setDefaultActivity(label);
	};

	const requestLocation = async () => {
		if (typeof navigator === "undefined" || !navigator.geolocation) {
			pushToast({ kind: "warn", title: "Location unavailable", body: "This browser doesn't support geolocation." });
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
			pushToast({ kind: "success", title: "Location enabled" });
		} catch (err) {
			Logger.warn("Location permission denied", err);
			setLocationPermission("denied");
			pushToast({ kind: "warn", title: "Location declined", body: "You can enable it later in Settings." });
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
			const sportLabel = SPORTS.find((s) => s.key === primary)?.defaultLabel;
			if (sportLabel) setDefaultActivity(sportLabel);
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

	const speedSports = selectedSports.length > 0 ? selectedSports : (["cycle"] as RedesignActivity[]);
	const unitLabel = units === "mi" ? "mph" : "km/h";
	const stepDef = STEPS[step];
	const totalSteps = STEPS.length;

	return (
		<AuthBackdrop>
			<div
				style={{
					...AUTH_CARD_STYLE,
					width: "100%",
					maxWidth: 580,
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
						Step {step + 1} of {totalSteps}
					</span>
				</div>

				<div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
					{STEPS.map((s, i) => (
						<div
							key={s.title}
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
					{stepDef.title}
				</h2>
				<p style={{ fontSize: 14, color: RDS_COLORS.fgMuted, margin: 0, lineHeight: 1.5 }}>{stepDef.sub}</p>

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
					<span>{stepDef.why}</span>
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
										<div
											key={a.key}
											role="button"
											tabIndex={0}
											aria-pressed={on}
											onClick={() => handleSportClick(a.key)}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													handleSportClick(a.key);
												}
											}}
											style={{
												flex: 1,
												position: "relative",
												padding: "16px 14px 14px",
												borderRadius: 12,
												background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
												border: on ? `2px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
												color: on ? RDS_COLORS.accent : RDS_COLORS.fg,
												display: "flex",
												flexDirection: "column",
												gap: 8,
												alignItems: "flex-start",
												cursor: "pointer",
												transition: "background 120ms, border-color 120ms, color 120ms",
												textAlign: "left",
												outline: "none",
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
											<div style={{ fontSize: 14, fontWeight: 600 }}>{a.label}</div>
											<div style={{ fontSize: 11.5, color: on ? RDS_COLORS.accent : RDS_COLORS.fgSubtle }}>
												{a.sub}
											</div>

											{on && (
												<button
													type="button"
													onClick={(e) => handleSetDefault(a.key, e)}
													aria-pressed={isDefault}
													style={{
														marginTop: 4,
														display: "inline-flex",
														alignItems: "center",
														gap: 4,
														padding: "3px 8px",
														borderRadius: 999,
														background: isDefault ? RDS_COLORS.accent : "transparent",
														color: isDefault ? RDS_COLORS.accentFg : RDS_COLORS.accent,
														border: isDefault ? "none" : `1px solid ${RDS_COLORS.accent}`,
														fontSize: 10.5,
														fontWeight: 600,
														letterSpacing: 0.2,
														cursor: isDefault ? "default" : "pointer",
														textTransform: "uppercase",
													}}
												>
													<I.check size={10} />
													{isDefault ? "Default" : "Set default"}
												</button>
											)}
										</div>
									);
								})}
							</div>
							<ChangeLaterHint>
								You can add more sports or change your default any time from Settings.
							</ChangeLaterHint>
						</>
					)}

					{step === 1 && (
						<>
							<div style={{ display: "flex", gap: 10 }}>
								{[
									{ key: "km" as const, label: "Metric", sub: "km · m · km/h" },
									{ key: "mi" as const, label: "Imperial", sub: "mi · ft · mph" },
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
							<ChangeLaterHint>Switch units any time from Settings.</ChangeLaterHint>
						</>
					)}

					{step === 2 && (
						<>
							<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
								{speedSports.map((sport) => {
									const cfg = SPORTS.find((s) => s.key === sport);
									if (!cfg) return null;
									const Icon = cfg.icon;
									const kmh = sportSpeeds[sport] ?? DEFAULT_SPORT_SPEEDS_KMH[sport];
									const display = toDisplay(kmh, units);
									return (
										<div
											key={sport}
											style={{
												display: "flex",
												alignItems: "center",
												gap: 14,
												padding: "12px 14px",
												background: RDS_COLORS.bgInput,
												border: `1px solid ${RDS_COLORS.border}`,
												borderRadius: 12,
											}}
										>
											<div
												style={{
													width: 34,
													height: 34,
													borderRadius: 10,
													background: RDS_COLORS.accentSoft,
													color: RDS_COLORS.accent,
													display: "inline-flex",
													alignItems: "center",
													justifyContent: "center",
													flexShrink: 0,
												}}
											>
												<Icon size={18} />
											</div>
											<div style={{ flex: 1, minWidth: 0 }}>
												<div style={{ fontSize: 13, fontWeight: 600, color: RDS_COLORS.fg }}>{cfg.label}</div>
												<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>Average pace</div>
											</div>
											<input
												type="number"
												min={1}
												max={100}
												step={units === "mi" ? 0.5 : 1}
												value={Number.isFinite(display) ? Math.round(display * 10) / 10 : ""}
												onChange={(e) => {
													const n = Number.parseFloat(e.target.value);
													if (Number.isFinite(n) && n > 0) {
														setSportSpeed(sport, fromDisplay(n, units));
													}
												}}
												style={{
													width: 72,
													height: 34,
													padding: "0 10px",
													borderRadius: 8,
													background: RDS_COLORS.bgPanel,
													border: `1px solid ${RDS_COLORS.border}`,
													color: RDS_COLORS.fg,
													fontSize: 13,
													textAlign: "right",
												}}
											/>
											<span style={{ fontSize: 12, color: RDS_COLORS.fgMuted, width: 36 }}>{unitLabel}</span>
										</div>
									);
								})}
							</div>
							<ChangeLaterHint>Tweak speeds whenever — Settings → Sports.</ChangeLaterHint>
						</>
					)}

					{step === 3 && (
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
													{m.label}
												</div>
												<div style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, lineHeight: 1.35 }}>{m.sub}</div>
											</div>
										</button>
									);
								})}
							</div>
							<ChangeLaterHint>Flip styles from the layers menu on the map any time.</ChangeLaterHint>
						</>
					)}

					{step === 4 && (
						<>
							<LocationStep
								permission={locationPermission}
								requesting={requestingLocation}
								onAllow={requestLocation}
								onSkip={skipLocation}
							/>
							<ChangeLaterHint>You can grant or revoke location any time in Settings → Privacy.</ChangeLaterHint>
						</>
					)}
				</div>

				<div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24 }}>
					<Btn variant="ghost" onClick={finish} style={{ color: RDS_COLORS.fgMuted }}>
						Skip
					</Btn>
					<div style={{ flex: 1 }} />
					{step > 0 && <Btn onClick={() => setStep(step - 1)}>Back</Btn>}
					<Btn variant="primary" onClick={next} disabled={!canContinue}>
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
		</AuthBackdrop>
	);
}

function LocationStep({
	permission,
	requesting,
	onAllow,
	onSkip,
}: {
	permission: LocationPermission;
	requesting: boolean;
	onAllow: () => void;
	onSkip: () => void;
}) {
	const granted = permission === "granted";
	const denied = permission === "denied";
	const skipped = permission === "skipped";
	const decided = granted || denied || skipped;

	const statusLabel = granted
		? "Location enabled"
		: denied
			? "Permission denied"
			: skipped
				? "Skipped for now"
				: "Not decided yet";

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
					<div style={{ fontSize: 13.5, fontWeight: 600, color: RDS_COLORS.fg }}>Use my location</div>
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
					<span>Centre the map on you when you open Routess.</span>
				</li>
				<li style={{ display: "flex", gap: 8 }}>
					<I.check size={12} style={{ marginTop: 4, color: RDS_COLORS.success, flexShrink: 0 }} />
					<span>Snap your start point to your real-world position.</span>
				</li>
				<li style={{ display: "flex", gap: 8 }}>
					<I.lock size={12} style={{ marginTop: 4, color: RDS_COLORS.fgSubtle, flexShrink: 0 }} />
					<span>Stays on your device. Never sent to our servers.</span>
				</li>
			</ul>

			<div style={{ display: "flex", gap: 8, marginTop: 4 }}>
				<Btn variant="primary" onClick={onAllow} disabled={requesting || granted} style={{ flex: 1, height: 40 }}>
					{requesting ? "Requesting..." : granted ? "Granted" : decided ? "Try again" : "Allow location"}
				</Btn>
				<Btn onClick={onSkip} disabled={requesting} style={{ flex: 1, height: 40 }}>
					Maybe later
				</Btn>
			</div>
		</div>
	);
}
