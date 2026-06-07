import {
	type Coordinate,
	ROUTE_ACTIVITIES,
	ROUTE_VISIBILITIES,
	type RouteActivity,
	type RouteVisibility,
} from "@routess/core";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useComputedElevationProfile } from "@/features/routing/services/elevation";
import {
	breakdownFromComposition,
	fetchSurfaceBreakdown,
	type SurfaceBreakdown,
} from "@/features/routing/services/SurfaceService";
import type { ApiRoute } from "@/lib/api";
import { useSaveRoute, useToggleFavourite, useUpdateRoute } from "@/lib/api-queries";
import { emitAppEvent, routeToLoadDetail } from "@/lib/app-events";
import { useT } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { useUnits } from "@/lib/units";
import { MOBILE_DRAWER_SNAPS, useMobileDrawerStore } from "@/stores/mobileDrawerStore";
import { useModalsStore } from "@/stores/modalsStore";
import { useToastStore } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";
import { EditableLabel } from "../components/EditableLabel";
import { I, type IconKey } from "../components/icons";
import { Btn, IconBtn, RDS_COLORS, SecTitle } from "../components/primitives";
import { RouteProfileChart } from "../components/RouteProfileChart";
import { ShareRouteDialog } from "./social/ShareRouteDialog";

const ACTIVITY_LABEL: Record<RouteActivity, { labelKey: string; icon: IconKey }> = {
	cycle: { labelKey: "sport.cycle", icon: "bike" },
	run: { labelKey: "sport.run", icon: "run" },
	walk: { labelKey: "sport.walk", icon: "walk" },
};

const VISIBILITY_LABEL: Record<RouteVisibility, { labelKey: string; icon: IconKey }> = {
	private: { labelKey: "save.visibility.private", icon: "lock" },
	unlisted: { labelKey: "save.visibility.unlistedSub", icon: "share" },
	public: { labelKey: "save.visibility.public", icon: "globe" },
};

const TAG_PATTERN = /^[a-z0-9][a-z0-9-]{0,23}$/;
const MAX_TAGS = 10;

function normaliseTag(input: string): string {
	return input.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24);
}

function TagEditor({
	tags,
	disabled,
	onChange,
}: {
	tags: string[];
	disabled?: boolean;
	onChange: (next: string[]) => void;
}) {
	const t = useT();
	const [draft, setDraft] = useState("");

	const commit = () => {
		const next = normaliseTag(draft);
		setDraft("");
		if (!next || tags.includes(next) || tags.length >= MAX_TAGS || !TAG_PATTERN.test(next)) return;
		onChange([...tags, next]);
	};

	const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag));

	const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			commit();
		} else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
			removeTag(tags[tags.length - 1]);
		}
	};

	return (
		<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
			{tags.map((tag) => (
				<span
					key={tag}
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 4,
						padding: "2px 4px 2px 10px",
						height: 24,
						borderRadius: 999,
						background: RDS_COLORS.accentSoft,
						color: RDS_COLORS.accent,
						fontSize: 11.5,
						fontWeight: 500,
					}}
				>
					#{tag}
					<button
						type="button"
						onClick={() => removeTag(tag)}
						disabled={disabled}
						aria-label={t("route.tag.remove", { tag })}
						style={{
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							width: 16,
							height: 16,
							borderRadius: 999,
							border: 0,
							background: "transparent",
							color: RDS_COLORS.accent,
							cursor: disabled ? "not-allowed" : "pointer",
						}}
					>
						<I.close size={10} />
					</button>
				</span>
			))}
			{tags.length < MAX_TAGS && (
				<input
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={onKey}
					onBlur={commit}
					disabled={disabled}
					placeholder={t("route.tag.addPlaceholder")}
					style={{
						height: 24,
						minWidth: 100,
						background: "transparent",
						border: `1px dashed ${RDS_COLORS.border}`,
						borderRadius: 999,
						padding: "0 10px",
						fontSize: 11.5,
						color: "inherit",
						outline: "none",
					}}
				/>
			)}
		</div>
	);
}

function SegmentedSelector<T extends string>({
	value,
	options,
	onChange,
	disabled,
}: {
	value: T | undefined;
	options: Array<{ value: T; label: string; icon: IconKey }>;
	onChange: (next: T) => void;
	disabled?: boolean;
}) {
	return (
		<div
			style={{
				display: "inline-flex",
				gap: 4,
				padding: 3,
				borderRadius: 999,
				background: RDS_COLORS.bgInput,
				border: `1px solid ${RDS_COLORS.border}`,
			}}
		>
			{options.map((opt) => {
				const on = value === opt.value;
				const Icon = I[opt.icon];
				return (
					<button
						key={opt.value}
						type="button"
						onClick={() => !disabled && onChange(opt.value)}
						disabled={disabled}
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 6,
							height: 24,
							padding: "0 10px",
							borderRadius: 999,
							border: 0,
							background: on ? RDS_COLORS.bgPanel : "transparent",
							color: on ? RDS_COLORS.fg : RDS_COLORS.fgMuted,
							boxShadow: on ? `0 0 0 1px ${RDS_COLORS.border}` : "none",
							fontSize: 11.5,
							fontWeight: 500,
							cursor: disabled ? "not-allowed" : "pointer",
						}}
					>
						<Icon size={11} /> {opt.label}
					</button>
				);
			})}
		</div>
	);
}

export function RouteDetailPanel({ route, onBack }: { route: ApiRoute; onBack: () => void }) {
	const t = useT();
	const { formatDistanceParts, formatSpeedParts, formatElevationParts } = useUnits();
	const distanceParts = route.distance ? formatDistanceParts(route.distance / 1000) : null;
	const elevParts = route.elevationGain ? formatElevationParts(route.elevationGain) : null;
	const speedParts =
		route.distance && route.duration ? formatSpeedParts(route.distance / 1000 / (route.duration / 3600) || 0) : null;
	const distanceStr = distanceParts ? distanceParts.value : "—";
	const distanceUnit = distanceParts ? distanceParts.unit : "";
	const totalMinutes = route.duration ? Math.round(route.duration / 60) : 0;
	const durationStr = route.duration
		? totalMinutes >= 60
			? `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`
			: String(totalMinutes)
		: "—";
	const durationUnit = route.duration ? (totalMinutes >= 60 ? "h" : "min") : "";
	const elevStr = elevParts ? elevParts.value : "—";
	const elevUnit = elevParts ? elevParts.unit : "";
	const paceStr = speedParts ? speedParts.value : "—";
	const paceUnit = speedParts ? speedParts.unit : "";

	const saveRoute = useSaveRoute();
	const updateRoute = useUpdateRoute();
	const openDelete = useModalsStore((s) => s.openDelete);
	const openShareModal = useModalsStore((s) => s.openShare);
	const pushToast = useToastStore((s) => s.push);
	const toggleFavourite = useToggleFavourite();
	const setContext = useUiStore((s) => s.setContext);
	const favorited = route.favourite;

	// Saved routes don't persist the elevation profile array (only the gain
	// number), so re-sample the stored geometry on view. Falls back to
	// waypoint coords for legacy routes saved before geometry persistence.
	const elevationGeometry = useMemo<Coordinate[]>(() => {
		if (route.geometry && route.geometry.length >= 2) return route.geometry;
		return (route.waypoints ?? []).map((w) => w.coord);
	}, [route.geometry, route.waypoints]);
	const { profile: computedProfile, loading: elevationLoading } = useComputedElevationProfile(
		elevationGeometry,
		String(route.id),
	);

	const [shareToUserOpen, setShareToUserOpen] = useState(false);

	// Saved routes carry a persisted surfaceComposition (ADR 0031); only
	// legacy rows that predate the derivation fall back to a live fetch.
	const persistedBreakdown = useMemo(
		() => (route.surfaceComposition ? breakdownFromComposition(route.surfaceComposition) : null),
		[route.surfaceComposition],
	);
	const [surfaceBreakdown, setSurfaceBreakdown] = useState<SurfaceBreakdown | null>(null);
	const [surfaceLoading, setSurfaceLoading] = useState(false);
	// Saved routes carry their own Activity; fall back to "cycle" for legacy
	// rows that lack one, since that produces the most permissive surface match.
	const surfaceActivity: RouteActivity = route.activity ?? "cycle";
	useEffect(() => {
		if (persistedBreakdown) {
			setSurfaceBreakdown(persistedBreakdown);
			setSurfaceLoading(false);
			return;
		}
		if (elevationGeometry.length < 2) {
			setSurfaceBreakdown(null);
			setSurfaceLoading(false);
			return;
		}
		const controller = new AbortController();
		const timeoutId = window.setTimeout(() => controller.abort(), 10000);
		setSurfaceLoading(true);
		fetchSurfaceBreakdown(elevationGeometry, surfaceActivity, controller.signal)
			.then((result) => {
				setSurfaceBreakdown(result);
				setSurfaceLoading(false);
			})
			.catch((err) => {
				if ((err as Error)?.name !== "AbortError") {
					Logger.warn("[RouteDetailPanel] surface fetch failed:", err);
				}
				setSurfaceBreakdown(null);
				setSurfaceLoading(false);
			})
			.finally(() => {
				window.clearTimeout(timeoutId);
			});
		return () => {
			controller.abort();
			window.clearTimeout(timeoutId);
		};
	}, [persistedBreakdown, elevationGeometry, surfaceActivity]);

	const tags = route.tags ?? [];
	const [pendingPublicVisibility, setPendingPublicVisibility] = useState(false);

	const mutateMeta = (updates: { activity?: RouteActivity; visibility?: RouteVisibility; tags?: string[] }) => {
		updateRoute.mutate(
			{ routeId: route.id, updates },
			{
				onError: () => {
					pushToast({ kind: "danger", title: t("route.updateFailed"), body: t("common.tryAgain") });
				},
			},
		);
	};

	const onVisibilityChange = (next: RouteVisibility) => {
		if (next === route.visibility) return;
		if (next === "public" && route.visibility !== "public") {
			setPendingPublicVisibility(true);
			return;
		}
		mutateMeta({ visibility: next });
	};

	const confirmPublic = () => {
		setPendingPublicVisibility(false);
		mutateMeta({ visibility: "public" });
	};

	// On mobile, open the drawer at the half-snap so the map stays visible
	// above the elevation chart and the user can scrub to inspect surface and
	// elevation at any point along the route. Restore to full on unmount so
	// other panels (library list, etc.) revert to their preferred snap.
	const setDrawerSnap = useMobileDrawerStore((s) => s.setSnap);
	useEffect(() => {
		setDrawerSnap(MOBILE_DRAWER_SNAPS[0]);
		return () => setDrawerSnap(MOBILE_DRAWER_SNAPS[1]);
	}, [setDrawerSnap]);

	const dispatchLoadRoute = () => {
		emitAppEvent("routess:load-route", routeToLoadDetail(route));
		setContext("plan");
		pushToast({
			kind: "success",
			title: t("route.loaded"),
			body: route.name,
		});
	};

	const dispatchShare = () => {
		// Share this route directly; loading it into the planner first would
		// clobber whatever draft the user is working on.
		openShareModal(route.id);
	};

	const dispatchFavorite = () => {
		toggleFavourite.mutate({ routeId: route.id, favourite: !route.favourite });
	};

	const dispatchDuplicate = () => {
		saveRoute.mutate(
			{
				name: `${route.name} (copy)`,
				description: route.description,
				activity: route.activity,
				visibility: "private",
				tags: route.tags,
				waypoints: route.waypoints,
				geometry: route.geometry,
				distance: route.distance,
				duration: route.duration,
				elevationGain: route.elevationGain,
				startAddress: route.startAddress,
				endAddress: route.endAddress,
				provenance: route.provenance,
				...(route.routingPreferences ? { routingPreferences: route.routingPreferences } : {}),
			},
			{
				onSuccess: (newRoute) => {
					pushToast({
						kind: "success",
						title: t("route.duplicated"),
						body: newRoute.name,
					});
				},
				onError: () => {
					pushToast({
						kind: "danger",
						title: t("route.duplicateFailed"),
						body: t("common.tryAgain"),
					});
				},
			},
		);
	};

	const dispatchDelete = () => {
		openDelete(route.id);
	};

	const renameRoute = (next: string | undefined) => {
		if (!next || next === route.name) return;
		updateRoute.mutate(
			{ routeId: route.id, updates: { name: next } },
			{
				onError: () => {
					pushToast({ kind: "danger", title: t("route.renameFailed"), body: t("common.tryAgain") });
				},
			},
		);
	};

	const dispatchExport = () => {
		emitAppEvent("routess:export-gpx", { routeId: route.id });
	};

	const renameWaypoint = (index: number, next: string | undefined) => {
		const current = route.waypoints[index]?.name;
		if (current === next) return;
		const updatedWaypoints = route.waypoints.map((wp, i) => {
			if (i !== index) return wp;
			const { name: _omit, ...rest } = wp;
			return next ? { ...rest, name: next } : rest;
		});
		updateRoute.mutate(
			{ routeId: route.id, updates: { waypoints: updatedWaypoints } },
			{
				onError: () => {
					pushToast({
						kind: "danger",
						title: t("route.renameFailed"),
						body: t("common.tryAgain"),
					});
				},
			},
		);
	};

	const stats = [
		{ label: t("route.distance"), value: distanceStr, unit: distanceUnit },
		{ label: t("route.duration"), value: durationStr, unit: durationUnit },
		{ label: t("route.elev"), value: elevStr, unit: elevUnit },
		{ label: t("route.avgSpeed"), value: paceStr, unit: paceUnit },
	];

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					padding: "12px 20px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<IconBtn title={t("route.back")} onClick={onBack}>
					<I.chevronL size={16} />
				</IconBtn>
				<span style={{ fontSize: 13, color: RDS_COLORS.fgMuted }}>{t("route.library")}</span>
				<div style={{ flex: 1 }} />
				<IconBtn title={favorited ? t("route.removeFavourite") : t("route.makeFavourite")} onClick={dispatchFavorite}>
					<I.heart size={14} style={favorited ? { color: RDS_COLORS.danger, fill: "currentColor" } : undefined} />
				</IconBtn>
				<IconBtn
					title={saveRoute.isPending ? t("route.duplicating") : t("route.duplicate")}
					onClick={dispatchDuplicate}
					disabled={saveRoute.isPending}
				>
					<I.copy size={14} />
				</IconBtn>
			</div>

			<div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 20 }}>
				<EditableLabel
					value={route.name}
					placeholder={t("route.field.namePlaceholder")}
					onSave={renameRoute}
					disabled={updateRoute.isPending}
					ariaLabel={t("library.card.rename")}
					style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4, width: "100%" }}
				/>
				<p className="rds-mono" style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, margin: "4px 0 0" }}>
					{t("route.created", {
						date: new Date(route.createdAt).toLocaleDateString(),
						count: String(route.waypoints?.length ?? 0),
					})}
				</p>

				{/* Stat strip */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(4, 1fr)",
						marginTop: 14,
						padding: 14,
						background: RDS_COLORS.bgPanelElev,
						borderRadius: 10,
						border: `1px solid ${RDS_COLORS.border}`,
					}}
				>
					{stats.map((s, i) => (
						<div
							key={s.label}
							style={{
								borderLeft: i ? `1px solid ${RDS_COLORS.border}` : "none",
								paddingLeft: i ? 14 : 0,
							}}
						>
							<SecTitle style={{ fontSize: 10, whiteSpace: "nowrap" }}>{s.label}</SecTitle>
							<div
								className="rds-mono"
								style={{
									display: "flex",
									alignItems: "baseline",
									gap: 3,
									fontSize: 20,
									fontWeight: 600,
									lineHeight: 1.1,
									marginTop: 4,
									whiteSpace: "nowrap",
								}}
							>
								{s.value}
								{s.unit && <span style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, fontWeight: 400 }}>{s.unit}</span>}
							</div>
						</div>
					))}
				</div>

				{elevationGeometry.length >= 2 && (
					<div data-vaul-no-drag style={{ marginTop: 18 }}>
						<SecTitle style={{ marginBottom: 8 }}>{t("route.elevation")}</SecTitle>
						<RouteProfileChart
							profile={computedProfile}
							breakdown={surfaceBreakdown}
							elevationLoading={elevationLoading}
							surfaceLoading={surfaceLoading}
							gradientId={`rds-elev-${route.id}`}
							style={{ marginTop: 0 }}
						/>
					</div>
				)}

				<div style={{ marginTop: 18 }}>
					<SecTitle style={{ marginBottom: 10 }}>{t("route.properties")}</SecTitle>
					<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
						<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
							<span style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, minWidth: 64 }}>
								{t("route.field.activity")}
							</span>
							<SegmentedSelector<RouteActivity>
								value={route.activity}
								options={ROUTE_ACTIVITIES.map((a) => ({
									value: a,
									label: t(ACTIVITY_LABEL[a].labelKey),
									icon: ACTIVITY_LABEL[a].icon,
								}))}
								onChange={(next) => mutateMeta({ activity: next })}
								disabled={updateRoute.isPending}
							/>
						</div>
						<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
							<span style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, minWidth: 64 }}>
								{t("route.field.visibility")}
							</span>
							<SegmentedSelector<RouteVisibility>
								value={route.visibility}
								options={ROUTE_VISIBILITIES.map((v) => ({
									value: v,
									label: t(VISIBILITY_LABEL[v].labelKey),
									icon: VISIBILITY_LABEL[v].icon,
								}))}
								onChange={onVisibilityChange}
								disabled={updateRoute.isPending}
							/>
						</div>
						<div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 10 }}>
							<span style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, minWidth: 64, paddingTop: 4 }}>
								{t("route.field.tags")}
							</span>
							<TagEditor tags={tags} disabled={updateRoute.isPending} onChange={(next) => mutateMeta({ tags: next })} />
						</div>
					</div>
				</div>
				{pendingPublicVisibility && (
					<div
						role="alertdialog"
						aria-modal="true"
						style={{
							marginTop: 12,
							padding: 12,
							border: `1px solid ${RDS_COLORS.warn}`,
							borderRadius: 10,
							background: `color-mix(in oklch, ${RDS_COLORS.warn} 10%, transparent)`,
						}}
					>
						<div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t("route.makePublic.title")}</div>
						<div style={{ fontSize: 12, color: RDS_COLORS.fgMuted, marginBottom: 10, lineHeight: 1.45 }}>
							{t("route.makePublic.body")}
						</div>
						<div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
							<Btn variant="ghost" onClick={() => setPendingPublicVisibility(false)}>
								{t("common.cancel")}
							</Btn>
							<Btn variant="primary" onClick={confirmPublic}>
								{t("route.makePublic.confirm")}
							</Btn>
						</div>
					</div>
				)}

				{route.provenance === "mapbox-legacy" && (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							padding: "8px 10px",
							marginTop: 12,
							borderRadius: 8,
							background: RDS_COLORS.bgInput,
							border: `1px solid ${RDS_COLORS.border}`,
							color: RDS_COLORS.fgMuted,
							fontSize: 11.5,
						}}
					>
						<I.flag size={12} />
						<span>{t("route.provenance.mapboxLegacy")}</span>
					</div>
				)}

				{route.description && (
					<p style={{ fontSize: 13, color: RDS_COLORS.fgMuted, margin: "12px 0 0", lineHeight: 1.5 }}>
						{route.description}
					</p>
				)}

				{route.waypoints && route.waypoints.length > 0 && (
					<div style={{ marginTop: 18 }}>
						<SecTitle style={{ marginBottom: 10 }}>
							{t("route.waypointsCount", { count: String(route.waypoints.length) })}
						</SecTitle>
						<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
							{route.waypoints.map((w, i) => {
								const isStart = i === 0;
								const isEnd = i === route.waypoints.length - 1;
								const isDirect = w.type === "direct";
								const dot = isDirect
									? RDS_COLORS.warn
									: isStart
										? RDS_COLORS.success
										: isEnd
											? RDS_COLORS.danger
											: RDS_COLORS.accent;
								const label = isStart
									? t("common.start")
									: isEnd
										? t("common.end")
										: t("common.waypoint", { n: String(i) });
								const [lng, lat] = w.coord;
								const coordStr = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
								return (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: same coord can repeat; combine with index for stable key
										key={`${lng}-${lat}-${i}`}
										style={{
											display: "flex",
											alignItems: "center",
											gap: 12,
											padding: "6px 10px",
											borderRadius: 8,
										}}
									>
										<div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16 }}>
											<div
												style={{
													width: 10,
													height: 10,
													borderRadius: 999,
													background: dot,
													border: `2px solid ${RDS_COLORS.bgPanel}`,
													boxShadow: `0 0 0 1.5px ${dot}`,
												}}
											/>
											{!isEnd && (
												<div
													style={{
														width: 1.5,
														flex: 1,
														minHeight: 12,
														background: RDS_COLORS.borderStrong,
														marginTop: 2,
													}}
												/>
											)}
										</div>
										<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
											<div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
												<EditableLabel
													value={w.name}
													placeholder={label}
													onSave={(next) => renameWaypoint(i, next)}
													disabled={updateRoute.isPending}
													style={{ fontSize: 13, fontWeight: 500 }}
												/>
												{w.type === "direct" && (
													<span
														style={{
															fontSize: 10.5,
															color: RDS_COLORS.fgSubtle,
															fontWeight: 400,
														}}
													>
														{t("route.direct")}
													</span>
												)}
											</div>
											<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>
												{coordStr}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}

				{(route.startAddress || route.endAddress) && (
					<div style={{ marginTop: 18 }}>
						<SecTitle style={{ marginBottom: 8 }}>{t("route.routeLabel")}</SecTitle>
						<div
							style={{
								background: RDS_COLORS.bgPanel,
								border: `1px solid ${RDS_COLORS.border}`,
								borderRadius: 10,
								overflow: "hidden",
							}}
						>
							{route.startAddress && (
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: 10,
										padding: "10px 14px",
										borderBottom: route.endAddress ? `1px solid ${RDS_COLORS.border}` : "none",
									}}
								>
									<I.pin size={14} style={{ color: RDS_COLORS.fgSubtle }} />
									<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
										<div style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>{t("common.start")}</div>
										<div style={{ fontSize: 13, color: RDS_COLORS.fg, overflow: "hidden", textOverflow: "ellipsis" }}>
											{route.startAddress}
										</div>
									</div>
								</div>
							)}
							{route.endAddress && (
								<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
									<I.flag size={14} style={{ color: RDS_COLORS.fgSubtle }} />
									<div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
										<div style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>{t("common.end")}</div>
										<div style={{ fontSize: 13, color: RDS_COLORS.fg, overflow: "hidden", textOverflow: "ellipsis" }}>
											{route.endAddress}
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			<div
				style={{
					display: "flex",
					gap: 8,
					padding: "12px 20px",
					borderTop: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<Btn variant="primary" style={{ flex: 1 }} onClick={dispatchLoadRoute}>
					<I.route size={13} /> {t("route.editRoute")}
				</Btn>
				{/* Two share actions with different meanings: label both so they
				    are tellable apart without hovering. */}
				<Btn onClick={dispatchShare} title={t("route.share")}>
					<I.share size={14} /> {t("route.shareLinkShort")}
				</Btn>
				<Btn onClick={() => setShareToUserOpen(true)} title={t("social.share.title")}>
					<I.mail size={14} /> {t("social.share.sendShort")}
				</Btn>
				<Btn onClick={dispatchExport} title={t("route.downloadGpx")}>
					<I.download size={14} />
				</Btn>
				<Btn
					onClick={dispatchDelete}
					title={t("route.delete")}
					style={{ color: RDS_COLORS.danger, borderColor: RDS_COLORS.danger }}
				>
					<I.trash size={14} />
				</Btn>
			</div>
			{shareToUserOpen && <ShareRouteDialog route={route} onClose={() => setShareToUserOpen(false)} />}
		</div>
	);
}
