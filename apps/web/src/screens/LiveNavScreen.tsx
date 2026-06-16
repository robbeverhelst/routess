import { calculateBearing, type NavCue, projectOntoPath } from "@routess/core";
import { type CSSProperties, useEffect, useState } from "react";
import { NavMap } from "@/features/navigation/NavMap";
import { useNavigationController } from "@/features/navigation/useNavigationController";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useT } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { useUnits } from "@/lib/units";
import { useNavigationStore } from "@/stores/navigationStore";
import { I, type IconKey } from "../components/icons";
import { RDS_COLORS } from "../components/primitives";

// Valhalla maneuver types → banner arrow rotation. Unknown types render as
// straight-ahead, which is the least-wrong default.
const MANEUVER_ROTATION: Record<number, number> = {
	9: 30, // slight right
	10: 90,
	11: 135, // sharp right
	12: 180,
	13: 180,
	14: -135, // sharp left
	15: -90,
	16: -30, // slight left
	18: 45,
	19: -45,
	20: 45,
	21: -45,
	23: 20,
	24: -20,
};
const DESTINATION_TYPES = new Set([4, 5, 6]);

function CueIcon({ cue, size = 32, color }: { cue: NavCue | null; size?: number; color?: string }) {
	const style = color ? { color } : undefined;
	if (!cue) return <I.arrowUp size={size} style={style} />;
	if (cue.kind === "node") return <I.target size={size} style={style} />;
	if (cue.maneuverType != null && DESTINATION_TYPES.has(cue.maneuverType)) return <I.flag size={size} style={style} />;
	const rotation = cue.maneuverType != null ? (MANEUVER_ROTATION[cue.maneuverType] ?? 0) : 0;
	return <I.arrowUp size={size} style={{ ...style, transform: `rotate(${rotation}deg)` }} />;
}

function formatMeters(meters: number, formatKm: (km: number) => { value: string; unit: string }): string {
	if (meters < 950) return `${Math.max(0, Math.round(meters / 10) * 10)} m`;
	const parts = formatKm(meters / 1000);
	return `${parts.value} ${parts.unit}`;
}

function formatClock(ms: number): string {
	return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatElapsed(seconds: number): string {
	const m = Math.floor(seconds / 60);
	if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
	return `${m}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

const FALLBACK_SPEED_MPS = { cycle: 5.5, run: 2.8, walk: 1.4 } as const;

export function LiveNavScreen() {
	const t = useT();
	const { formatDistanceParts, formatSpeedParts } = useUnits();
	const online = useOnlineStatus();

	const active = useNavigationStore((s) => s.active);
	const lastFix = useNavigationStore((s) => s.lastFix);
	const muted = useNavigationStore((s) => s.muted);
	const follow = useNavigationStore((s) => s.follow);
	const setMuted = useNavigationStore((s) => s.setMuted);
	const setFollow = useNavigationStore((s) => s.setFollow);
	const dismiss = useNavigationStore((s) => s.dismiss);

	const { context, remaining, requestRejoin } = useNavigationController();
	const [confirmEnd, setConfirmEnd] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const [overviewNonce, setOverviewNonce] = useState(0);

	useEffect(() => {
		if (!confirmEnd) return;
		const timer = window.setTimeout(() => setConfirmEnd(false), 4000);
		return () => window.clearTimeout(timer);
	}, [confirmEnd]);

	if (!active || !context) return null;
	const engine = active.engine;
	const total = context.main.totalMeters;
	const progress = total > 0 ? Math.min(1, engine.distanceAlongMeters / total) : 0;

	const currentCue: NavCue | null = active.cues[engine.nextCueIndex] ?? null;
	const thenCue: NavCue | null = active.cues[engine.nextCueIndex + 1] ?? null;
	const toCueMeters = currentCue ? Math.max(0, currentCue.distanceAlongMeters - engine.distanceAlongMeters) : null;

	const speedMps =
		lastFix?.speedMps != null && lastFix.speedMps > 0 ? lastFix.speedMps : FALLBACK_SPEED_MPS[active.activity];
	const speedParts =
		lastFix?.speedMps != null && lastFix.speedMps > 0 ? formatSpeedParts(lastFix.speedMps * 3.6) : null;
	const etaMinutes = Math.max(1, Math.round(remaining / speedMps / 60));
	const etaClock = formatClock(Date.now() + (remaining / speedMps) * 1000);
	const remainingLabel = formatMeters(remaining, formatDistanceParts);

	// Off-route while a Rejoin is impossible (offline): an honest bearing-and-
	// distance indicator back to the RoutePath (ADR 0038).
	const offRouteHint = (() => {
		if (engine.status !== "offRoute" || !lastFix) return null;
		const projection = projectOntoPath(context.main, lastFix.coord);
		return {
			meters: projection.distanceFromPathMeters,
			bearing: calculateBearing(lastFix.coord, projection.point) - (lastFix.headingDeg ?? 0),
		};
	})();

	const ended = engine.status === "ended";

	const doOverview = () => {
		setFollow(false);
		setOverviewNonce((n) => n + 1);
	};

	const shareEta = () => {
		const text = t("nav.shareEtaText", { eta: etaClock, distance: remainingLabel });
		if (typeof navigator !== "undefined" && navigator.share) {
			void navigator.share({ title: active.routeName, text }).catch(() => undefined);
		} else if (typeof navigator !== "undefined" && navigator.clipboard) {
			void navigator.clipboard.writeText(text).catch((err) => Logger.debug("[Nav] share copy failed", err));
		}
	};

	const handleEnd = () => {
		if (ended) {
			dismiss();
			return;
		}
		if (!confirmEnd && progress > 0.02) {
			setConfirmEnd(true);
			return;
		}
		dismiss();
	};

	return (
		<div style={{ position: "absolute", inset: 0, background: RDS_COLORS.bgCanvas, overflow: "hidden" }}>
			<div style={{ position: "absolute", inset: 0 }}>
				<NavMap
					path={active.path}
					rejoinPath={engine.rejoin?.path ?? null}
					puck={lastFix?.coord ?? null}
					headingDeg={lastFix?.headingDeg ?? null}
					follow={follow && !ended}
					overviewNonce={overviewNonce}
					onUserPan={() => setFollow(false)}
				/>
			</div>

			{ended && engine.arrived ? (
				<ArrivalSheet
					routeName={active.routeName}
					totalMeters={total}
					elapsedSeconds={Math.max(1, (Date.now() - active.startedAtMs) / 1000)}
					formatDistanceParts={formatDistanceParts}
					onDone={dismiss}
				/>
			) : (
				<>
					<ManeuverBar
						status={engine.status}
						currentCue={currentCue}
						distanceLabel={
							engine.status === "offRoute"
								? offRouteHint
									? formatMeters(offRouteHint.meters, formatDistanceParts)
									: "—"
								: engine.status === "rejoining"
									? remainingLabel
									: toCueMeters != null
										? formatMeters(toCueMeters, formatDistanceParts)
										: remainingLabel
						}
						text={
							engine.status === "offRoute"
								? online
									? t("nav.offRouteRejoining")
									: t("nav.offRouteOffline")
								: engine.status === "rejoining"
									? t("nav.rejoining")
									: (currentCue?.text ?? t("nav.followRoute"))
						}
						bearing={offRouteHint?.bearing ?? null}
						muted={muted}
						onToggleMute={() => setMuted(!muted)}
					/>

					{!expanded && engine.status === "following" && thenCue && (
						<ThenStrip
							cue={thenCue}
							distance={formatMeters(
								Math.max(0, thenCue.distanceAlongMeters - engine.distanceAlongMeters),
								formatDistanceParts,
							)}
						/>
					)}

					{!expanded && (
						<>
							{speedParts && (
								<div style={styles.speedPill}>
									<div className="rds-mono" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
										{speedParts.value}
									</div>
									<div
										className="rds-mono"
										style={{ fontSize: 9, fontWeight: 500, color: RDS_COLORS.fgMuted, marginTop: 2 }}
									>
										{speedParts.unit}
									</div>
								</div>
							)}
							<button type="button" onClick={doOverview} title={t("nav.overview")} style={styles.fab}>
								<I.maximize size={20} />
							</button>
							{!follow && (
								<button type="button" onClick={() => setFollow(true)} style={styles.recenterPill}>
									<I.locate size={15} /> {t("nav.recenter")}
								</button>
							)}
						</>
					)}

					<NavSheet
						expanded={expanded}
						onToggle={() => setExpanded((v) => !v)}
						progress={progress}
						etaMinutes={etaMinutes}
						summary={`${remainingLabel} · ${t("nav.arrives", { time: etaClock })}`}
						confirmEnd={confirmEnd}
						onEnd={handleEnd}
						muted={muted}
						onToggleMute={() => setMuted(!muted)}
						onOverview={doOverview}
						onShare={shareEta}
						onReroute={requestRejoin}
						rerouteDisabled={!online}
						cues={active.cues}
						nextCueIndex={engine.nextCueIndex}
						distanceAlong={engine.distanceAlongMeters}
						routeName={active.routeName}
						formatDistanceParts={formatDistanceParts}
					/>
				</>
			)}
		</div>
	);
}

function ManeuverBar({
	status,
	currentCue,
	distanceLabel,
	text,
	bearing,
	muted,
	onToggleMute,
}: {
	status: string;
	currentCue: NavCue | null;
	distanceLabel: string;
	text: string;
	bearing: number | null;
	muted: boolean;
	onToggleMute: () => void;
}) {
	const offRoute = status === "offRoute";
	const [value, unit] = splitParts(distanceLabel);
	return (
		<div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 6 }}>
			<div
				style={{
					background: offRoute ? "#b45309" : RDS_COLORS.accent,
					color: RDS_COLORS.accentFg,
					borderBottomLeftRadius: 22,
					borderBottomRightRadius: 22,
					boxShadow: "0 8px 24px -8px rgba(0,0,0,0.4)",
					padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 16px",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 14 }}>
					<div
						style={{
							width: 56,
							height: 56,
							borderRadius: 16,
							background: "color-mix(in oklch, white 16%, transparent)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							flexShrink: 0,
						}}
					>
						{offRoute && bearing != null ? (
							<I.arrowUp size={32} style={{ transform: `rotate(${bearing}deg)` }} />
						) : (
							<CueIcon cue={currentCue} />
						)}
					</div>
					<div style={{ flex: 1, minWidth: 0 }}>
						<div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
							<span className="rds-mono" style={{ fontSize: 38, fontWeight: 700, lineHeight: 1, letterSpacing: -0.5 }}>
								{value}
							</span>
							{unit && <span style={{ fontSize: 18, fontWeight: 500, opacity: 0.85 }}>{unit}</span>}
						</div>
						<div
							style={{
								fontSize: 15.5,
								fontWeight: 500,
								marginTop: 4,
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{text}
						</div>
					</div>
					<button
						type="button"
						onClick={onToggleMute}
						aria-label="mute"
						style={{
							width: 40,
							height: 40,
							borderRadius: 12,
							border: 0,
							cursor: "pointer",
							background: muted ? "color-mix(in oklch, white 16%, transparent)" : "transparent",
							color: RDS_COLORS.accentFg,
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							flexShrink: 0,
							opacity: muted ? 0.7 : 1,
						}}
					>
						<I.bell size={18} />
					</button>
				</div>
			</div>
		</div>
	);
}

function ThenStrip({ cue, distance }: { cue: NavCue; distance: string }) {
	const t = useT();
	return (
		<div
			style={{
				position: "absolute",
				top: "calc(env(safe-area-inset-top, 0px) + 150px)",
				left: 14,
				right: 14,
				zIndex: 5,
				background: "color-mix(in oklch, var(--rds-bg-panel) 96%, transparent)",
				borderRadius: 14,
				boxShadow: "0 6px 18px -6px rgba(0,0,0,0.25)",
				padding: "10px 14px",
				display: "flex",
				alignItems: "center",
				gap: 12,
			}}
		>
			<span className="rds-mono" style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, color: RDS_COLORS.fgMuted }}>
				{t("nav.then").toUpperCase()}
			</span>
			<CueIcon cue={cue} size={16} color={RDS_COLORS.accent} />
			<span
				style={{
					fontSize: 13.5,
					fontWeight: 500,
					color: RDS_COLORS.fg,
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis",
				}}
			>
				{cue.text}
			</span>
			<span className="rds-mono" style={{ marginLeft: "auto", fontSize: 12, color: RDS_COLORS.fgMuted }}>
				{distance}
			</span>
		</div>
	);
}

function NavSheet(props: {
	expanded: boolean;
	onToggle: () => void;
	progress: number;
	etaMinutes: number;
	summary: string;
	confirmEnd: boolean;
	onEnd: () => void;
	muted: boolean;
	onToggleMute: () => void;
	onOverview: () => void;
	onShare: () => void;
	onReroute: () => void;
	rerouteDisabled: boolean;
	cues: NavCue[];
	nextCueIndex: number;
	distanceAlong: number;
	routeName: string;
	formatDistanceParts: (km: number) => { value: string; unit: string };
}) {
	const t = useT();
	const upcoming = props.cues.slice(props.nextCueIndex);

	return (
		<div
			style={{
				position: "absolute",
				left: 0,
				right: 0,
				bottom: 0,
				zIndex: 7,
				background: RDS_COLORS.bgPanel,
				borderTopLeftRadius: 26,
				borderTopRightRadius: 26,
				boxShadow: "0 -10px 30px -10px rgba(0,0,0,0.28)",
				maxHeight: props.expanded ? "72%" : undefined,
				display: "flex",
				flexDirection: "column",
				paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
			}}
		>
			<button
				type="button"
				onClick={props.onToggle}
				aria-label={props.expanded ? "collapse" : "expand"}
				style={{ background: "transparent", border: 0, cursor: "pointer", padding: "10px 0 4px" }}
			>
				<div style={{ width: 38, height: 5, borderRadius: 999, background: RDS_COLORS.border, margin: "0 auto" }} />
			</button>

			{!props.expanded && (
				<div style={{ padding: "4px 18px 0" }}>
					<div style={{ height: 4, borderRadius: 999, background: RDS_COLORS.bgInput, overflow: "hidden" }}>
						<div
							style={{ width: `${Math.round(props.progress * 100)}%`, height: "100%", background: RDS_COLORS.accent }}
						/>
					</div>
				</div>
			)}

			<div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px 0" }}>
				<div style={{ flex: 1 }}>
					<div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
						<span
							className="rds-mono"
							style={{ fontSize: props.expanded ? 24 : 30, fontWeight: 700, lineHeight: 1, color: RDS_COLORS.success }}
						>
							{props.etaMinutes}
						</span>
						<span style={{ fontSize: 16, fontWeight: 600, color: RDS_COLORS.success }}>{t("nav.min")}</span>
					</div>
					<div className="rds-mono" style={{ fontSize: 12.5, color: RDS_COLORS.fgMuted, marginTop: 5 }}>
						{props.summary}
					</div>
				</div>
				{!props.expanded && (
					<>
						<button type="button" onClick={props.onToggle} aria-label="expand" style={styles.roundBtn}>
							<I.chevronR size={18} style={{ transform: "rotate(-90deg)" }} />
						</button>
						<EndButton confirm={props.confirmEnd} onEnd={props.onEnd} compact />
					</>
				)}
			</div>

			{props.expanded && (
				<>
					<div style={{ display: "flex", gap: 8, padding: "14px 18px 0" }}>
						<QuickAction icon="maximize" label={t("nav.overview")} onClick={props.onOverview} />
						<QuickAction icon="bell" label={t("nav.mute")} active={props.muted} onClick={props.onToggleMute} />
						<QuickAction icon="share" label={t("nav.shareEta")} onClick={props.onShare} />
						<QuickAction
							icon="refresh"
							label={t("nav.reroute")}
							onClick={props.onReroute}
							disabled={props.rerouteDisabled}
						/>
					</div>

					<div
						className="rds-mono"
						style={{
							fontSize: 10,
							letterSpacing: 1,
							textTransform: "uppercase",
							color: RDS_COLORS.fgMuted,
							padding: "16px 20px 6px",
						}}
					>
						{t("nav.directions")}
					</div>
					<div style={{ flex: 1, overflow: "auto", padding: "0 12px", minHeight: 0 }}>
						{upcoming.map((cue, i) => {
							const dist = formatMeters(
								Math.max(0, cue.distanceAlongMeters - props.distanceAlong),
								props.formatDistanceParts,
							);
							const isCurrent = i === 0;
							return (
								<div key={`${cue.shapeIndex}-${cue.distanceAlongMeters}`}>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: 13,
											padding: "11px 12px",
											borderRadius: 14,
											background: isCurrent ? RDS_COLORS.accentSoft : "transparent",
										}}
									>
										<CueIcon cue={cue} size={22} color={isCurrent ? RDS_COLORS.accent : RDS_COLORS.fgMuted} />
										<div
											style={{
												flex: 1,
												minWidth: 0,
												fontSize: 14,
												fontWeight: isCurrent ? 600 : 500,
												whiteSpace: "nowrap",
												overflow: "hidden",
												textOverflow: "ellipsis",
											}}
										>
											{cue.text}
										</div>
										<span
											className="rds-mono"
											style={{
												fontSize: 13,
												fontWeight: isCurrent ? 600 : 400,
												color: isCurrent ? RDS_COLORS.accent : RDS_COLORS.fgMuted,
											}}
										>
											{dist}
										</span>
									</div>
									{i < upcoming.length - 1 && (
										<div style={{ height: 1, background: RDS_COLORS.border, margin: "2px 12px" }} />
									)}
								</div>
							);
						})}
						<div style={{ height: 1, background: RDS_COLORS.border, margin: "2px 12px" }} />
						<div style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 12px" }}>
							<I.pin size={22} style={{ color: RDS_COLORS.success }} />
							<div style={{ flex: 1, minWidth: 0 }}>
								<div style={{ fontSize: 14, fontWeight: 600 }}>{t("nav.arriveAt", { name: props.routeName })}</div>
								<div style={{ fontSize: 11.5, color: RDS_COLORS.fgSubtle }}>{t("nav.destination")}</div>
							</div>
						</div>
					</div>

					<div style={{ padding: "12px 18px 0", borderTop: `1px solid ${RDS_COLORS.border}`, marginTop: 4 }}>
						<EndButton confirm={props.confirmEnd} onEnd={props.onEnd} />
					</div>
				</>
			)}
		</div>
	);
}

function EndButton({ confirm, onEnd, compact }: { confirm: boolean; onEnd: () => void; compact?: boolean }) {
	const t = useT();
	return (
		<button
			type="button"
			onClick={onEnd}
			style={{
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				gap: 7,
				width: compact ? undefined : "100%",
				whiteSpace: "nowrap",
				fontSize: 15,
				fontWeight: 600,
				color: "white",
				background: RDS_COLORS.danger,
				border: 0,
				borderRadius: 14,
				padding: compact ? "12px 18px" : "13px 0",
				cursor: "pointer",
			}}
		>
			{compact && <I.close size={14} />}
			{confirm ? t("nav.endConfirm") : compact ? t("nav.end") : t("nav.endNavigation")}
		</button>
	);
}

function QuickAction({
	icon,
	label,
	active,
	disabled,
	onClick,
}: {
	icon: IconKey;
	label: string;
	active?: boolean;
	disabled?: boolean;
	onClick: () => void;
}) {
	const Icon = I[icon];
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			style={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 5,
				padding: "10px 0",
				borderRadius: 12,
				border: 0,
				cursor: disabled ? "not-allowed" : "pointer",
				opacity: disabled ? 0.45 : 1,
				background: active ? RDS_COLORS.accentSoft : RDS_COLORS.bgInput,
				color: active ? RDS_COLORS.accent : RDS_COLORS.fg,
			}}
		>
			<Icon size={19} />
			<span style={{ fontSize: 10.5, fontWeight: active ? 600 : 500 }}>{label}</span>
		</button>
	);
}

function ArrivalSheet({
	routeName,
	totalMeters,
	elapsedSeconds,
	formatDistanceParts,
	onDone,
}: {
	routeName: string;
	totalMeters: number;
	elapsedSeconds: number;
	formatDistanceParts: (km: number) => { value: string; unit: string };
	onDone: () => void;
}) {
	const t = useT();
	const dist = formatDistanceParts(totalMeters / 1000);
	const avgKmh = (totalMeters / 1000 / (elapsedSeconds / 3600)).toFixed(1);
	const stats: { value: string; label: string }[] = [
		{ value: dist.value, label: dist.unit.toUpperCase() },
		{ value: formatElapsed(elapsedSeconds), label: t("nav.time") },
		{ value: avgKmh, label: "KM/H" },
	];
	return (
		<div
			style={{
				position: "absolute",
				left: 0,
				right: 0,
				bottom: 0,
				zIndex: 8,
				background: RDS_COLORS.bgPanel,
				borderTopLeftRadius: 28,
				borderTopRightRadius: 28,
				boxShadow: "0 -10px 30px -10px rgba(0,0,0,0.25)",
				padding: "26px 22px calc(env(safe-area-inset-bottom, 0px) + 26px)",
			}}
		>
			<div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
				<div
					style={{
						width: 66,
						height: 66,
						borderRadius: "50%",
						background: `color-mix(in oklch, ${RDS_COLORS.success} 20%, transparent)`,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						marginBottom: 14,
					}}
				>
					<I.check size={34} style={{ color: RDS_COLORS.success }} />
				</div>
				<div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.3 }}>{t("nav.arrived")}</div>
				<div style={{ fontSize: 14, color: RDS_COLORS.fgMuted, marginTop: 4 }}>{routeName}</div>
			</div>
			<div style={{ display: "flex", gap: 10, margin: "22px 0" }}>
				{stats.map((s) => (
					<div
						key={s.label}
						style={{
							flex: 1,
							textAlign: "center",
							background: RDS_COLORS.bgInput,
							borderRadius: 14,
							padding: "13px 0",
						}}
					>
						<div className="rds-mono" style={{ fontSize: 19, fontWeight: 700 }}>
							{s.value}
						</div>
						<div className="rds-mono" style={{ fontSize: 10, color: RDS_COLORS.fgMuted, marginTop: 3 }}>
							{s.label}
						</div>
					</div>
				))}
			</div>
			<button
				type="button"
				onClick={onDone}
				style={{
					width: "100%",
					fontSize: 15,
					fontWeight: 600,
					color: RDS_COLORS.accentFg,
					background: RDS_COLORS.accent,
					border: 0,
					borderRadius: 14,
					padding: "13px 0",
					cursor: "pointer",
				}}
			>
				{t("nav.done")}
			</button>
		</div>
	);
}

function splitParts(formatted: string): [string, string] {
	const idx = formatted.lastIndexOf(" ");
	if (idx === -1) return [formatted, ""];
	return [formatted.slice(0, idx), formatted.slice(idx + 1)];
}

const styles: Record<string, CSSProperties> = {
	speedPill: {
		position: "absolute",
		left: 16,
		bottom: 210,
		zIndex: 5,
		background: RDS_COLORS.bgPanel,
		borderRadius: 16,
		boxShadow: "0 4px 12px -3px rgba(0,0,0,0.25)",
		padding: "8px 12px",
		textAlign: "center",
		minWidth: 64,
	},
	fab: {
		position: "absolute",
		right: 16,
		bottom: 250,
		zIndex: 5,
		width: 46,
		height: 46,
		borderRadius: "50%",
		background: RDS_COLORS.bgPanel,
		boxShadow: "0 4px 12px -3px rgba(0,0,0,0.25)",
		border: 0,
		cursor: "pointer",
		color: RDS_COLORS.fg,
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
	},
	recenterPill: {
		position: "absolute",
		left: "50%",
		transform: "translateX(-50%)",
		bottom: 214,
		zIndex: 6,
		background: RDS_COLORS.accent,
		color: RDS_COLORS.accentFg,
		border: 0,
		borderRadius: 999,
		boxShadow: "0 6px 16px -4px rgba(0,0,0,0.4)",
		padding: "9px 16px",
		display: "inline-flex",
		alignItems: "center",
		gap: 7,
		fontSize: 13,
		fontWeight: 600,
		cursor: "pointer",
	},
	roundBtn: {
		width: 44,
		height: 44,
		borderRadius: "50%",
		background: RDS_COLORS.bgInput,
		border: 0,
		cursor: "pointer",
		color: RDS_COLORS.fgMuted,
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
	},
};
