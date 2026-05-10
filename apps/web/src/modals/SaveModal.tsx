import type { RoutePrivacy } from "@routess/core";
import { useEffect, useMemo, useState } from "react";
import { useIsAuthenticated } from "@/hooks/useAuthState";
import { useSaveRoute } from "@/lib/api-queries";
import { emitAppEvent } from "@/lib/app-events";
import { useT } from "@/lib/i18n";
import { useModalsStore } from "@/stores/modalsStore";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import {
	useDistanceMeters,
	useDurationSeconds,
	useElevationGain,
	useRouteDistance,
	useRouteDuration,
	useWaypoints,
} from "@/stores/routingStore";
import { useToastStore } from "@/stores/toastStore";
import { apiRouteToLoadedRoute, type RedesignActivity, useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { ModalShell } from "../components/ModalShell";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";

const ACTIVITIES: { key: RedesignActivity; icon: React.ComponentType<{ size?: number }>; labelKey: string }[] = [
	{ key: "run", icon: I.run, labelKey: "sport.short.run" },
	{ key: "cycle", icon: I.bike, labelKey: "sport.short.cycle" },
	{ key: "walk", icon: I.walk, labelKey: "sport.short.walk" },
];

const PRIVACY_OPTS: { key: RoutePrivacy; labelKey: string; subKey: string }[] = [
	{ key: "private", labelKey: "save.privacy.private", subKey: "save.privacy.privateSub" },
	{ key: "link", labelKey: "save.privacy.link", subKey: "save.privacy.linkSub" },
	{ key: "public", labelKey: "save.privacy.public", subKey: "save.privacy.publicSub" },
];

export function SaveModal() {
	const t = useT();
	const closeModal = useModalsStore((s) => s.closeModal);
	const waypoints = useWaypoints();
	const distance = useRouteDistance();
	const duration = useRouteDuration();
	const distanceMeters = useDistanceMeters();
	const durationSeconds = useDurationSeconds();
	const elevationGain = useElevationGain();
	const { activityType, setActivityType } = useUiStore();
	const setLoadedRoute = useUiStore((s) => s.setLoadedRoute);
	const selectedSports = useRedesignSettingsStore((s) => s.selectedSports);
	const saveRoute = useSaveRoute();
	const pushToast = useToastStore((s) => s.push);
	const isAuthenticated = useIsAuthenticated();

	const availableActivities = useMemo(
		() => (selectedSports.length > 0 ? ACTIVITIES.filter((a) => selectedSports.includes(a.key)) : ACTIVITIES),
		[selectedSports],
	);

	useEffect(() => {
		if (selectedSports.length === 0) return;
		if (!selectedSports.includes(activityType)) {
			setActivityType(selectedSports[0]);
		}
	}, [selectedSports, activityType, setActivityType]);

	const [name, setName] = useState("");
	const [privacy, setPrivacy] = useState<RoutePrivacy>("private");
	const [tags, setTags] = useState<string[]>([]);
	const [tagDraft, setTagDraft] = useState("");

	const wpCount = waypoints.length;

	if (!isAuthenticated) {
		return <SignInToSave distance={distance} duration={duration} wpCount={wpCount} onClose={closeModal} />;
	}

	const handleSave = () => {
		if (!name.trim() || waypoints.length < 2) return;
		const trimmedName = name.trim();
		saveRoute.mutate(
			{
				name: trimmedName,
				activity: activityType,
				privacy,
				tags,
				waypoints,
				distance: distanceMeters ?? 0,
				duration: durationSeconds ?? undefined,
				elevationGain: elevationGain != null ? Math.round(elevationGain) : 0,
			},
			{
				onSuccess: (created) => {
					setLoadedRoute(apiRouteToLoadedRoute(created));
					pushToast({
						kind: "success",
						title: t("save.toast.saved"),
						body: `${trimmedName} · ${distance || "—"}`,
					});
					closeModal();
				},
				onError: () => {
					pushToast({
						kind: "danger",
						title: t("save.toast.failed"),
						body: t("common.tryAgain"),
					});
				},
			},
		);
	};

	const addTag = () => {
		const tag = tagDraft.trim();
		if (!tag || tags.includes(tag)) return;
		setTags([...tags, tag]);
		setTagDraft("");
	};

	return (
		<ModalShell
			title={t("save.title")}
			sub={t("save.waypointsCount", {
				distance: distance || "—",
				duration: duration || "—",
				count: String(wpCount),
			})}
			width={520}
			onClose={closeModal}
			footer={
				<>
					<div style={{ flex: 1 }} />
					<Btn onClick={closeModal}>{t("common.cancel")}</Btn>
					<Btn variant="primary" onClick={handleSave} disabled={!name.trim() || wpCount < 2 || saveRoute.isPending}>
						<I.save size={14} /> {saveRoute.isPending ? t("save.saving") : t("save.title")}
					</Btn>
				</>
			}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>{t("save.name")}</SecTitle>
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder={t("save.namePlaceholder")}
						style={{
							height: 36,
							padding: "0 12px",
							borderRadius: 8,
							background: RDS_COLORS.bgInput,
							border: `1px solid ${RDS_COLORS.border}`,
							color: RDS_COLORS.fg,
							fontSize: 13.5,
							outline: "none",
						}}
						// biome-ignore lint/a11y/noAutofocus: name input is the primary action; focusing on modal open is expected
						autoFocus
					/>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>{t("save.activity")}</SecTitle>
					<div style={{ display: "flex", gap: 8 }}>
						{availableActivities.map((a) => {
							const Icon = a.icon;
							const on = activityType === a.key;
							return (
								<button
									key={a.key}
									type="button"
									onClick={() => setActivityType(a.key)}
									style={{
										display: "inline-flex",
										alignItems: "center",
										gap: 6,
										flex: 1,
										height: 42,
										borderRadius: 8,
										background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
										color: on ? RDS_COLORS.accent : RDS_COLORS.fgMuted,
										border: on ? `1px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
										fontSize: 13,
										fontWeight: 500,
										justifyContent: "center",
										cursor: "pointer",
									}}
								>
									<Icon size={14} /> {t(a.labelKey)}
								</button>
							);
						})}
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>{t("save.privacyLabel")}</SecTitle>
					<div
						style={{
							background: RDS_COLORS.bgInput,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 8,
							padding: 4,
							display: "grid",
							gridTemplateColumns: "1fr 1fr 1fr",
							gap: 4,
						}}
					>
						{PRIVACY_OPTS.map((p) => {
							const on = privacy === p.key;
							return (
								<button
									key={p.key}
									type="button"
									onClick={() => setPrivacy(p.key)}
									style={{
										padding: "8px 10px",
										borderRadius: 6,
										background: on ? RDS_COLORS.bgPanel : "transparent",
										boxShadow: on ? "var(--rds-shadow-sm)" : "none",
										border: 0,
										textAlign: "left",
										cursor: "pointer",
									}}
								>
									<div style={{ fontSize: 12.5, fontWeight: 600, color: RDS_COLORS.fg }}>{t(p.labelKey)}</div>
									<div style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>{t(p.subKey)}</div>
								</button>
							);
						})}
					</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<SecTitle>{t("save.tags")}</SecTitle>
					<div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
						{tags.map((tag) => (
							<span
								key={tag}
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 6,
									padding: "2px 8px",
									height: 22,
									borderRadius: 999,
									background: RDS_COLORS.bgInput,
									color: RDS_COLORS.fgMuted,
									fontSize: 11.5,
								}}
							>
								{tag}
								<button
									type="button"
									onClick={() => setTags(tags.filter((x) => x !== tag))}
									style={{ background: "transparent", border: 0, color: "inherit", cursor: "pointer", padding: 0 }}
									aria-label={t("save.removeTag", { tag })}
								>
									<I.close size={10} />
								</button>
							</span>
						))}
						<input
							value={tagDraft}
							onChange={(e) => setTagDraft(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									addTag();
								}
							}}
							placeholder={t("save.addTag")}
							style={{
								flex: 1,
								minWidth: 100,
								height: 22,
								padding: "0 8px",
								borderRadius: 999,
								background: "transparent",
								border: `1px dashed ${RDS_COLORS.borderStrong}`,
								color: RDS_COLORS.fgMuted,
								fontSize: 11.5,
								outline: "none",
							}}
						/>
					</div>
				</div>
			</div>
		</ModalShell>
	);
}

function SignInToSave({
	distance,
	duration,
	wpCount,
	onClose,
}: {
	distance: string;
	duration: string;
	wpCount: number;
	onClose: () => void;
}) {
	const t = useT();
	const goToSignIn = () => {
		onClose();
		emitAppEvent("routess:open-login");
	};

	const goToSignUp = () => {
		onClose();
		emitAppEvent("routess:open-signup");
	};

	return (
		<ModalShell
			title={t("save.gate.title")}
			sub={t("save.waypointsCount", {
				distance: distance || "—",
				duration: duration || "—",
				count: String(wpCount),
			})}
			width={420}
			onClose={onClose}
			footer={
				<>
					<Btn onClick={onClose}>{t("common.cancel")}</Btn>
					<div style={{ flex: 1 }} />
					<Btn onClick={goToSignUp}>{t("save.createAccount")}</Btn>
					<Btn variant="primary" onClick={goToSignIn}>
						<I.user size={14} /> {t("common.signIn")}
					</Btn>
				</>
			}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
				<p style={{ margin: 0, fontSize: 13.5, color: RDS_COLORS.fg, lineHeight: 1.5 }}>{t("save.gate.subtitle")}</p>
				<p style={{ margin: 0, fontSize: 12.5, color: RDS_COLORS.fgMuted, lineHeight: 1.5 }}>{t("save.gate.body")}</p>

				<ul
					style={{
						listStyle: "none",
						padding: 0,
						margin: 0,
						display: "flex",
						flexDirection: "column",
						gap: 8,
						fontSize: 12.5,
						color: RDS_COLORS.fgMuted,
					}}
				>
					<li style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<I.save size={12} /> {t("save.gate.benefit.unlimited")}
					</li>
					<li style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<I.library size={12} /> {t("save.gate.benefit.sync")}
					</li>
					<li style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<I.share size={12} /> {t("save.gate.benefit.share")}
					</li>
				</ul>
			</div>
		</ModalShell>
	);
}
