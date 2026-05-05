import type { Coordinate } from "@routess/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useComputedElevationProfile } from "@/features/routing/services/elevation";
import { resolveValhallaCosting } from "@/features/routing/services/routingMode";
import { fetchSurfaceBreakdown, type SurfaceBreakdown } from "@/features/routing/services/SurfaceService";
import type { ApiRoute } from "@/lib/api";
import { useSaveRoute, useUpdateRoute } from "@/lib/api-queries";
import { Logger } from "@/lib/logger";
import { EditableLabel } from "../components/EditableLabel";
import { ElevationSparkline } from "../components/ElevationSparkline";
import { I, type IconKey } from "../components/icons";
import { Btn, IconBtn, RDS_COLORS, SecTitle } from "../components/primitives";
import { SurfaceBreakdownBar } from "../components/SurfaceBreakdownBar";
import { useModalsStore } from "../stores/modalsStore";
import { useRoutingPreferencesStore } from "../stores/routingPreferencesStore";
import { useRedesignSettingsStore } from "../stores/settingsStore";
import { useToastStore } from "../stores/toastStore";
import { useUiStore } from "../stores/uiStore";

// SaveModal serializes activity + privacy + tags into the description string,
// e.g. "Activity: cycle; Privacy: private" or
//      "Activity: run; Privacy: link; Tags: hilly, scenic".
// Anything that doesn't match this shape is treated as user-written prose.
const PARSED_DESCRIPTION_RE = /^Activity:\s*(\w+);\s*Privacy:\s*(\w+)(?:;\s*Tags:\s*(.*?))?(?:\s*\.)?$/i;

interface ParsedDescription {
	activity: string | null;
	privacy: string | null;
	tags: string[];
	freeText: string | null;
}

const parseRouteDescription = (desc: string | null | undefined): ParsedDescription => {
	const empty: ParsedDescription = { activity: null, privacy: null, tags: [], freeText: null };
	if (!desc) return empty;
	const trimmed = desc.trim();
	if (!trimmed) return empty;
	const match = trimmed.match(PARSED_DESCRIPTION_RE);
	if (!match) return { ...empty, freeText: trimmed };
	const tagsList = match[3]
		? match[3]
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean)
		: [];
	return {
		activity: match[1].toLowerCase(),
		privacy: match[2].toLowerCase(),
		tags: tagsList,
		freeText: null,
	};
};

const ACTIVITY_LABEL: Record<string, { label: string; icon: IconKey }> = {
	cycle: { label: "Cycling", icon: "bike" },
	cycling: { label: "Cycling", icon: "bike" },
	run: { label: "Running", icon: "run" },
	running: { label: "Running", icon: "run" },
	walk: { label: "Walking", icon: "walk" },
	walking: { label: "Walking", icon: "walk" },
};

const PRIVACY_LABEL: Record<string, { label: string; icon: IconKey }> = {
	private: { label: "Private", icon: "lock" },
	link: { label: "Anyone with link", icon: "share" },
	public: { label: "Public", icon: "globe" },
};

function MetaChip({ icon, label }: { icon: IconKey; label: string }) {
	const Icon = I[icon];
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 6,
				padding: "4px 10px",
				height: 24,
				borderRadius: 999,
				background: RDS_COLORS.bgInput,
				border: `1px solid ${RDS_COLORS.border}`,
				color: RDS_COLORS.fgMuted,
				fontSize: 11.5,
				fontWeight: 500,
				whiteSpace: "nowrap",
			}}
		>
			<Icon size={11} /> {label}
		</span>
	);
}

function TagChip({ label }: { label: string }) {
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				padding: "4px 10px",
				height: 24,
				borderRadius: 999,
				background: RDS_COLORS.accentSoft,
				color: RDS_COLORS.accent,
				fontSize: 11.5,
				fontWeight: 500,
				whiteSpace: "nowrap",
			}}
		>
			#{label}
		</span>
	);
}

export function RouteDetailPanel({ route, onBack }: { route: ApiRoute; onBack: () => void }) {
	const distanceKm = route.distance ? (route.distance / 1000).toFixed(1) : "—";
	const durationStr = route.duration ? `${Math.round(route.duration / 60)} min` : "—";
	const elevStr = route.elevationGain ? `${Math.round(route.elevationGain)}` : "—";
	const paceStr =
		route.distance && route.duration ? (route.distance / 1000 / (route.duration / 3600) || 0).toFixed(1) : "—";

	const [moreOpen, setMoreOpen] = useState(false);
	const moreRef = useRef<HTMLDivElement | null>(null);
	const saveRoute = useSaveRoute();
	const updateRoute = useUpdateRoute();
	const openDelete = useModalsStore((s) => s.openDelete);
	const openModal = useModalsStore((s) => s.openModal);
	const pushToast = useToastStore((s) => s.push);
	const favouriteRouteIds = useUiStore((s) => s.favouriteRouteIds);
	const toggleFavourite = useUiStore((s) => s.toggleFavourite);
	const setContext = useUiStore((s) => s.setContext);
	const favorited = favouriteRouteIds.includes(route.id);
	const defaultActivity = useRedesignSettingsStore((s) => s.defaultActivity);
	const routingProfile = useRoutingPreferencesStore((s) => s.profile);

	// Saved routes don't persist the elevation profile array (only the gain
	// number), so re-sample the stored geometry on view. Falls back to
	// waypoint coords for legacy routes saved before geometry persistence.
	const elevationGeometry = useMemo<Coordinate[]>(() => {
		if (route.geometry && route.geometry.length >= 2) return route.geometry;
		return (route.waypoints ?? []).map((w) => [w.lng, w.lat] as Coordinate);
	}, [route.geometry, route.waypoints]);
	const { profile: computedProfile, loading: elevationLoading } = useComputedElevationProfile(
		elevationGeometry,
		String(route.id),
	);

	// Surface breakdown isn't persisted with saved routes, so fetch it on view
	// from the stored geometry. Falls back silently if Valhalla is unavailable.
	const [surfaceBreakdown, setSurfaceBreakdown] = useState<SurfaceBreakdown | null>(null);
	const [surfaceLoading, setSurfaceLoading] = useState(false);
	const costing = useMemo(
		() => resolveValhallaCosting(defaultActivity, routingProfile),
		[defaultActivity, routingProfile],
	);
	useEffect(() => {
		if (elevationGeometry.length < 2) {
			setSurfaceBreakdown(null);
			setSurfaceLoading(false);
			return;
		}
		const controller = new AbortController();
		const timeoutId = window.setTimeout(() => controller.abort(), 10000);
		setSurfaceLoading(true);
		fetchSurfaceBreakdown(elevationGeometry, costing, controller.signal)
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
	}, [elevationGeometry, costing]);

	const parsedDescription = useMemo(() => parseRouteDescription(route.description), [route.description]);
	const activityMeta = parsedDescription.activity ? ACTIVITY_LABEL[parsedDescription.activity] : null;
	const privacyMeta = parsedDescription.privacy ? PRIVACY_LABEL[parsedDescription.privacy] : null;
	const hasMetaChips = Boolean(activityMeta) || Boolean(privacyMeta) || parsedDescription.tags.length > 0;

	useEffect(() => {
		if (!moreOpen) return;
		const onDocClick = (e: MouseEvent) => {
			if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
				setMoreOpen(false);
			}
		};
		document.addEventListener("mousedown", onDocClick);
		return () => document.removeEventListener("mousedown", onDocClick);
	}, [moreOpen]);

	const dispatchLoadRoute = () => {
		window.dispatchEvent(
			new CustomEvent("routess:load-route", {
				detail: {
					routeId: route.id,
					name: route.name,
					waypoints: route.waypoints,
					geometry: route.geometry,
					distance: route.distance,
					duration: route.duration,
					elevationGain: route.elevationGain,
				},
			}),
		);
		setContext("plan");
		pushToast({
			kind: "success",
			title: "Route loaded",
			body: route.name,
		});
	};

	const dispatchShare = () => {
		// ShareModal reads from the routing store; load the saved route there
		// first so the share URL encodes this route's waypoints rather than
		// whatever was last on the map.
		window.dispatchEvent(
			new CustomEvent("routess:load-route", {
				detail: {
					routeId: route.id,
					name: route.name,
					waypoints: route.waypoints,
					geometry: route.geometry,
					distance: route.distance,
					duration: route.duration,
					elevationGain: route.elevationGain,
				},
			}),
		);
		openModal("share");
	};

	const dispatchFavorite = () => {
		toggleFavourite(route.id);
	};

	const dispatchDuplicate = () => {
		saveRoute.mutate(
			{
				name: `${route.name} (copy)`,
				description: route.description,
				waypoints: route.waypoints,
				distance: route.distance,
				duration: route.duration,
				elevationGain: route.elevationGain,
			},
			{
				onSuccess: (newRoute) => {
					pushToast({
						kind: "success",
						title: "Route duplicated",
						body: newRoute.name,
					});
					setMoreOpen(false);
				},
				onError: () => {
					pushToast({
						kind: "danger",
						title: "Duplicate failed",
						body: "Try again.",
					});
				},
			},
		);
	};

	const dispatchDelete = () => {
		openDelete(route.id);
		setMoreOpen(false);
	};

	const dispatchExport = () => {
		window.dispatchEvent(new CustomEvent("routess:export-gpx", { detail: { routeId: route.id } }));
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
					pushToast({ kind: "danger", title: "Rename failed", body: "Try again." });
				},
			},
		);
	};

	const stats = [
		{ label: "Distance", value: distanceKm, unit: "km" },
		{ label: "Duration", value: durationStr, unit: "" },
		{ label: "Elev gain", value: elevStr, unit: "m" },
		{ label: "Avg speed", value: paceStr, unit: "km/h" },
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
				<IconBtn title="Back" onClick={onBack}>
					<I.chevronL size={16} />
				</IconBtn>
				<span style={{ fontSize: 13, color: RDS_COLORS.fgMuted }}>Library</span>
				<I.chevronR size={12} />
				<span
					style={{
						fontSize: 13,
						fontWeight: 600,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{route.name}
				</span>
				<div style={{ flex: 1 }} />
				<IconBtn title={favorited ? "Remove favourite" : "Favourite"} onClick={dispatchFavorite}>
					<I.heart size={14} style={favorited ? { color: RDS_COLORS.danger, fill: "currentColor" } : undefined} />
				</IconBtn>
				<IconBtn title="Share" onClick={dispatchShare}>
					<I.share size={14} />
				</IconBtn>
				<div ref={moreRef} style={{ position: "relative" }}>
					<IconBtn title="More" onClick={() => setMoreOpen((v) => !v)} pressed={moreOpen}>
						<I.more size={14} />
					</IconBtn>
					{moreOpen && (
						<div
							style={{
								position: "absolute",
								top: "calc(100% + 4px)",
								right: 0,
								minWidth: 160,
								background: RDS_COLORS.bgPanel,
								border: `1px solid ${RDS_COLORS.border}`,
								borderRadius: 8,
								padding: 4,
								boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
								zIndex: 10,
							}}
						>
							<button
								type="button"
								onClick={dispatchDuplicate}
								disabled={saveRoute.isPending}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 8,
									width: "100%",
									padding: "8px 10px",
									background: "transparent",
									border: 0,
									borderRadius: 6,
									cursor: "pointer",
									fontSize: 13,
									color: RDS_COLORS.fg,
									textAlign: "left",
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = RDS_COLORS.bgHover;
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = "transparent";
								}}
							>
								<I.copy size={14} /> {saveRoute.isPending ? "Duplicating…" : "Duplicate"}
							</button>
							<button
								type="button"
								onClick={dispatchDelete}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 8,
									width: "100%",
									padding: "8px 10px",
									background: "transparent",
									border: 0,
									borderRadius: 6,
									cursor: "pointer",
									fontSize: 13,
									color: RDS_COLORS.danger,
									textAlign: "left",
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = RDS_COLORS.bgHover;
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = "transparent";
								}}
							>
								<I.trash size={14} /> Delete
							</button>
						</div>
					)}
				</div>
			</div>

			<div style={{ flex: 1, overflow: "auto", padding: 20 }}>
				<h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 600, letterSpacing: -0.4 }}>{route.name}</h2>
				<p className="rds-mono" style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle, margin: 0 }}>
					Created {new Date(route.createdAt).toLocaleDateString()} · {route.waypoints?.length ?? 0} waypoints
				</p>

				{hasMetaChips && (
					<div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
						{activityMeta && <MetaChip icon={activityMeta.icon} label={activityMeta.label} />}
						{privacyMeta && <MetaChip icon={privacyMeta.icon} label={privacyMeta.label} />}
						{parsedDescription.tags.map((t) => (
							<TagChip key={t} label={t} />
						))}
					</div>
				)}

				{parsedDescription.freeText && (
					<p style={{ fontSize: 13, color: RDS_COLORS.fgMuted, margin: "12px 0 0", lineHeight: 1.5 }}>
						{parsedDescription.freeText}
					</p>
				)}

				{/* Stat strip */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(4, 1fr)",
						marginTop: 18,
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
							<SecTitle>{s.label}</SecTitle>
							<div className="rds-mono" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1, marginTop: 4 }}>
								{s.value}
								{s.unit && (
									<span
										style={{
											fontSize: 11,
											color: RDS_COLORS.fgSubtle,
											marginLeft: 3,
											fontWeight: 400,
										}}
									>
										{s.unit}
									</span>
								)}
							</div>
						</div>
					))}
				</div>

				{elevationGeometry.length >= 2 && (
					<div style={{ marginTop: 18 }}>
						<SecTitle style={{ marginBottom: 8 }}>Elevation</SecTitle>
						<ElevationSparkline
							profile={computedProfile}
							loading={elevationLoading}
							gradientId={`rds-elev-${route.id}`}
						/>
					</div>
				)}

				{elevationGeometry.length >= 2 && <SurfaceBreakdownBar breakdown={surfaceBreakdown} loading={surfaceLoading} />}

				{route.waypoints && route.waypoints.length > 0 && (
					<div style={{ marginTop: 18 }}>
						<SecTitle style={{ marginBottom: 10 }}>Waypoints · {route.waypoints.length}</SecTitle>
						<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
							{route.waypoints.map((w, i) => {
								const isStart = i === 0;
								const isEnd = i === route.waypoints.length - 1;
								const dot = isStart ? RDS_COLORS.success : isEnd ? RDS_COLORS.danger : RDS_COLORS.accent;
								const label = isStart ? "Start" : isEnd ? "End" : `Waypoint ${i}`;
								const coordStr = `${w.lat.toFixed(5)}, ${w.lng.toFixed(5)}`;
								return (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: same coord can repeat; combine with index for stable key
										key={`${w.lng}-${w.lat}-${i}`}
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
														direct
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
						<SecTitle style={{ marginBottom: 8 }}>Route</SecTitle>
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
										<div style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>Start</div>
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
										<div style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>End</div>
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
					<I.play size={12} /> Load on map
				</Btn>
				<Btn onClick={dispatchExport} title="Download GPX">
					<I.download size={14} />
				</Btn>
				<Btn onClick={dispatchShare} title="Share">
					<I.share size={14} />
				</Btn>
			</div>
		</div>
	);
}
