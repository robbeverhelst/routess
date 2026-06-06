import { calculatePathDistance, haversineDistance } from "@routess/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { applySavedRoute } from "@/features/routing/applySavedRoute";
import { isDraftDirty } from "@/features/routing/draftDirty";
import { useSurfaceBreakdown } from "@/features/routing/services/useSurfaceBreakdown";
import { useViewport } from "@/hooks/useViewport";
import { useSaveRoute, useUpdateRoute } from "@/lib/api-queries";
import { emitAppEvent, onAppEvent } from "@/lib/app-events";
import { useT } from "@/lib/i18n";
import { usePlaceName } from "@/lib/reverseGeocode";
import { formatDurationClockParts, formatPaceParts, formatSpeedParts, useUnits } from "@/lib/units";
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
import { Tooltip } from "../components/Tooltip";

// Start and end this close together (km) read as a loop, not two endpoints.
const LOOP_THRESHOLD_KM = 0.08;

const ACTIVITIES: {
	key: RedesignActivity;
	icon: React.ComponentType<{ size?: number }>;
	labelKey: string;
	titleKey: string;
}[] = [
	{ key: "run", icon: I.run, labelKey: "sport.short.run", titleKey: "sport.run" },
	{ key: "cycle", icon: I.bike, labelKey: "sport.short.cycle", titleKey: "sport.cycle" },
	{ key: "walk", icon: I.walk, labelKey: "sport.short.walk", titleKey: "sport.walk" },
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

	// Reorder via pointer events on the grip so it works for mouse and touch
	// alike (HTML5 drag-and-drop never fires on mobile browsers). The grip has
	// touch-action: none, so grabbing it drags the row while the rest of the
	// row still scrolls the list normally.
	const handleGripPointerDown = (index: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
		e.preventDefault();
		e.currentTarget.setPointerCapture(e.pointerId);
		setDraggingIdx(index);
	};

	const handleGripPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
		if (draggingIdx === null) return;
		const row = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-waypoint-row]");
		const target = row instanceof HTMLElement ? Number(row.dataset.waypointRow) : Number.NaN;
		setDragOverIdx(Number.isInteger(target) ? target : null);
	};

	const handleGripPointerEnd = (e: React.PointerEvent<HTMLButtonElement>) => {
		if (draggingIdx === null) return;
		if (e.currentTarget.hasPointerCapture(e.pointerId)) {
			e.currentTarget.releasePointerCapture(e.pointerId);
		}
		if (dragOverIdx !== null && dragOverIdx !== draggingIdx) {
			const next = waypoints.slice();
			const [moved] = next.splice(draggingIdx, 1);
			next.splice(dragOverIdx, 0, moved);
			handleReorderWaypoints(next);
		}
		setDraggingIdx(null);
		setDragOverIdx(null);
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
	const openSearch = useModalsStore((s) => s.openSearch);
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
					...(routePath.length >= 2 ? { geometry: routePath } : {}),
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
				...(routePath.length >= 2 ? { geometry: routePath } : {}),
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

	const speedKmh = useMemo(() => {
		if (hasRoute && routePath.length >= 2 && durationSeconds && durationSeconds > 0) {
			const distanceKm = calculatePathDistance(routePath);
			if (distanceKm > 0) return distanceKm / (durationSeconds / 3600);
		}
		const configured = getSpeedForActivity(activityType, sportSpeeds);
		return configured > 0 ? configured : null;
	}, [hasRoute, routePath, durationSeconds, sportSpeeds, activityType]);

	// Cyclists think in speed; runners and walkers think in pace.
	const tempoStat = (() => {
		if (activityType === "cycle") {
			const parts = speedKmh != null ? formatSpeedParts(speedKmh, units) : null;
			return {
				label: t("plan.speed"),
				val: parts?.value ?? "—",
				unit: parts?.unit ?? (units === "mi" ? "mph" : "km/h"),
			};
		}
		const parts = speedKmh != null ? formatPaceParts(speedKmh, units) : null;
		return {
			label: t("plan.pace"),
			val: parts?.value ?? "—",
			unit: parts?.unit ?? (units === "mi" ? "/mi" : "/km"),
		};
	})();

	const timeParts = durationSeconds != null ? formatDurationClockParts(durationSeconds) : null;

	const stats = [
		{
			label: t("plan.distance"),
			val: distance ? distance.split(" ")[0] : "—",
			unit: distance ? distance.split(" ")[1] || "km" : units === "mi" ? "mi" : "km",
		},
		{ label: t("plan.time"), val: timeParts?.value ?? "—", unit: timeParts?.unit ?? "" },
		{ label: t("plan.elev"), val: elevationVal, unit: elevationUnit },
		tempoStat,
	];

	const startWp = waypoints[0];
	const endWp = waypoints[waypoints.length - 1];
	const hasEnd = endWp != null && waypoints.length > 1;
	const isLoop =
		waypoints.length > 2 &&
		startWp != null &&
		endWp != null &&
		haversineDistance(startWp.coord, endWp.coord) < LOOP_THRESHOLD_KM;
	const startName = usePlaceName(startWp ? startWp.coord : null);
	const endName = usePlaceName(hasEnd ? endWp.coord : null);
	const startLabel = startWp ? (startWp.name ?? startName ?? formatCoord(startWp.coord)) : t("plan.addStart");
	const endLabel = hasEnd ? (endWp.name ?? endName ?? formatCoord(endWp.coord)) : t("plan.addEnd");

	const handleReverse = () => {
		if (waypoints.length < 2) return;
		saveSnapshot();
		setWaypoints(waypoints.slice().reverse());
		emitAppEvent("routess:recalculate-route");
	};

	// Close the loop manually: route from the current end back to the start.
	const handleBackToStart = () => {
		if (!startWp || waypoints.length < 2 || isLoop) return;
		saveSnapshot();
		setWaypoints([...waypoints, { coord: [startWp.coord[0], startWp.coord[1]], type: "routed" }]);
		emitAppEvent("routess:recalculate-route");
	};

	// Distance from the start to each waypoint, measured along the computed
	// route (waypoints are ordered, so the scan start advances monotonically).
	const waypointDistancesKm = useMemo(() => {
		if (routePath.length < 2 || waypoints.length === 0) return null;
		const cum = new Array<number>(routePath.length);
		cum[0] = 0;
		for (let i = 1; i < routePath.length; i++) {
			cum[i] = cum[i - 1] + haversineDistance(routePath[i - 1], routePath[i]);
		}
		let from = 0;
		return waypoints.map((w) => {
			let best = Number.POSITIVE_INFINITY;
			let bestIdx = from;
			for (let i = from; i < routePath.length; i++) {
				const d = haversineDistance(w.coord, routePath[i]);
				if (d < best) {
					best = d;
					bestIdx = i;
				}
			}
			from = bestIdx;
			return cum[bestIdx];
		});
	}, [waypoints, routePath]);

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 2,
							padding: 2,
							flex: 1,
							minWidth: 0,
							borderRadius: 999,
							border: `1px solid ${RDS_COLORS.border}`,
							background: RDS_COLORS.bgInput,
						}}
					>
						{availableActivities.map((a) => {
							const Icon = a.icon;
							const on = activityType === a.key;
							return (
								<Tooltip key={a.key} label={t(a.titleKey)}>
									<button
										type="button"
										aria-pressed={on}
										onClick={() => handleActivityChange(a.key)}
										style={{
											display: "inline-flex",
											alignItems: "center",
											justifyContent: "center",
											gap: 6,
											flex: 1,
											height: 28,
											padding: "0 8px",
											borderRadius: 999,
											border: 0,
											background: on ? RDS_COLORS.bgPanel : "transparent",
											boxShadow: on ? "0 1px 2px rgba(15, 23, 42, 0.12)" : "none",
											color: on ? RDS_COLORS.accent : RDS_COLORS.fgMuted,
											fontSize: 12.5,
											fontWeight: on ? 600 : 500,
											cursor: "pointer",
											transition: "background 120ms, color 120ms",
										}}
									>
										<Icon size={14} /> {t(a.labelKey)}
									</button>
								</Tooltip>
							);
						})}
					</div>
					<FeatureBtn
						icon={<I.sliders size={14} />}
						label={t("plan.options")}
						title={t("plan.routingPrefs")}
						onClick={() => openModal("routing")}
					/>
				</div>

				{!isMobile &&
					(isLoop && startWp ? (
						<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
							<EndpointButton
								dotColor={RDS_COLORS.success}
								label={t("plan.loopFrom", { name: startLabel })}
								title={t("plan.moveLoop")}
								onClick={() => openSearch("replace-loop")}
							/>
							<IconBtn
								title={t("plan.reverseRoute")}
								onClick={handleReverse}
								style={{ width: 28, height: 28, flexShrink: 0 }}
							>
								<I.swapVert size={15} />
							</IconBtn>
						</div>
					) : (
						<>
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
									<EndpointButton
										dotColor={RDS_COLORS.success}
										label={startLabel}
										muted={!startWp}
										title={startWp ? t("plan.changeStart") : t("plan.addStart")}
										onClick={() => openSearch("replace-start")}
									/>
									<EndpointButton
										dotColor={RDS_COLORS.danger}
										label={endLabel}
										muted={!hasEnd}
										title={hasEnd ? t("plan.changeEnd") : t("plan.addEnd")}
										onClick={() => openSearch("replace-end")}
									/>
								</div>
								<IconBtn
									title={t("plan.reverseRoute")}
									onClick={handleReverse}
									disabled={waypoints.length < 2}
									style={{ width: 28, height: 28, flexShrink: 0 }}
								>
									<I.swapVert size={15} />
								</IconBtn>
							</div>
							{waypoints.length >= 2 && (
								<button
									type="button"
									onClick={handleBackToStart}
									style={{
										display: "inline-flex",
										alignItems: "center",
										justifyContent: "center",
										gap: 6,
										marginTop: 6,
										height: 28,
										padding: "0 10px",
										borderRadius: 8,
										border: `1px dashed ${RDS_COLORS.borderStrong}`,
										background: "transparent",
										color: RDS_COLORS.fgMuted,
										fontSize: 12,
										width: "100%",
										cursor: "pointer",
									}}
								>
									<I.cornerDownLeft size={13} /> {t("plan.backToStart")}
								</button>
							)}
						</>
					))}
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

			{/* Elevation + surface */}
			<div data-vaul-no-drag style={{ padding: "0 20px 14px", borderBottom: `1px solid ${RDS_COLORS.border}` }}>
				<PlanRouteProfileChart />
			</div>

			{/* Waypoints list */}
			<div style={{ padding: "14px 20px", overflow: "auto", flex: 1, minHeight: 0 }}>
				<SecTitle style={{ marginBottom: 10 }}>
					{t("plan.waypointsCount", { count: String(waypoints.length) })}
				</SecTitle>
				{waypoints.length === 0 ? (
					<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: 10,
								padding: "22px 16px",
								borderRadius: 12,
								border: `1px solid ${RDS_COLORS.border}`,
								background: RDS_COLORS.bgInput,
								textAlign: "center",
							}}
						>
							<div
								style={{
									width: 34,
									height: 34,
									borderRadius: 999,
									background: RDS_COLORS.accentSoft,
									color: RDS_COLORS.accent,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<I.refresh size={16} />
							</div>
							<div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
								<div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("plan.loopHeroTitle")}</div>
								<div style={{ fontSize: 12, color: RDS_COLORS.fgMuted, lineHeight: 1.5 }}>{t("plan.loopHeroBody")}</div>
							</div>
							<Btn variant="primary" onClick={() => openModal("loop")} style={{ height: 32, fontSize: 12.5 }}>
								<I.refresh size={13} /> {t("plan.generateLoop")}
							</Btn>
						</div>
						<div style={{ textAlign: "center", fontSize: 12, color: RDS_COLORS.fgSubtle, lineHeight: 1.55 }}>
							{t("plan.orTapMap")} <Kbd>⌘</Kbd> <Kbd>K</Kbd>
						</div>
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
							const isNumbered = !isStart && !isEnd;
							const showActions = isMobile || isHovered || isDragging;
							return (
								// biome-ignore lint/a11y/noStaticElementInteractions: drag-drop row is a non-interactive container; the grip button inside is the keyboard-actionable control
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: waypoints can repeat coords; combine coord with index for stable key
									key={`${w.coord[0]}-${w.coord[1]}-${i}`}
									data-waypoint-row={i}
									onMouseEnter={() => setWaypointHover(i)}
									onMouseLeave={() => {
										if (hoveredWaypointIndex === i) clearWaypointHover();
									}}
									onFocusCapture={() => setWaypointHover(i)}
									onBlurCapture={() => {
										if (hoveredWaypointIndex === i) clearWaypointHover();
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
											alignSelf: "stretch",
										}}
									>
										{isNumbered ? (
											// Number matches the marker drawn on the map for this waypoint.
											<div
												style={{
													width: 16,
													height: 16,
													borderRadius: 999,
													background: dot,
													color: RDS_COLORS.accentFg,
													fontSize: 9,
													fontWeight: 700,
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													flexShrink: 0,
												}}
											>
												{i}
											</div>
										) : (
											<div
												style={{
													width: 10,
													height: 10,
													borderRadius: 999,
													background: dot,
													border: `2px solid ${RDS_COLORS.bgPanel}`,
													boxShadow: `0 0 0 1.5px ${dot}`,
													flexShrink: 0,
													marginTop: 3,
												}}
											/>
										)}
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
										<WaypointPlace coord={w.coord} distanceKm={i > 0 ? (waypointDistancesKm?.[i] ?? null) : null} />
									</div>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: 2,
											opacity: showActions ? 1 : 0,
											transition: "opacity 120ms",
										}}
									>
										<IconBtn
											title={t("plan.dragToReorder")}
											onPointerDown={handleGripPointerDown(i)}
											onPointerMove={handleGripPointerMove}
											onPointerUp={handleGripPointerEnd}
											onPointerCancel={handleGripPointerEnd}
											style={{
												cursor: draggingIdx === i ? "grabbing" : "grab",
												color: RDS_COLORS.fgSubtle,
												touchAction: "none",
											}}
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

				{!isMobile && (
					<button
						type="button"
						onClick={() => openModal("search")}
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 8,
							marginTop: 10,
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
					<I.upload size={14} />
				</Btn>
				<div style={{ width: 1, alignSelf: "stretch", margin: "6px 2px", background: RDS_COLORS.border }} />
				<Btn
					title={t("plan.clear")}
					variant="ghost"
					onClick={handleClear}
					disabled={waypoints.length === 0}
					style={{ padding: "0 10px", color: RDS_COLORS.danger }}
				>
					<I.trash size={14} />
				</Btn>
			</div>
		</div>
	);
}

function EndpointButton({
	dotColor,
	label,
	title,
	onClick,
	muted,
}: {
	dotColor: string;
	label: string;
	title: string;
	onClick: () => void;
	muted?: boolean;
}) {
	return (
		<Tooltip label={title}>
			<button
				type="button"
				onClick={onClick}
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
					width: "100%",
					cursor: "pointer",
					textAlign: "left",
					font: "inherit",
					color: muted ? RDS_COLORS.fgSubtle : RDS_COLORS.fg,
					transition: "background 120ms, border-color 120ms",
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.background = RDS_COLORS.bgHover;
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.background = RDS_COLORS.bgInput;
				}}
			>
				<span style={{ width: 8, height: 8, borderRadius: 999, background: dotColor, flexShrink: 0 }} />
				<span
					style={{
						flex: 1,
						fontSize: 13,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{label}
				</span>
			</button>
		</Tooltip>
	);
}

function FeatureBtn({
	icon,
	label,
	title,
	onClick,
}: {
	icon: React.ReactNode;
	label: string;
	title: string;
	onClick: () => void;
}) {
	return (
		<Tooltip label={title}>
			<button
				type="button"
				onClick={onClick}
				aria-label={title}
				style={{
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					gap: 6,
					flexShrink: 0,
					height: 32,
					padding: "0 10px",
					borderRadius: 999,
					border: `1px solid ${RDS_COLORS.border}`,
					background: "transparent",
					color: RDS_COLORS.fgMuted,
					fontSize: 12.5,
					fontWeight: 500,
					cursor: "pointer",
					transition: "background 120ms, color 120ms",
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.background = RDS_COLORS.bgHover;
					e.currentTarget.style.color = RDS_COLORS.fg;
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.background = "transparent";
					e.currentTarget.style.color = RDS_COLORS.fgMuted;
				}}
			>
				{icon} {label}
			</button>
		</Tooltip>
	);
}

// Subline for a waypoint row: reverse-geocoded place name (coords while it
// resolves) plus the distance from the start measured along the route.
function WaypointPlace({ coord, distanceKm }: { coord: [number, number]; distanceKm: number | null }) {
	const name = usePlaceName(coord);
	const { formatDistance } = useUnits();
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 6,
				fontSize: 11,
				color: RDS_COLORS.fgSubtle,
				marginTop: 2,
				minWidth: 0,
			}}
		>
			<span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
				{name ?? <span className="rds-mono">{formatCoord(coord)}</span>}
			</span>
			{distanceKm != null && (
				<>
					<span aria-hidden="true">·</span>
					<span className="rds-mono" style={{ flexShrink: 0 }}>
						{formatDistance(distanceKm)}
					</span>
				</>
			)}
		</div>
	);
}

function formatCoord(c: [number, number]) {
	return `${c[1].toFixed(4)}, ${c[0].toFixed(4)}`;
}
