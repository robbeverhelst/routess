import { formatDistance, formatDuration, type GenerationFailureCode, type SurfaceBucket } from "@routess/core";
import { surfaceBucketColors } from "@routess/design-tokens";
import { candidateWaypoints, startGeneration } from "@/features/generation/generationService";
import { useRouteDraftEditor } from "@/features/routing/RouteDraftEditorProvider";
import { useIsMobile } from "@/hooks/useViewport";
import { useT } from "@/lib/i18n";
import { type GenerationCandidateView, useGenerationStore } from "@/stores/generationStore";
import { useLoopPreferencesStore } from "@/stores/loopPreferencesStore";
import { useRoutingStore } from "@/stores/routingStore";
import { useToastStore } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";
import { I } from "../components/icons";
import { Btn, RDS_COLORS } from "../components/primitives";

// Truncate a button label so a long translation clips with an ellipsis rather
// than forcing the flex button past the modal edge on narrow screens.
const ELLIPSIS: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

const BUCKET_COLOR: Record<SurfaceBucket, string> = surfaceBucketColors;

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
function bearingToCompass(deg: number): string {
	return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// Project a candidate's lon/lat geometry into a small square SVG path for the
// card thumbnail. Equirectangular is fine at this scale; y is flipped for SVG.
function geometryPath(geometry: [number, number][], size: number, pad: number): string {
	if (!geometry || geometry.length < 2) return "";
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const [x, y] of geometry) {
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}
	const spanX = maxX - minX || 1;
	const spanY = maxY - minY || 1;
	const span = Math.max(spanX, spanY);
	const inner = size - pad * 2;
	const offX = pad + (inner - (spanX / span) * inner) / 2;
	const offY = pad + (inner - (spanY / span) * inner) / 2;
	return geometry
		.map(([x, y], i) => {
			const px = offX + ((x - minX) / span) * inner;
			const py = size - (offY + ((y - minY) / span) * inner);
			return `${i === 0 ? "M" : "L"}${px.toFixed(1)} ${py.toFixed(1)}`;
		})
		.join(" ");
}

type CandidateBadge = { label: string; bg: string; fg: string };
function candidateBadge(
	candidate: GenerationCandidateView,
	isBest: boolean,
	t: (k: string, r?: Record<string, string>) => string,
): CandidateBadge | null {
	if (candidate.lowQuality) {
		return {
			label: t("loop.moreBacktrack"),
			bg: `color-mix(in oklch, ${RDS_COLORS.warn} 16%, transparent)`,
			fg: RDS_COLORS.warn,
		};
	}
	if (candidate.networkFitPct !== undefined) {
		return {
			label: t("loop.onNodes", { pct: String(candidate.networkFitPct) }),
			bg: `color-mix(in oklch, ${RDS_COLORS.success} 16%, transparent)`,
			fg: `color-mix(in oklch, ${RDS_COLORS.success} 70%, ${RDS_COLORS.fg})`,
		};
	}
	if (isBest) {
		return { label: t("loop.bestMatch"), bg: RDS_COLORS.accentSoft, fg: RDS_COLORS.accentDeep };
	}
	return null;
}

const FAILURE_MESSAGE_KEY: Record<GenerationFailureCode, string> = {
	invalid_input: "loop.failure.invalidInput",
	start_not_routable: "loop.failure.startNotRoutable",
	end_not_routable: "loop.failure.endNotRoutable",
	no_candidates_routable: "loop.failure.noCandidates",
	all_candidates_low_quality: "loop.failure.lowQuality",
	all_bearings_excluded: "loop.failure.fanExhausted",
	provider_unavailable: "loop.failure.providerDown",
};

function SurfaceBar({ meters }: { meters: Record<SurfaceBucket, number> }) {
	const total = meters.paved + meters.compacted + meters.unpaved + meters.path;
	if (total <= 0) return null;
	return (
		<div style={{ display: "flex", height: 5, borderRadius: 999, overflow: "hidden", width: "100%" }}>
			{(Object.keys(BUCKET_COLOR) as SurfaceBucket[]).map((bucket) =>
				meters[bucket] > 0 ? (
					<div key={bucket} style={{ width: `${(meters[bucket] / total) * 100}%`, background: BUCKET_COLOR[bucket] }} />
				) : null,
			)}
		</div>
	);
}

// Small route-shape thumbnail for a candidate, with the start dot.
function CandidateThumb({ candidate, selected }: { candidate: GenerationCandidateView; selected: boolean }) {
	const size = 72;
	const d = geometryPath(candidate.geometry as [number, number][], size, 12);
	const stroke = selected ? RDS_COLORS.accent : RDS_COLORS.fgMuted;
	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			aria-hidden="true"
			style={{
				flexShrink: 0,
				borderRadius: 12,
				background: `color-mix(in oklch, ${RDS_COLORS.success} 12%, ${RDS_COLORS.bgPanelElev})`,
			}}
		>
			{d ? (
				<path d={d} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
			) : null}
			{candidate.geometry && candidate.geometry.length > 0
				? (() => {
						const full = geometryPath(candidate.geometry as [number, number][], size, 12);
						const m = full.match(/^M([\d.]+) ([\d.]+)/);
						return m ? (
							<circle cx={m[1]} cy={m[2]} r={4} fill={RDS_COLORS.success} stroke={RDS_COLORS.bgPanel} strokeWidth={2} />
						) : null;
					})()
				: null}
		</svg>
	);
}

function CandidateCard({
	candidate,
	selected,
	isBest,
	onSelect,
	onHover,
}: {
	candidate: GenerationCandidateView;
	selected: boolean;
	isBest: boolean;
	onSelect: () => void;
	onHover?: () => void;
}) {
	const t = useT();
	const badge = candidateBadge(candidate, isBest, t);
	return (
		<button
			type="button"
			onClick={onSelect}
			onMouseEnter={onHover}
			onFocus={onHover}
			style={{
				display: "flex",
				gap: 12,
				width: "100%",
				padding: 10,
				borderRadius: 14,
				background: RDS_COLORS.bgPanel,
				border: selected ? `2px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
				boxShadow: selected ? "var(--rds-shadow-sm)" : "none",
				cursor: "pointer",
				textAlign: "left",
				alignItems: "center",
			}}
		>
			<CandidateThumb candidate={candidate} selected={selected} />
			<div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
					{badge ? (
						<span
							className="rds-mono"
							style={{
								fontSize: 10,
								fontWeight: 700,
								letterSpacing: 0.4,
								textTransform: "uppercase",
								color: badge.fg,
								background: badge.bg,
								borderRadius: 5,
								padding: "2px 7px",
							}}
						>
							{badge.label}
						</span>
					) : null}
					<span style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>
						{t("loop.heads", { dir: bearingToCompass(candidate.bearingDeg) })}
					</span>
				</div>
				<div
					className="rds-mono"
					style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: RDS_COLORS.fg }}
				>
					<span>{formatDistance(candidate.distanceKm, { precision: 1 })}</span>
					<span style={{ color: RDS_COLORS.border }}>·</span>
					<span>{formatDuration(candidate.durationSeconds / 60)}</span>
					<span style={{ color: RDS_COLORS.border }}>·</span>
					<span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
						<I.arrowUp size={11} style={{ transform: "rotate(45deg)" }} />
						{candidate.elevationGainM != null ? `${candidate.elevationGainM} m` : "…"}
					</span>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<div style={{ flex: 1, minWidth: 0 }}>
						<SurfaceBar meters={candidate.surfaceMetersByBucket} />
					</div>
					<span
						className="rds-mono"
						style={{ fontSize: 10, color: candidate.lowQuality ? RDS_COLORS.warn : RDS_COLORS.fgSubtle, flexShrink: 0 }}
					>
						{t("loop.repeat", { pct: String(candidate.overlapPct) })}
					</span>
				</div>
				<NodeSequence candidate={candidate} />
			</div>
		</button>
	);
}

// The knooppunt sequence a candidate rides ("via 45 → 52 → 67"), plus the
// NetworkFit share when knooppunt mode was active.
function NodeSequence({ candidate }: { candidate: GenerationCandidateView }) {
	const t = useT();
	const refs = candidate.viaMeta.map((meta) => meta?.ref).filter((ref): ref is string => ref !== undefined);
	if (refs.length === 0 && candidate.networkFitPct === undefined) return null;
	return (
		<div
			style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: RDS_COLORS.fgSubtle, ...ELLIPSIS }}
		>
			{refs.length > 0 ? <span style={ELLIPSIS}>{t("loop.viaNodes", { seq: refs.join(" → ") })}</span> : null}
			{candidate.networkFitPct !== undefined ? (
				<span className="rds-mono" style={{ flexShrink: 0 }}>
					{t("loop.networkFit", { pct: String(candidate.networkFitPct) })}
				</span>
			) : null}
		</div>
	);
}

// The GenerationCandidate picker: loading pill, up to 3 candidate cards with
// confirm/regenerate, or a structured failure with retry suggestion chips.
// Lives inside the map subtree so the RouteDraftEditor context is available.
export function GenerationOverlay() {
	const t = useT();
	const status = useGenerationStore((s) => s.status);
	const candidates = useGenerationStore((s) => s.candidates);
	const selectedIndex = useGenerationStore((s) => s.selectedIndex);
	const failure = useGenerationStore((s) => s.failure);
	const request = useGenerationStore((s) => s.request);
	const editor = useRouteDraftEditor();
	const pushToast = useToastStore((s) => s.push);
	const isMobile = useIsMobile();
	const panelCollapsed = useUiStore((s) => s.panelCollapsed);

	if (status === "idle") return null;

	// On mobile the picker is a full-width sheet docked above the tab bar; on
	// desktop a floating panel centered over the VISIBLE map: the sidebar is a
	// sibling of the map container with a higher stacking context, so the
	// picker must shift right of it rather than rely on z-index.
	const sidebarOpen = !isMobile && !panelCollapsed;
	const containerStyle: React.CSSProperties = isMobile
		? {
				position: "absolute",
				bottom: "max(86px, calc(var(--rds-safe-bottom) + 82px))",
				left: "max(10px, var(--rds-safe-left))",
				right: "max(10px, var(--rds-safe-right))",
				zIndex: 30,
				display: "flex",
				flexDirection: "column",
				gap: 10,
			}
		: {
				position: "absolute",
				bottom: 24,
				left: sidebarOpen ? "calc((100% + var(--rds-panel-w)) / 2)" : "50%",
				transform: "translateX(-50%)",
				zIndex: 30,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: 10,
				maxWidth: sidebarOpen ? "min(calc(100% - var(--rds-panel-w) - 32px), 560px)" : "min(92vw, 560px)",
			};

	const panelStyle: React.CSSProperties = {
		background: RDS_COLORS.bgPanel,
		border: `1px solid ${RDS_COLORS.border}`,
		borderRadius: 12,
		boxShadow: "var(--rds-shadow-lg, 0 8px 30px rgba(0,0,0,0.25))",
		padding: 12,
		display: "flex",
		flexDirection: "column",
		gap: 10,
	};

	if (status === "loading") {
		return (
			<div style={containerStyle}>
				<div style={{ ...panelStyle, flexDirection: "row", alignItems: "center", gap: 8, padding: "10px 16px" }}>
					<I.compass size={14} />
					<span style={{ fontSize: 12.5, color: RDS_COLORS.fgMuted }}>{t("loop.generating")}</span>
				</div>
			</div>
		);
	}

	const dismiss = () => useGenerationStore.getState().dismiss();

	if (status === "failed" && failure) {
		const retry = () => {
			if (!request) return;
			void startGeneration(request.start, request.end ? { end: request.end } : undefined);
		};
		const retryWith = (mutate: () => void) => () => {
			if (!request) return;
			mutate();
			void startGeneration(request.start, request.end ? { end: request.end } : undefined);
		};
		const chips: { key: string; label: string; onClick: () => void }[] = [];
		if (request) {
			if (failure.code === "provider_unavailable") {
				chips.push({ key: "retry", label: t("loop.retry"), onClick: retry });
			}
			if (
				(failure.code === "no_candidates_routable" || failure.code === "all_candidates_low_quality") &&
				request.heading !== "any"
			) {
				chips.push({
					key: "any-direction",
					label: t("loop.tryAnyDirection"),
					onClick: retryWith(() => useLoopPreferencesStore.getState().setHeading("any")),
				});
			}
			if (failure.code === "no_candidates_routable" || failure.code === "all_candidates_low_quality") {
				const shorter = Math.max(1, Math.round(request.targetDistanceKm * 0.6));
				chips.push({
					key: "shorter",
					label: t("loop.tryShorter", { km: String(shorter) }),
					onClick: retryWith(() => useLoopPreferencesStore.getState().setDistanceKm(shorter)),
				});
			}
			if (failure.code === "all_bearings_excluded") {
				// A fresh (non-regenerate) run resets the shown-bearing exclusions.
				chips.push({ key: "fresh", label: t("loop.startFresh"), onClick: retry });
			}
		}

		return (
			<div style={containerStyle}>
				<div style={panelStyle}>
					<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<span style={{ fontSize: 12.5, color: RDS_COLORS.fg }}>{t(FAILURE_MESSAGE_KEY[failure.code])}</span>
						<div style={{ flex: 1 }} />
						<button
							type="button"
							onClick={dismiss}
							aria-label={t("common.close")}
							style={{ background: "transparent", border: 0, color: RDS_COLORS.fgMuted, cursor: "pointer" }}
						>
							<I.close size={13} />
						</button>
					</div>
					{chips.length > 0 ? (
						<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
							{chips.map((chip) => (
								<button
									key={chip.key}
									type="button"
									onClick={chip.onClick}
									style={{
										height: 28,
										padding: "0 12px",
										borderRadius: 999,
										background: RDS_COLORS.bgInput,
										border: `1px solid ${RDS_COLORS.border}`,
										color: RDS_COLORS.fg,
										fontSize: 11.5,
										cursor: "pointer",
									}}
								>
									{chip.label}
								</button>
							))}
						</div>
					) : null}
				</div>
			</div>
		);
	}

	if (status !== "ready" || candidates.length === 0) return null;

	const selected = candidates[selectedIndex] ?? candidates[0];

	const confirm = async () => {
		if (!editor || !request) return;
		const result = await editor.loadWaypoints(candidateWaypoints(selected, request.routeType), {
			exactRoutePath: selected.geometry,
			saveSnapshot: true,
		});
		if (!result.success) {
			pushToast({ kind: "danger", title: result.message ?? t("common.tryAgain") });
			return;
		}
		const store = useRoutingStore.getState();
		store.setActivity(request.activity);
		store.setRoutingPreferences(request.preferences);
		store.setCreationSource("generated");
		// The candidate's routed metrics beat the straight-line estimate that
		// exact-path loading falls back to.
		store.setRouteMetrics({
			distanceMeters: Math.round(selected.distanceKm * 1000),
			durationSeconds: Math.round(selected.durationSeconds),
			isOffline: false,
		});
		useGenerationStore.getState().dismiss();
	};

	const regenerate = () => {
		if (!request) return;
		void startGeneration(request.start, { regenerate: true });
	};

	const typeLabel = request?.routeType === "a-to-b" ? t("loop.tab.atob") : t("loop.tab.loop");
	const summary = request
		? t("loop.candidatesSummary", {
				type: typeLabel,
				km: String(request.targetDistanceKm),
				surface: t(`loop.surface.${request.surface}`).toLowerCase(),
			})
		: "";

	return (
		<div style={containerStyle}>
			<div style={{ ...panelStyle, width: isMobile ? undefined : 360, gap: 12 }}>
				<div>
					<div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
						<span
							style={{
								fontFamily: "'Bricolage Grotesque', sans-serif",
								fontSize: 19,
								fontWeight: 700,
								color: RDS_COLORS.fg,
							}}
						>
							{t("loop.pickRoute")}
						</span>
						<div style={{ flex: 1 }} />
						<span className="rds-mono" style={{ fontSize: 11, color: RDS_COLORS.fgSubtle }}>
							{t("loop.countOf", { n: String(selectedIndex + 1), total: String(candidates.length) })}
						</span>
					</div>
					{summary ? <div style={{ fontSize: 12.5, color: RDS_COLORS.fgMuted, marginTop: 2 }}>{summary}</div> : null}
				</div>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 10,
						maxHeight: isMobile ? 320 : 420,
						overflowY: "auto",
					}}
				>
					{candidates.map((candidate, index) => (
						<CandidateCard
							key={candidate.bearingDeg}
							candidate={candidate}
							selected={index === selectedIndex}
							isBest={index === 0}
							onSelect={() => useGenerationStore.getState().select(index)}
							onHover={isMobile ? undefined : () => useGenerationStore.getState().select(index)}
						/>
					))}
				</div>
				<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
					<Btn variant="primary" onClick={() => void confirm()} style={{ flex: 1, justifyContent: "center" }}>
						<I.check size={13} /> {t("loop.useRoute")}
					</Btn>
					<Btn onClick={regenerate} style={{ flexShrink: 0 }}>
						<I.refresh size={13} /> {t("loop.newOptions")}
					</Btn>
					<Btn
						onClick={dismiss}
						style={{ width: 40, flexShrink: 0, justifyContent: "center", padding: 0 }}
						title={t("common.close")}
					>
						<I.close size={14} />
					</Btn>
				</div>
			</div>
		</div>
	);
}
