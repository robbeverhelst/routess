import { formatDistance, formatDuration, type GenerationFailureCode, type SurfaceBucket } from "@routess/core";
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

const BUCKET_COLOR: Record<SurfaceBucket, string> = {
	paved: "oklch(0.45 0.02 240)",
	compacted: "oklch(0.72 0.07 75)",
	unpaved: "oklch(0.6 0.11 50)",
	path: "oklch(0.62 0.13 145)",
};

const FAILURE_MESSAGE_KEY: Record<GenerationFailureCode, string> = {
	invalid_input: "loop.failure.invalidInput",
	start_not_routable: "loop.failure.startNotRoutable",
	no_candidates_routable: "loop.failure.noCandidates",
	all_candidates_low_quality: "loop.failure.lowQuality",
	all_bearings_excluded: "loop.failure.fanExhausted",
	provider_unavailable: "loop.failure.providerDown",
};

function SurfaceBar({ meters }: { meters: Record<SurfaceBucket, number> }) {
	const total = meters.paved + meters.compacted + meters.unpaved + meters.path;
	if (total <= 0) return null;
	return (
		<div style={{ display: "flex", height: 4, borderRadius: 999, overflow: "hidden", width: "100%" }}>
			{(Object.keys(BUCKET_COLOR) as SurfaceBucket[]).map((bucket) =>
				meters[bucket] > 0 ? (
					<div key={bucket} style={{ width: `${(meters[bucket] / total) * 100}%`, background: BUCKET_COLOR[bucket] }} />
				) : null,
			)}
		</div>
	);
}

function CandidateCard({
	candidate,
	selected,
	onSelect,
	compact,
}: {
	candidate: GenerationCandidateView;
	selected: boolean;
	onSelect: () => void;
	compact?: boolean;
}) {
	const t = useT();
	return (
		<button
			type="button"
			onClick={onSelect}
			style={{
				display: "flex",
				flexDirection: "column",
				gap: 6,
				width: compact ? 136 : 148,
				flexShrink: 0,
				padding: "10px 12px",
				borderRadius: 10,
				background: selected ? RDS_COLORS.accentSoft : RDS_COLORS.bgPanel,
				border: selected ? `1px solid ${RDS_COLORS.accent}` : `1px solid ${RDS_COLORS.border}`,
				cursor: "pointer",
				textAlign: "left",
			}}
		>
			<div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
				<span className="rds-mono" style={{ fontSize: 15, fontWeight: 700, color: RDS_COLORS.fg }}>
					{formatDistance(candidate.distanceKm, { precision: 1 })}
				</span>
				<span style={{ fontSize: 11, color: RDS_COLORS.fgMuted }}>
					{formatDuration(candidate.durationSeconds / 60)}
				</span>
			</div>
			<div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: RDS_COLORS.fgMuted }}>
				<span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
					<I.mountain size={11} />
					{candidate.elevationGainM != null ? `${candidate.elevationGainM} m` : "…"}
				</span>
				{candidate.lowQuality ? (
					<span style={{ color: RDS_COLORS.warn, fontWeight: 600 }}>
						{t("loop.repeatedRoads", { pct: String(candidate.overlapPct) })}
					</span>
				) : null}
			</div>
			<SurfaceBar meters={candidate.surfaceMetersByBucket} />
		</button>
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
			void startGeneration(request.start);
		};
		const retryWith = (mutate: () => void) => () => {
			if (!request) return;
			mutate();
			void startGeneration(request.start);
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
		const result = await editor.loadWaypoints(candidateWaypoints(selected), {
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

	return (
		<div style={containerStyle}>
			<div style={panelStyle}>
				<div
					style={
						isMobile
							? {
									display: "flex",
									gap: 8,
									overflowX: "auto",
									WebkitOverflowScrolling: "touch",
									paddingBottom: 2,
									margin: "0 -4px",
									padding: "0 4px 2px",
								}
							: { display: "flex", gap: 8, justifyContent: "center" }
					}
				>
					{candidates.map((candidate, index) => (
						<CandidateCard
							key={candidate.bearingDeg}
							candidate={candidate}
							selected={index === selectedIndex}
							onSelect={() => useGenerationStore.getState().select(index)}
							compact={isMobile}
						/>
					))}
				</div>
				<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
					{isMobile ? (
						<>
							<Btn onClick={dismiss} style={{ width: 40, flexShrink: 0, justifyContent: "center", padding: 0 }}>
								<I.close size={14} />
							</Btn>
							{/* flex:1 + minWidth:0 lets the labels shrink/ellipsis instead of
							    pushing the buttons past the panel edge on narrow screens. */}
							<Btn onClick={regenerate} style={{ flex: 1, minWidth: 0, justifyContent: "center", padding: "0 10px" }}>
								<I.refresh size={13} />
								<span style={ELLIPSIS}>{t("loop.regenerate")}</span>
							</Btn>
							<Btn
								variant="primary"
								onClick={() => void confirm()}
								style={{ flex: 1, minWidth: 0, justifyContent: "center", padding: "0 10px" }}
							>
								<I.check size={13} />
								<span style={ELLIPSIS}>{t("loop.useRoute")}</span>
							</Btn>
						</>
					) : (
						<>
							<Btn onClick={dismiss}>{t("common.cancel")}</Btn>
							<Btn onClick={regenerate}>
								<I.refresh size={13} /> {t("loop.regenerate")}
							</Btn>
							<div style={{ flex: 1 }} />
							<Btn variant="primary" onClick={() => void confirm()}>
								<I.check size={13} /> {t("loop.useRoute")}
							</Btn>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
