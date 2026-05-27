import { calculatePathDistance } from "@routess/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { applySavedRoute } from "@/features/routing/applySavedRoute";
import { isDraftDirty } from "@/features/routing/draftDirty";
import { useSurfaceBreakdown } from "@/features/routing/services/useSurfaceBreakdown";
import { useViewport } from "@/hooks/useViewport";
import { useSaveRoute, useUpdateRoute } from "@/lib/api-queries";
import { emitAppEvent, onAppEvent } from "@/lib/app-events";
import { useT } from "@/lib/i18n";
import { formatSpeedParts, useUnits } from "@/lib/units";
import { useModalsStore } from "@/stores/modalsStore";
import { getSpeedForActivity, useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import {
	useClearWaypoints,
	useDistanceMeters,
	useDraftActivity,
	useDraftMode,
	useDraftRoutingPreferences,
	useDurationSeconds,
	useElevationGain,
	useElevationProfile,
	useHasRoute,
	useIsComputingElevation,
	useRemoveWaypoint,
	useRouteDistance,
	useRouteDuration,
	useRoutePath,
	useSaveSnapshot,
	useSetActivity,
	useSetEditingName,
	useSetMode,
	useSetWaypointName,
	useSetWaypoints,
	useWaypoints,
} from "@/stores/routingStore";
import { useToastStore } from "@/stores/toastStore";
import { type RedesignActivity, useUiStore } from "@/stores/uiStore";
import { useWaypointHoverStore } from "@/stores/waypointHoverStore";
import { EditableLabel } from "../components/EditableLabel";
import { I } from "../components/icons";
import { Btn, IconBtn, Kbd, RDS_COLORS, SecTitle } from "../components/primitives";
import { RouteProfileChart } from "../components/RouteProfileChart";
import { SurfaceMismatchBadge } from "../components/SurfaceMismatchBadge";

// Parses durations produced by @routess/core formatDuration: "X min", "X h", or "X.X h"
// (with optional " (estimated)" / " (offline)" suffix). Returns minutes or null.
function parseDurationToMinutes(s: string): number | null {
	if (!s) return null;
	const cleaned = s.replace(/\s*\([^)]+\)\s*/g, "").trim();
	const m = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*(min|h)$/i);
	if (!m) return null;
	const value = Number.parseFloat(m[1]);
	if (!Number.isFinite(value)) return null;
	return m[2].toLowerCase() === "h" ? value * 60 : value;
}

const ACTIVITIES: { key: RedesignActivity; icon: React.ComponentType<{ size?: number }>; labelKey: string }[] = [
	{ key: "run", icon: I.run, labelKey: "sport.short.run" },
	{ key: "cycle", icon: I.bike, labelKey: "sport.short.cycle" },
	{ key: "walk", icon: I.walk, labelKey: "sport.short.walk" },
];

function PlanRouteProfileChart() {
	const profile = useElevationProfile();
	const isComputing = useIsComputingElevation();
	const hasRoute = useHasRoute();
	const { breakdown, loading: surfaceLoading } = useSurfaceBreakdown();
	const draftPrefs = useDraftRoutingPreferences();
	return (
		<div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
			<SurfaceMismatchBadge breakdown={breakdown} preference={draftPrefs?.surfacePreference ?? null} />
			<RouteProfileChart
				profile={profile}
				breakdown={breakdown}
				elevationLoading={hasRoute && isComputing}
				surfaceLoading={surfaceLoading}
			/>
		</div>
	);
}

export function PlanPanel() {
	const t = useT();
	const { isMobile } = useViewport();
	const waypoints = useWaypoints();
	const routePath = useRoutePath();
	const distance = useRouteDistance();
	const duration = useRouteDuration();
	const hasRoute = useHasRoute();
	const clearWaypoints = useClearWaypoints();
	const removeWaypoint = useRemoveWaypoint();
	const setWaypoints = useSetWaypoints();
	const setWaypointName = useSetWaypointName();
	const saveSnapshot = useSaveSnapshot();
	const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
	const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
	const hoveredWaypointIndex = useWaypointHoverStore((s) => s.hoveredWaypointIndex);
	const setWaypointHover = useWaypointHoverStore((s) => s.setHover);
	const clearWaypointHover = useWaypointHoverStore((s) => s.clearHover);

	const handleRemoveWaypoint = (index: number) => {
		saveSnapshot();
		removeWaypoint(index);
		emitAppEvent("routess:recalculate-route");
	};

	const handleReorderWaypoints = (next: typeof waypoints) => {
		saveSnapshot();
		setWaypoints(next);
		emitAppEvent("routess:recalculate-route");
	};

	const mode = useDraftMode();
	const draftActivity = useDraftActivity();
	const setEditingName = useSetEditingName();
	const setMode = useSetMode();
	const setActivity = useSetActivity();
	const globalActivity = useUiStore((s) => s.activityType);
	const setGlobalActivity = useUiStore((s) => s.setActivityType);
	const activityType: RedesignActivity = draftActivity ?? globalActivity;
	const openModal = useModalsStore((s) => s.openModal);
	const pushToast = useToastStore((s) => s.push);
	const distanceMeters = useDistanceMeters();
	const durationSeconds = useDurationSeconds();
	const elevationGain = useElevationGain();
	const draftRoutingPreferences = useDraftRoutingPreferences();
	const isComputingElevation = useIsComputingElevation();
	const { formatElevationParts, units } = useUnits();
	const saveRoute = useSaveRoute();
	const updateRoute = useUpdateRoute();

	const isDirty = useMemo(
		() => isDraftDirty({ mode, activity: draftActivity, waypoints }),
		[mode, draftActivity, waypoints],
	);

	const editingName = mode.kind === "editing" ? mode.name : null;
	const editingRouteId = mode.kind === "editing" ? mode.routeId : null;
	const editingBaseline = mode.kind === "editing" ? mode.baseline : null;

	const handleClear = () => {
		clearWaypoints();
	};

	const handleUnload = () => {
		setMode({ kind: "unsaved" });
	};

	const handleActivityChange = (activity: RedesignActivity) => {
		if (activity === activityType) return;
		// Always update the per-draft activity. Only mirror the change to the
		// global default when this is a fresh draft; for an editing draft, the
		// activity is a per-route choice that should not bleed into the
		// user's global preference.
		setActivity(activity);
		if (mode.kind === "unsaved") setGlobalActivity(activity);
		if (hasRoute) emitAppEvent("routess:recalculate-route");
	};

	const handleSaveClick = () => {
		if (mode.kind === "unsaved") {
			openModal("save");
			return;
		}
		if (!editingRouteId || !editingBaseline) return;
		if (!isDirty || waypoints.length < 2 || updateRoute.isPending) return;
		updateRoute.mutate(
			{
				routeId: editingRouteId,
				updates: {
					name: editingName ?? editingBaseline.name,
					activity: draftActivity ?? editingBaseline.activity,
					visibility: editingBaseline.visibility,
					tags: editingBaseline.tags,
					waypoints,
					distance: distanceMeters ?? 0,
					duration: durationSeconds ?? undefined,
					elevationGain: elevationGain != null ? Math.round(elevationGain) : 0,
					...(draftRoutingPreferences ? { routingPreferences: draftRoutingPreferences } : {}),
				},
			},
			{
				onSuccess: (updated) => {
					applySavedRoute(updated);
					pushToast({
						kind: "success",
						title: t("save.toast.updated"),
						body: `${updated.name} · ${distance || "—"}`,
					});
				},
				onError: () => {
					pushToast({
						kind: "danger",
						title: t("save.toast.updateFailed"),
						body: t("common.tryAgain"),
					});
				},
			},
		);
	};

	const handleDuplicate = () => {
		if (mode.kind !== "editing" || !editingBaseline || waypoints.length < 2) return;
		const baseName = (editingName ?? editingBaseline.name) || t("save.title");
		saveRoute.mutate(
			{
				name: `${baseName} (copy)`,
				description: editingBaseline.description,
				activity: draftActivity ?? editingBaseline.activity,
				visibility: editingBaseline.visibility,
				tags: editingBaseline.tags,
				waypoints,
				distance: distanceMeters ?? 0,
				duration: durationSeconds ?? undefined,
				elevationGain: elevationGain != null ? Math.round(elevationGain) : 0,
				...(draftRoutingPreferences ? { routingPreferences: draftRoutingPreferences } : {}),
			},
			{
				onSuccess: (newRoute) => {
					pushToast({
						kind: "success",
						title: t("route.duplicated"),
						body: newRoute.name,
					});
					applySavedRoute(newRoute);
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

	const elevParts = elevationGain != null ? formatElevationParts(elevationGain) : null;
	const elevationVal = (() => {
		if (elevParts) return elevParts.value;
		if (hasRoute && isComputingElevation) return "…";
		return "—";
	})();
	const elevationUnit = elevParts ? elevParts.unit : units === "mi" ? "ft" : "m";

	const sportSpeeds = useRedesignSettingsStore((s) => s.sportSpeeds);
	const selectedSports = useRedesignSettingsStore((s) => s.selectedSports);

	const availableActivities = useMemo(
		() => (selectedSports.length > 0 ? ACTIVITIES.filter((a) => selectedSports.includes(a.key)) : ACTIVITIES),
		[selectedSports],
	);

	// If the active sport gets removed in Settings, snap to a still-selected one
	// so we never route or estimate against a sport the user has hidden.
	// handleActivityChange closes over mode/editor/hasRoute so it changes
	// every render; only the sport-list change is the actual trigger here.
	// biome-ignore lint/correctness/useExhaustiveDependencies: handler stable for our purposes
	useEffect(() => {
		if (selectedSports.length === 0) return;
		if (!selectedSports.includes(activityType)) {
			handleActivityChange(selectedSports[0]);
		}
	}, [selectedSports, activityType]);

	// External Save triggers (command palette, future menu items) fire this
	// event so the same Save semantics live here. handleSaveClick reads a lot
	// of state, so route through a ref instead of re-binding the listener.
	const handleSaveClickRef = useRef(handleSaveClick);
	handleSaveClickRef.current = handleSaveClick;
	useEffect(() => onAppEvent("routess:save-draft", () => handleSaveClickRef.current()), []);

	const paceParts = useMemo(() => {
		if (hasRoute && routePath.length >= 2) {
			const distanceKm = calculatePathDistance(routePath);
			const durationMinutes = parseDurationToMinutes(duration);
			if (distanceKm > 0 && durationMinutes && durationMinutes > 0) {
				return formatSpeedParts((distanceKm / durationMinutes) * 60, units);
			}
		}
		const configured = getSpeedForActivity(activityType, sportSpeeds);
		return configured > 0 ? formatSpeedParts(configured, units) : null;
	}, [hasRoute, routePath, duration, units, sportSpeeds, activityType]);

	const stats = [
		{
			label: t("plan.distance"),
			val: distance ? distance.split(" ")[0] : "—",
			unit: distance ? distance.split(" ")[1] || "km" : units === "mi" ? "mi" : "km",
		},
		{ label: t("plan.time"), val: duration || "—", unit: "" },
		{ label: t("plan.elev"), val: elevationVal, unit: elevationUnit },
		{
			label: t("plan.pace"),
			val: paceParts?.value ?? "—",
			unit: paceParts?.unit ?? (units === "mi" ? "mph" : "km/h"),
		},
	];

	const startWp = waypoints[0];
	const endWp = waypoints[waypoints.length - 1];

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				height: "100%",
				paddingBottom: "var(--rds-bottom-tab-h)",
			}}
		>
			{mode.kind === "editing" && (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						padding: "14px 20px 10px",
						borderBottom: `1px solid ${RDS_COLORS.border}`,
					}}
				>
					<div style={{ flex: 1, minWidth: 0 }}>
						<EditableLabel
							value={mode.name}
							placeholder={t("plan.routeName")}
							onSave={(next) => {
								if (next) setEditingName(next);
							}}
							ariaLabel={t("plan.routeName")}
							style={{
								fontSize: 16,
								fontWeight: 600,
								letterSpacing: -0.2,
								width: "100%",
							}}
						/>
					</div>
					<IconBtn title={t("plan.unloadRoute")} onClick={handleUnload}>
						<I.close size={14} />
					</IconBtn>
				</div>
			)}
			{/* Activity tabs + start/end */}
			<div
				style={{
					padding: "16px 20px 12px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
					{availableActivities.map((a) => {
						const Icon = a.icon;
						const on = activityType === a.key;
						return (
							<button
								key={a.key}
								type="button"
								onClick={() => handleActivityChange(a.key)}
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 6,
									height: 32,
									padding: "0 12px",
									borderRadius: 999,
									border: `1px solid ${on ? RDS_COLORS.accent : RDS_COLORS.border}`,
									background: on ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
									color: on ? RDS_COLORS.accent : RDS_COLORS.fgMuted,
									fontSize: 12.5,
									fontWeight: 500,
									cursor: "pointer",
								}}
							>
								<Icon size={14} /> {t(a.labelKey)}
							</button>
						);
					})}
					<div style={{ flex: 1 }} />
					<IconBtn title={t("plan.routingPrefs")} onClick={() => openModal("routing")}>
						<I.sliders size={16} />
					</IconBtn>
					<IconBtn title={t("plan.generateLoop")} onClick={() => openModal("loop")}>
						<I.compass size={16} />
					</IconBtn>
				</div>

				{!isMobile && (
					<>
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
							<EndpointInput
								dotColor={RDS_COLORS.success}
								label={startWp ? formatCoord(startWp.coord) : t("plan.addStart")}
							/>
							<EndpointInput
								dotColor={RDS_COLORS.danger}
								label={endWp && waypoints.length > 1 ? formatCoord(endWp.coord) : t("plan.addEnd")}
							/>
						</div>

						<button
							type="button"
							onClick={() => openModal("search")}
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 8,
								marginTop: 8,
								height: 32,
								padding: "0 10px",
								borderRadius: 8,
								border: `1px dashed ${RDS_COLORS.borderStrong}`,
								background: "transparent",
								color: RDS_COLORS.fgMuted,
								fontSize: 12.5,
								width: "100%",
								cursor: "pointer",
							}}
						>
							<I.plus size={14} /> {t("plan.addWaypoint")}
							<span style={{ flex: 1 }} />
							<Kbd>⌘</Kbd>
							<Kbd>K</Kbd>
						</button>
					</>
				)}
			</div>

			{/* Elevation + surface */}
			<div data-vaul-no-drag style={{ padding: "0 20px 14px", borderBottom: `1px solid ${RDS_COLORS.border}` }}>
				<PlanRouteProfileChart />
			</div>

			{/* Stats */}
			<div style={{ padding: "14px 20px", borderBottom: `1px solid ${RDS_COLORS.border}` }}>
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(72px, 1fr))", gap: 8 }}>
					{stats.map((s) => (
						<div key={s.label} style={{ minWidth: 0 }}>
							<SecTitle>{s.label}</SecTitle>
							<div
								className="rds-mono"
								style={{
									fontSize: 20,
									fontWeight: 600,
									color: RDS_COLORS.fg,
									marginTop: 4,
									lineHeight: 1,
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								{s.val}
								{s.unit && <span style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginLeft: 3 }}>{s.unit}</span>}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Waypoints list */}
			<div style={{ padding: "14px 20px", overflow: "auto", flex: 1 }}>
				<SecTitle style={{ marginBottom: 10 }}>
					{t("plan.waypointsCount", { count: String(waypoints.length) })}
				</SecTitle>
				{waypoints.length === 0 ? (
					<div
						style={{
							padding: "24px 12px",
							textAlign: "center",
							fontSize: 13,
							color: RDS_COLORS.fgSubtle,
							lineHeight: 1.55,
						}}
					>
						{t("plan.tapMapToAdd")} <Kbd>⌘</Kbd>
						<Kbd>K</Kbd>.
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
						{waypoints.map((w, i) => {
							const isStart = i === 0;
							const isEnd = i === waypoints.length - 1;
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
							const isDragging = draggingIdx === i;
							const isDragTarget = dragOverIdx === i && draggingIdx !== null && draggingIdx !== i;
							const isHovered = hoveredWaypointIndex === i;
							const rowBackground = isDragTarget ? RDS_COLORS.bgHover : isHovered ? RDS_COLORS.bgHover : "transparent";
							return (
								// biome-ignore lint/a11y/noStaticElementInteractions: drag-drop row is a non-interactive container; the grip button inside is the keyboard-actionable control
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: waypoints can repeat coords; combine coord with index for stable key
									key={`${w.coord[0]}-${w.coord[1]}-${i}`}
									onMouseEnter={() => setWaypointHover(i)}
									onMouseLeave={() => {
										if (hoveredWaypointIndex === i) clearWaypointHover();
									}}
									onDragOver={(e) => {
										if (draggingIdx === null) return;
										e.preventDefault();
										if (dragOverIdx !== i) setDragOverIdx(i);
									}}
									onDragLeave={() => {
										if (dragOverIdx === i) setDragOverIdx(null);
									}}
									onDrop={(e) => {
										if (draggingIdx === null || draggingIdx === i) return;
										e.preventDefault();
										const next = waypoints.slice();
										const [moved] = next.splice(draggingIdx, 1);
										next.splice(i, 0, moved);
										handleReorderWaypoints(next);
										setDraggingIdx(null);
										setDragOverIdx(null);
									}}
									style={{
										display: "flex",
										alignItems: "center",
										gap: 12,
										padding: "8px 10px",
										borderRadius: 8,
										opacity: isDragging ? 0.4 : 1,
										background: rowBackground,
										transition: "background 180ms ease-out",
									}}
								>
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											alignItems: "center",
											width: 16,
										}}
									>
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
										<EditableLabel
											value={w.name}
											placeholder={label}
											onSave={(next) => setWaypointName(i, next)}
											style={{ fontSize: 13, fontWeight: 500 }}
										/>
										<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>
											{formatCoord(w.coord)}
										</div>
									</div>
									<div style={{ display: "flex", alignItems: "center", gap: 2 }}>
										<IconBtn
											title={t("plan.dragToReorder")}
											draggable
											onDragStart={(e) => {
												e.dataTransfer.effectAllowed = "move";
												setDraggingIdx(i);
											}}
											onDragEnd={() => {
												setDraggingIdx(null);
												setDragOverIdx(null);
											}}
											style={{ cursor: draggingIdx === i ? "grabbing" : "grab", color: RDS_COLORS.fgSubtle }}
										>
											<I.grip size={14} />
										</IconBtn>
										<IconBtn
											title={t("plan.removeWaypoint")}
											onClick={() => handleRemoveWaypoint(i)}
											style={{ color: RDS_COLORS.fgSubtle }}
										>
											<I.trash size={14} />
										</IconBtn>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Footer */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 6,
					padding: "12px 16px",
					borderTop: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<Btn
					variant="primary"
					style={{ flex: 1, minWidth: 0, padding: "0 10px" }}
					disabled={mode.kind === "editing" ? !isDirty || waypoints.length < 2 || updateRoute.isPending : !hasRoute}
					onClick={handleSaveClick}
				>
					<I.save size={14} /> {mode.kind === "editing" && updateRoute.isPending ? t("save.saving") : t("common.save")}
				</Btn>
				{mode.kind === "editing" && (
					<Btn
						title={t("plan.duplicate")}
						disabled={!hasRoute || saveRoute.isPending}
						onClick={handleDuplicate}
						style={{ padding: "0 10px" }}
					>
						<I.copy size={14} />
					</Btn>
				)}
				<Btn
					title={t("plan.shareRoute")}
					disabled={!hasRoute}
					onClick={() => openModal("share")}
					style={{ padding: "0 10px" }}
				>
					<I.share size={14} />
				</Btn>
				<Btn
					title={t("plan.importGpx")}
					disabled={routePath.length === 0 && waypoints.length === 0}
					onClick={() => openModal("import")}
					style={{ padding: "0 10px" }}
				>
					<I.download size={14} />
				</Btn>
				<Btn
					title={t("plan.clear")}
					variant="ghost"
					onClick={handleClear}
					disabled={waypoints.length === 0}
					style={{ padding: "0 10px" }}
				>
					<I.trash size={14} />
				</Btn>
			</div>
		</div>
	);
}

function EndpointInput({ dotColor, label }: { dotColor: string; label: string }) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				background: RDS_COLORS.bgInput,
				border: `1px solid ${RDS_COLORS.border}`,
				borderRadius: 8,
				height: 36,
				padding: "0 10px",
				minWidth: 0,
			}}
		>
			<div style={{ width: 8, height: 8, borderRadius: 999, background: dotColor, flexShrink: 0 }} />
			<span
				style={{
					fontSize: 13,
					color: RDS_COLORS.fg,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{label}
			</span>
		</div>
	);
}

function formatCoord(c: [number, number]) {
	return `${c[1].toFixed(4)}, ${c[0].toFixed(4)}`;
}
