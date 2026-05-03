import { type ElevationProfilePoint, formatDistance } from "@routess/core";
import { useEffect, useRef, useState } from "react";
import { useModalsStore } from "@/redesign/stores/modalsStore";
import { type RedesignActivity, useUiStore } from "@/redesign/stores/uiStore";
import {
	useClearWaypoints,
	useElevationGain,
	useElevationProfile,
	useHasRoute,
	useIsComputingElevation,
	useRemoveWaypoint,
	useRouteDistance,
	useRouteDuration,
	useRoutePath,
	useSetWaypointType,
	useWaypoints,
} from "@/stores/routingStore";
import { I } from "../components/icons";
import { Btn, IconBtn, Kbd, RDS_COLORS, SecTitle } from "../components/primitives";

const ACTIVITIES: { key: RedesignActivity; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
	{ key: "run", icon: I.run, label: "Run" },
	{ key: "cycle", icon: I.bike, label: "Cycle" },
	{ key: "walk", icon: I.walk, label: "Walk" },
];

const SPARKLINE_W = 300;
const SPARKLINE_H = 44;
const SPARKLINE_PAD_Y = 3;

interface ProfileSummary {
	line: string;
	area: string;
	minMeters: number;
	maxMeters: number;
	totalMeters: number;
}

function summarizeProfile(profile: ElevationProfilePoint[]): ProfileSummary | null {
	if (profile.length < 2) return null;
	const total = profile[profile.length - 1].distanceMeters;
	if (total <= 0) return null;

	let minE = Number.POSITIVE_INFINITY;
	let maxE = Number.NEGATIVE_INFINITY;
	for (const p of profile) {
		if (p.elevationMeters < minE) minE = p.elevationMeters;
		if (p.elevationMeters > maxE) maxE = p.elevationMeters;
	}
	// On flat-ish terrain spread the line through the middle of the chart so
	// it doesn't sit pinned to one edge.
	const range = maxE - minE > 0.5 ? maxE - minE : 1;
	const innerH = SPARKLINE_H - SPARKLINE_PAD_Y * 2;

	let line = "";
	for (let i = 0; i < profile.length; i++) {
		const p = profile[i];
		const x = (p.distanceMeters / total) * SPARKLINE_W;
		const y = SPARKLINE_PAD_Y + innerH - ((p.elevationMeters - minE) / range) * innerH;
		line += i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : ` L${x.toFixed(2)} ${y.toFixed(2)}`;
	}
	const area = `${line} L${SPARKLINE_W} ${SPARKLINE_H} L0 ${SPARKLINE_H} Z`;
	return { line, area, minMeters: minE, maxMeters: maxE, totalMeters: total };
}

function ElevationSparkline() {
	const profile = useElevationProfile();
	const isComputing = useIsComputingElevation();
	const hasRoute = useHasRoute();
	const summary = profile ? summarizeProfile(profile) : null;
	const status = summary ? "ready" : hasRoute && isComputing ? "loading" : "empty";

	const axisLabelStyle: React.CSSProperties = {
		position: "absolute",
		fontSize: 10,
		lineHeight: 1,
		color: RDS_COLORS.fgSubtle,
		fontVariantNumeric: "tabular-nums",
		pointerEvents: "none",
	};

	return (
		<div
			style={{
				marginTop: 14,
				position: "relative",
				background: RDS_COLORS.bgInput,
				borderRadius: 8,
				padding: "16px 8px 16px 38px",
				opacity: status === "loading" ? 0.7 : 1,
			}}
		>
			<div style={{ position: "relative", height: 44 }}>
				<svg
					viewBox={`0 0 ${SPARKLINE_W} ${SPARKLINE_H}`}
					preserveAspectRatio="none"
					style={{ width: "100%", height: "100%", display: "block" }}
					aria-hidden="true"
				>
					<defs>
						<linearGradient id="rds-elev" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0" stopColor="var(--rds-accent)" stopOpacity="0.35" />
							<stop offset="1" stopColor="var(--rds-accent)" stopOpacity="0" />
						</linearGradient>
					</defs>
					{summary ? (
						<>
							<path d={summary.area} fill="url(#rds-elev)" />
							<path d={summary.line} stroke="var(--rds-accent)" strokeWidth="1.4" fill="none" />
						</>
					) : (
						<line
							x1="0"
							y1={SPARKLINE_H - SPARKLINE_PAD_Y}
							x2={SPARKLINE_W}
							y2={SPARKLINE_H - SPARKLINE_PAD_Y}
							stroke="var(--rds-accent)"
							strokeOpacity="0.25"
							strokeWidth="1"
							strokeDasharray="4 4"
						/>
					)}
				</svg>
			</div>

			{/* Y-axis: max at top of chart, min at bottom. Anchored to the SVG's
			    actual top/bottom edges via the parent's padding. */}
			<span style={{ ...axisLabelStyle, left: 6, top: 12, textAlign: "right", width: 26 }}>
				{summary ? `${Math.round(summary.maxMeters)} m` : ""}
			</span>
			<span style={{ ...axisLabelStyle, left: 6, bottom: 12, textAlign: "right", width: 26 }}>
				{summary ? `${Math.round(summary.minMeters)} m` : ""}
			</span>

			{/* X-axis: 0 at start, total distance at end. */}
			<span style={{ ...axisLabelStyle, left: 38, bottom: 2 }}>{summary ? "0" : ""}</span>
			<span style={{ ...axisLabelStyle, right: 8, bottom: 2 }}>
				{summary ? formatDistance(summary.totalMeters / 1000) : ""}
			</span>
		</div>
	);
}

export function PlanPanel() {
	const waypoints = useWaypoints();
	const routePath = useRoutePath();
	const distance = useRouteDistance();
	const duration = useRouteDuration();
	const hasRoute = useHasRoute();
	const clear = useClearWaypoints();
	const removeWaypoint = useRemoveWaypoint();
	const setWaypointType = useSetWaypointType();
	const [openMenuIdx, setOpenMenuIdx] = useState<number | null>(null);

	const { activityType, setActivityType } = useUiStore();
	const openModal = useModalsStore((s) => s.openModal);
	const elevationGain = useElevationGain();
	const isComputingElevation = useIsComputingElevation();

	const elevationVal = (() => {
		if (elevationGain != null) return Math.round(elevationGain).toString();
		if (hasRoute && isComputingElevation) return "…";
		return "—";
	})();

	const stats = [
		{
			label: "Distance",
			val: distance ? distance.split(" ")[0] : "—",
			unit: distance ? distance.split(" ")[1] || "km" : "km",
		},
		{ label: "Time", val: duration || "—", unit: "" },
		{ label: "Elev gain", val: elevationVal, unit: "m" },
		{ label: "Pace", val: "—", unit: "/km" },
	];

	const startWp = waypoints[0];
	const endWp = waypoints[waypoints.length - 1];

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			{/* Activity tabs + start/end */}
			<div
				style={{
					padding: "16px 20px 12px",
					borderBottom: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
					{ACTIVITIES.map((a) => {
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
								<Icon size={14} /> {a.label}
							</button>
						);
					})}
					<div style={{ flex: 1 }} />
					<IconBtn title="Routing preferences" onClick={() => openModal("routing")}>
						<I.sliders size={16} />
					</IconBtn>
					<IconBtn title="Generate loop" onClick={() => openModal("loop")}>
						<I.compass size={16} />
					</IconBtn>
				</div>

				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 6 }}>
					<EndpointInput
						dotColor={RDS_COLORS.success}
						label={startWp ? formatCoord(startWp.coord) : "Add start point"}
					/>
					<EndpointInput
						dotColor={RDS_COLORS.danger}
						label={endWp && waypoints.length > 1 ? formatCoord(endWp.coord) : "Add end point"}
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
					<I.plus size={14} /> Add waypoint
					<span style={{ flex: 1 }} />
					<Kbd>⌘</Kbd>
					<Kbd>K</Kbd>
				</button>
			</div>

			{/* Stats */}
			<div style={{ padding: "14px 20px", borderBottom: `1px solid ${RDS_COLORS.border}` }}>
				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
					{stats.map((s) => (
						<div key={s.label}>
							<SecTitle>{s.label}</SecTitle>
							<div
								className="rds-mono"
								style={{
									fontSize: 20,
									fontWeight: 600,
									color: RDS_COLORS.fg,
									marginTop: 4,
									lineHeight: 1,
								}}
							>
								{s.val}
								{s.unit && <span style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginLeft: 3 }}>{s.unit}</span>}
							</div>
						</div>
					))}
				</div>
				<ElevationSparkline />
			</div>

			{/* Waypoints list */}
			<div style={{ padding: "14px 20px", overflow: "auto", flex: 1 }}>
				<SecTitle style={{ marginBottom: 10 }}>Waypoints · {waypoints.length}</SecTitle>
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
						Tap the map to add your first waypoint, or use <Kbd>⌘</Kbd>
						<Kbd>K</Kbd> to search a place.
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
						{waypoints.map((w, i) => {
							const isStart = i === 0;
							const isEnd = i === waypoints.length - 1;
							const dot = isStart ? RDS_COLORS.success : isEnd ? RDS_COLORS.danger : RDS_COLORS.accent;
							const label = isStart ? "Start" : isEnd ? "End" : `Waypoint ${i}`;
							return (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: waypoints can repeat coords; combine coord with index for stable key
									key={`${w.coord[0]}-${w.coord[1]}-${i}`}
									style={{
										display: "flex",
										alignItems: "center",
										gap: 12,
										padding: "8px 10px",
										borderRadius: 8,
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
									<div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
										<div style={{ fontSize: 13, fontWeight: 500, color: RDS_COLORS.fg }}>{label}</div>
										<div className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginTop: 2 }}>
											{formatCoord(w.coord)}
										</div>
									</div>
									<WaypointMenu
										open={openMenuIdx === i}
										onToggle={() => setOpenMenuIdx(openMenuIdx === i ? null : i)}
										onClose={() => setOpenMenuIdx(null)}
										isDirect={w.type === "direct"}
										onRemove={() => {
											removeWaypoint(i);
											setOpenMenuIdx(null);
										}}
										onToggleDirect={() => {
											setWaypointType(i, w.type === "direct" ? "routed" : "direct");
											setOpenMenuIdx(null);
										}}
									/>
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
					gap: 8,
					padding: "12px 20px",
					borderTop: `1px solid ${RDS_COLORS.border}`,
				}}
			>
				<Btn variant="primary" style={{ flex: 1 }} disabled={!hasRoute} onClick={() => openModal("save")}>
					<I.save size={14} /> Save route
				</Btn>
				<Btn title="Share route" disabled={!hasRoute} onClick={() => openModal("share")}>
					<I.share size={14} />
				</Btn>
				<Btn
					title="Import GPX"
					disabled={routePath.length === 0 && waypoints.length === 0}
					onClick={() => openModal("import")}
				>
					<I.download size={14} />
				</Btn>
				<Btn title="Clear" variant="ghost" onClick={clear} disabled={waypoints.length === 0}>
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

interface WaypointMenuProps {
	open: boolean;
	onToggle: () => void;
	onClose: () => void;
	isDirect: boolean;
	onRemove: () => void;
	onToggleDirect: () => void;
}

function WaypointMenu({ open, onToggle, onClose, isDirect, onRemove, onToggleDirect }: WaypointMenuProps) {
	const wrapRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const handleClick = (e: MouseEvent) => {
			if (!wrapRef.current) return;
			if (!wrapRef.current.contains(e.target as Node)) onClose();
		};
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("mousedown", handleClick);
		document.addEventListener("keydown", handleKey);
		return () => {
			document.removeEventListener("mousedown", handleClick);
			document.removeEventListener("keydown", handleKey);
		};
	}, [open, onClose]);

	return (
		<div ref={wrapRef} style={{ position: "relative" }}>
			<IconBtn title="More options" onClick={onToggle} pressed={open}>
				<I.more size={14} />
			</IconBtn>
			{open && (
				<div
					role="menu"
					style={{
						position: "absolute",
						top: "calc(100% + 4px)",
						right: 0,
						minWidth: 160,
						background: RDS_COLORS.bgPanelElev,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 8,
						boxShadow: "var(--rds-shadow-lg)",
						zIndex: 30,
						padding: 4,
						display: "flex",
						flexDirection: "column",
					}}
				>
					<MenuItem onClick={onToggleDirect}>{isDirect ? "Make routed" : "Make direct"}</MenuItem>
					<MenuItem onClick={onRemove} danger>
						Remove
					</MenuItem>
				</div>
			)}
		</div>
	);
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
	return (
		<button
			type="button"
			onClick={onClick}
			role="menuitem"
			style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				height: 30,
				padding: "0 10px",
				border: 0,
				background: "transparent",
				color: danger ? RDS_COLORS.danger : RDS_COLORS.fg,
				fontSize: 12.5,
				textAlign: "left",
				borderRadius: 6,
				cursor: "pointer",
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.background = RDS_COLORS.bgHover;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.background = "transparent";
			}}
		>
			{children}
		</button>
	);
}
