import { FREE_SAVED_ROUTE_LIMIT, type RouteVisibility } from "@routess/core";
import { useEffect, useMemo, useState } from "react";
import { ProLock, useProGates, useProGateToast } from "@/features/billing/proGates";
import { useBoundLocalRoute, useLocalRoutes } from "@/features/localRoutes/localRoutesStore";
import { useSaveLocalRoute } from "@/features/localRoutes/useSaveLocalRoute";
import { applySavedRoute } from "@/features/routing/applySavedRoute";
import { useIsAuthenticated } from "@/hooks/useAuthState";
import type { CreateRouteRequest } from "@/lib/api";
import { useBillingStatus, useSaveRoute } from "@/lib/api-queries";
import { emitAppEvent } from "@/lib/app-events";
import { useT } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { useModalsStore } from "@/stores/modalsStore";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import {
	useDistanceMeters,
	useDraftCreationSource,
	useDraftRoutingPreferences,
	useDurationSeconds,
	useElevationGain,
	useRouteDistance,
	useRouteDuration,
	useRoutePath,
	useWaypoints,
} from "@/stores/routingStore";
import { useToastStore } from "@/stores/toastStore";
import { type RedesignActivity, useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { ModalShell } from "../components/ModalShell";
import { Btn, RDS_COLORS, SecTitle } from "../components/primitives";

const ACTIVITIES: { key: RedesignActivity; icon: React.ComponentType<{ size?: number }>; labelKey: string }[] = [
	{ key: "run", icon: I.run, labelKey: "sport.short.run" },
	{ key: "cycle", icon: I.bike, labelKey: "sport.short.cycle" },
	{ key: "walk", icon: I.walk, labelKey: "sport.short.walk" },
];

const VISIBILITY_OPTS: { key: RouteVisibility; labelKey: string; subKey: string }[] = [
	{ key: "private", labelKey: "save.visibility.private", subKey: "save.visibility.privateSub" },
	{ key: "unlisted", labelKey: "save.visibility.unlisted", subKey: "save.visibility.unlistedSub" },
	{ key: "public", labelKey: "save.visibility.public", subKey: "save.visibility.publicSub" },
];

export function SaveModal() {
	const t = useT();
	const closeModal = useModalsStore((s) => s.closeModal);
	const waypoints = useWaypoints();
	const routePath = useRoutePath();
	const distance = useRouteDistance();
	const duration = useRouteDuration();
	const distanceMeters = useDistanceMeters();
	const durationSeconds = useDurationSeconds();
	const elevationGain = useElevationGain();
	const draftRoutingPreferences = useDraftRoutingPreferences();
	const creationSource = useDraftCreationSource();
	const { activityType, setActivityType } = useUiStore();
	const selectedSports = useRedesignSettingsStore((s) => s.selectedSports);
	const defaultRouteVisibility = useRedesignSettingsStore((s) => s.defaultRouteVisibility);
	const saveRoute = useSaveRoute();
	const pushToast = useToastStore((s) => s.push);
	const isAuthenticated = useIsAuthenticated();
	const { atSavedRouteLimit } = useProGates();
	const proGateToast = useProGateToast();
	// Without an account the route is saved on this device (a LocalRoute).
	// Saving again after opening or saving one updates it in place. The device
	// holds as many routes as a free account, so signing up never strands any.
	const saveLocal = useSaveLocalRoute();
	const { routes: localRoutes } = useLocalRoutes();
	const boundLocalRoute = useBoundLocalRoute();
	const billingEnabled = useBillingStatus().data?.enabled === true;
	const atLimit = isAuthenticated
		? atSavedRouteLimit
		: billingEnabled && !boundLocalRoute && localRoutes.length >= FREE_SAVED_ROUTE_LIMIT;
	const isPending = isAuthenticated ? saveRoute.isPending : saveLocal.isPending;

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
	// Seed from the user's "default route visibility" setting.
	const [visibility, setVisibility] = useState<RouteVisibility>(defaultRouteVisibility);
	const [tags, setTags] = useState<string[]>([]);
	const [tagDraft, setTagDraft] = useState("");
	// Set once a new route is saved on the device: the modal turns into the
	// sign-up offer.
	const [savedLocally, setSavedLocally] = useState<string | null>(null);

	// Saving a LocalRoute again keeps its name and tags unless the user changes
	// them. The routes can finish loading from storage after the modal opens.
	const boundRoute = isAuthenticated ? undefined : boundLocalRoute?.route;
	useEffect(() => {
		if (!boundRoute) return;
		setName((current) => current || boundRoute.name);
		setTags((current) => (current.length > 0 ? current : (boundRoute.tags ?? [])));
	}, [boundRoute]);

	const wpCount = waypoints.length;

	const handleSave = () => {
		if (!name.trim() || waypoints.length < 2) return;
		if (atLimit) return;
		const trimmedName = name.trim();
		const route: CreateRouteRequest = {
			name: trimmedName,
			activity: activityType,
			tags,
			waypoints,
			...(routePath.length >= 2 ? { geometry: routePath } : {}),
			distance: distanceMeters ?? 0,
			duration: durationSeconds ?? undefined,
			elevationGain: elevationGain != null ? Math.round(elevationGain) : 0,
			...(draftRoutingPreferences ? { routingPreferences: draftRoutingPreferences } : {}),
			// A draft born from a confirmed GenerationCandidate saves with
			// Provenance "generation" (immutable, per ADR-0023/0029).
			...(creationSource === "generated" ? { provenance: "generation" as const } : {}),
		};
		if (!isAuthenticated) {
			saveLocal
				.mutate(route, creationSource)
				.then(({ isUpdate }) => {
					// The moment a route exists is the moment to offer an account.
					// Updates of a route already offered just confirm.
					if (!isUpdate) {
						setSavedLocally(trimmedName);
						return;
					}
					pushToast({
						kind: "success",
						title: t("save.local.toast.saved"),
						body: `${trimmedName} · ${distance || "—"}`,
					});
					closeModal();
				})
				.catch((error: unknown) => {
					Logger.error("[SaveModal] saving on this device failed:", error);
					pushToast({ kind: "danger", title: t("save.toast.failed"), body: t("common.tryAgain") });
				});
			return;
		}
		saveRoute.mutate(
			{ ...route, visibility, creationSource },
			{
				onSuccess: (created) => {
					applySavedRoute(created);
					pushToast({
						kind: "success",
						title: t("save.toast.saved"),
						body: `${trimmedName} · ${distance || "—"}`,
					});
					closeModal();
				},
				onError: (error) => {
					if (proGateToast(error)) return;
					pushToast({
						kind: "danger",
						title: t("save.toast.failed"),
						body: t("common.tryAgain"),
					});
				},
			},
		);
	};

	if (savedLocally) return <KeepOnPhonePrompt routeName={savedLocally} onClose={closeModal} />;

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
				atLimit ? (
					<>
						<ProLock feature="unlimited_saved_routes" style={{ flex: 1 }} />
						<Btn onClick={closeModal}>{t("common.cancel")}</Btn>
					</>
				) : (
					<>
						<div style={{ flex: 1 }} />
						<Btn onClick={closeModal}>{t("common.cancel")}</Btn>
						<Btn variant="primary" onClick={handleSave} disabled={!name.trim() || wpCount < 2 || isPending}>
							<I.save size={14} /> {isPending ? t("save.saving") : t("save.title")}
						</Btn>
					</>
				)
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

				{isAuthenticated ? (
					<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
						<SecTitle>{t("save.visibilityLabel")}</SecTitle>
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
							{VISIBILITY_OPTS.map((p) => {
								const on = visibility === p.key;
								return (
									<button
										key={p.key}
										type="button"
										onClick={() => setVisibility(p.key)}
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
				) : (
					<p style={{ margin: 0, display: "flex", gap: 8, fontSize: 12.5, color: RDS_COLORS.fgMuted, lineHeight: 1.5 }}>
						<I.lock size={13} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
						{t("save.local.note")}
					</p>
				)}

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

// After a first save on the device: the case for an account, framed around
// the route that now exists. Signing up or in claims it into the account.
function KeepOnPhonePrompt({ routeName, onClose }: { routeName: string; onClose: () => void }) {
	const t = useT();
	const open = (event: "routess:open-signup" | "routess:open-login") => {
		onClose();
		emitAppEvent(event, { entryPoint: "local_save_prompt" });
	};
	return (
		<ModalShell
			title={t("save.local.prompt.title")}
			sub={routeName}
			width={420}
			onClose={onClose}
			footer={
				<>
					<Btn onClick={onClose}>{t("save.local.prompt.notNow")}</Btn>
					<div style={{ flex: 1 }} />
					<Btn onClick={() => open("routess:open-login")}>
						<I.user size={14} /> {t("common.signIn")}
					</Btn>
					<Btn variant="primary" onClick={() => open("routess:open-signup")}>
						{t("save.createAccount")}
					</Btn>
				</>
			}
		>
			<p style={{ margin: 0, fontSize: 13.5, color: RDS_COLORS.fg, lineHeight: 1.5 }}>{t("save.local.prompt.body")}</p>
		</ModalShell>
	);
}
