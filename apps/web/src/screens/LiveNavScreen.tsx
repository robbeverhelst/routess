import { calculateBearing, formatDuration, type NavCue, projectOntoPath } from "@routess/core";
import { useEffect, useState } from "react";
import { NavMap } from "@/features/navigation/NavMap";
import { useNavigationController } from "@/features/navigation/useNavigationController";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useT } from "@/lib/i18n";
import { useUnits } from "@/lib/units";
import { useNavigationStore } from "@/stores/navigationStore";
import { I } from "../components/icons";
import { Btn, IconBtn, RDS_COLORS, SecTitle } from "../components/primitives";

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

function CueIcon({ cue, size = 32 }: { cue: NavCue | null; size?: number }) {
	if (!cue) return <I.arrowUp size={size} />;
	if (cue.kind === "node") return <I.target size={size} />;
	if (cue.maneuverType != null && DESTINATION_TYPES.has(cue.maneuverType)) return <I.flag size={size} />;
	const rotation = cue.maneuverType != null ? (MANEUVER_ROTATION[cue.maneuverType] ?? 0) : 0;
	return <I.arrowUp size={size} style={{ transform: `rotate(${rotation}deg)` }} />;
}

function formatMeters(meters: number, formatKm: (km: number) => { value: string; unit: string }): string {
	if (meters < 950) return `${Math.max(0, Math.round(meters / 10) * 10)} m`;
	const parts = formatKm(meters / 1000);
	return `${parts.value} ${parts.unit}`;
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
	const etaMs = Date.now() + (remaining / speedMps) * 1000;
	const eta = new Date(etaMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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
	const elapsedMinutes = Math.max(1, Math.round((Date.now() - active.startedAtMs) / 60000));

	const handleEnd = () => {
		if (ended) {
			dismiss();
			return;
		}
		// Ending right at the start or after arrival needs no second tap.
		if (!confirmEnd && progress > 0.02) {
			setConfirmEnd(true);
			return;
		}
		dismiss();
	};

	const STATS = [
		{ label: t("nav.remaining"), ...splitParts(formatMeters(remaining, formatDistanceParts)) },
		{ label: t("nav.eta"), value: eta, unit: "" },
		{
			label: t("nav.speed"),
			value: speedParts ? speedParts.value : "—",
			unit: speedParts ? speedParts.unit : "",
		},
	];

	return (
		<div style={{ position: "absolute", inset: 0, background: RDS_COLORS.bgCanvas, overflow: "hidden" }}>
			<div style={{ position: "absolute", inset: 0 }}>
				<NavMap
					path={active.path}
					rejoinPath={engine.rejoin?.path ?? null}
					puck={lastFix?.coord ?? null}
					headingDeg={lastFix?.headingDeg ?? null}
					follow={follow && !ended}
					onUserPan={() => setFollow(false)}
				/>
			</div>

			<div
				style={{
					position: "absolute",
					top: "calc(env(safe-area-inset-top, 0px) + 16px)",
					left: 16,
					right: 16,
					zIndex: 5,
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 16,
						padding: "16px 20px",
						borderRadius: 14,
						background: engine.status === "offRoute" ? "#b45309" : RDS_COLORS.accent,
						color: RDS_COLORS.accentFg,
						boxShadow: "var(--rds-shadow-lg)",
					}}
				>
					<div
						style={{
							width: 56,
							height: 56,
							borderRadius: 12,
							background: "color-mix(in oklch, white 18%, transparent)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							flexShrink: 0,
						}}
					>
						{engine.status === "offRoute" && offRouteHint ? (
							<I.arrowUp size={32} style={{ transform: `rotate(${offRouteHint.bearing}deg)` }} />
						) : (
							<CueIcon cue={currentCue} />
						)}
					</div>
					<div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
						{engine.status === "offRoute" ? (
							<>
								<div className="rds-mono" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1, letterSpacing: -0.5 }}>
									{offRouteHint ? formatMeters(offRouteHint.meters, formatDistanceParts) : "—"}
								</div>
								<div style={{ fontSize: 14, opacity: 0.92, marginTop: 4 }}>
									{online ? t("nav.offRouteRejoining") : t("nav.offRouteOffline")}
								</div>
							</>
						) : engine.status === "rejoining" ? (
							<>
								<div className="rds-mono" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1, letterSpacing: -0.5 }}>
									{formatMeters(remaining, formatDistanceParts)}
								</div>
								<div style={{ fontSize: 14, opacity: 0.92, marginTop: 4 }}>{t("nav.rejoining")}</div>
							</>
						) : (
							<>
								<div className="rds-mono" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1, letterSpacing: -0.5 }}>
									{toCueMeters != null
										? formatMeters(toCueMeters, formatDistanceParts)
										: formatMeters(remaining, formatDistanceParts)}
								</div>
								<div
									style={{
										fontSize: 14,
										opacity: 0.92,
										marginTop: 4,
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{currentCue?.text ?? t("nav.followRoute")}
								</div>
							</>
						)}
					</div>
					<IconBtn
						title={muted ? t("nav.unmute") : t("nav.mute")}
						pressed={!muted}
						onClick={() => setMuted(!muted)}
						style={{ width: 40, height: 40, color: RDS_COLORS.accentFg }}
					>
						<I.bell size={16} />
					</IconBtn>
				</div>
				{thenCue && engine.status === "following" && (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 12,
							marginTop: 6,
							padding: "10px 16px",
							background: RDS_COLORS.bgPanel,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 12,
							boxShadow: "var(--rds-shadow-sm)",
						}}
					>
						<SecTitle>{t("nav.then")}</SecTitle>
						<CueIcon cue={thenCue} size={14} />
						<div
							style={{
								fontSize: 13,
								color: RDS_COLORS.fgMuted,
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							{thenCue.text}
						</div>
					</div>
				)}
				{active.degraded && (
					<div
						style={{
							marginTop: 6,
							padding: "8px 16px",
							background: RDS_COLORS.bgPanel,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 12,
							fontSize: 12.5,
							color: RDS_COLORS.fgMuted,
						}}
					>
						{t("nav.degraded")}
					</div>
				)}
			</div>

			{!follow && !ended && (
				<button
					type="button"
					onClick={() => setFollow(true)}
					style={{
						position: "absolute",
						bottom: 190,
						left: "50%",
						transform: "translateX(-50%)",
						zIndex: 6,
						display: "flex",
						alignItems: "center",
						gap: 8,
						padding: "8px 16px",
						borderRadius: 999,
						background: RDS_COLORS.accent,
						color: RDS_COLORS.accentFg,
						border: 0,
						fontSize: 13,
						fontWeight: 600,
						boxShadow: "var(--rds-shadow-lg)",
						cursor: "pointer",
					}}
				>
					<I.locate size={14} /> {t("nav.recenter")}
				</button>
			)}

			{ended && engine.arrived && (
				<div
					style={{
						position: "absolute",
						inset: 0,
						zIndex: 10,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						background: "color-mix(in oklch, var(--rds-bg-canvas) 55%, transparent)",
					}}
				>
					<div
						style={{
							background: RDS_COLORS.bgPanel,
							border: `1px solid ${RDS_COLORS.border}`,
							borderRadius: 16,
							boxShadow: "var(--rds-shadow-lg)",
							padding: 28,
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 12,
							maxWidth: 340,
							textAlign: "center",
						}}
					>
						<I.flag size={28} style={{ color: RDS_COLORS.accent }} />
						<div style={{ fontSize: 20, fontWeight: 700 }}>{t("nav.arrived")}</div>
						<div style={{ fontSize: 13.5, color: RDS_COLORS.fgMuted }}>
							{t("nav.arrivedBody", {
								distance: formatMeters(engine.distanceAlongMeters, formatDistanceParts),
								duration: formatDuration(elapsedMinutes),
							})}
						</div>
						<Btn variant="primary" onClick={dismiss} style={{ marginTop: 8 }}>
							{t("nav.done")}
						</Btn>
					</div>
				</div>
			)}

			<div
				style={{
					position: "absolute",
					bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
					left: 16,
					right: 16,
					zIndex: 5,
				}}
			>
				<div
					style={{
						background: RDS_COLORS.bgPanel,
						border: `1px solid ${RDS_COLORS.border}`,
						borderRadius: 16,
						boxShadow: "var(--rds-shadow-lg)",
						overflow: "hidden",
					}}
				>
					<div style={{ height: 4, background: RDS_COLORS.bgInput }}>
						<div
							style={{
								height: "100%",
								width: `${Math.round(progress * 100)}%`,
								background: RDS_COLORS.accent,
								transition: "width 600ms ease",
							}}
						/>
					</div>
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: 18 }}>
						{STATS.map((s, i) => (
							<div
								key={s.label}
								style={{ borderLeft: i ? `1px solid ${RDS_COLORS.border}` : "none", paddingLeft: i ? 16 : 0 }}
							>
								<SecTitle>{s.label}</SecTitle>
								<div className="rds-mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 4, lineHeight: 1 }}>
									{s.value}
									{s.unit && (
										<span style={{ fontSize: 11, color: RDS_COLORS.fgSubtle, marginLeft: 4, fontWeight: 400 }}>
											{s.unit}
										</span>
									)}
								</div>
							</div>
						))}
					</div>
					<div style={{ display: "flex", gap: 8, padding: "0 18px 18px", flexWrap: "wrap" }}>
						<Btn onClick={() => setMuted(!muted)} variant={muted ? "primary" : undefined}>
							<I.bell size={14} /> {muted ? t("nav.unmute") : t("nav.mute")}
						</Btn>
						<Btn onClick={requestRejoin} disabled={!online || ended}>
							<I.refresh size={14} /> {t("nav.reroute")}
						</Btn>
						<div style={{ flex: 1 }} />
						<Btn variant="danger" onClick={handleEnd}>
							{ended ? t("nav.done") : confirmEnd ? t("nav.endConfirm") : t("nav.end")}
						</Btn>
					</div>
				</div>
			</div>
		</div>
	);
}

function splitParts(formatted: string): { value: string; unit: string } {
	const idx = formatted.lastIndexOf(" ");
	if (idx === -1) return { value: formatted, unit: "" };
	return { value: formatted.slice(0, idx), unit: formatted.slice(idx + 1) };
}
