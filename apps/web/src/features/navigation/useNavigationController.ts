import {
	advanceNavigation,
	applyRejoin,
	createNavigationContext,
	forceRejoin,
	type NavigationContext,
	type NavigationEffect,
	type PositionFix,
	remainingMeters,
} from "@routess/core";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { computeRoute } from "@/features/routing/services/valhallaClient";
import { useWakeLock } from "@/hooks/useWakeLock";
import { t } from "@/lib/i18n";
import { Logger } from "@/lib/logger";
import { type LocationState, locationService } from "@/services/LocationService";
import { useNavigationStore } from "@/stores/navigationStore";
import { useUiStore } from "@/stores/uiStore";
import { speak, stopSpeech } from "./speech";

// Hosts the dirty edges around the pure engine (ADR 0038): geolocation in,
// speech and the Rejoin routing call out. The engine itself never sees a
// browser API.

const DEFAULT_REJOIN_PREFERENCES = {
	surfacePreference: "mixed" as const,
	avoidFerries: false,
	avoidHighways: true,
};

export interface NavigationController {
	context: NavigationContext | null;
	remaining: number;
	requestRejoin: () => void;
}

export function useNavigationController(): NavigationController {
	const active = useNavigationStore((s) => s.active);
	const lastFix = useNavigationStore((s) => s.lastFix);
	const muted = useNavigationStore((s) => s.muted);
	const language = useUiStore((s) => s.language);

	const mutedRef = useRef(muted);
	mutedRef.current = muted;
	const languageRef = useRef(language);
	languageRef.current = language;
	// One Rejoin request in flight at a time; a 1 Hz GPS stream re-emitting
	// requestRejoin must not stack API calls.
	const rejoinInFlight = useRef(false);

	const running = !!active && active.engine.status !== "ended";
	useWakeLock(running);

	const context = useMemo(() => {
		if (!active) return null;
		return createNavigationContext(active.path, active.cues);
	}, [active]);

	const sayCue = useCallback((text: string) => {
		if (!mutedRef.current) speak(text, languageRef.current);
	}, []);

	const handleEffects = useCallback(
		(ctx: NavigationContext, effects: NavigationEffect[]) => {
			const store = useNavigationStore.getState();
			for (const effect of effects) {
				switch (effect.type) {
					case "announceCue": {
						const cue = ctx.cues[effect.cueIndex];
						if (cue) sayCue(cue.text);
						break;
					}
					case "offRoute":
						sayCue(t("nav.offRouteSpoken"));
						break;
					case "backOnRoute":
						sayCue(t("nav.backOnRouteSpoken"));
						break;
					case "arrived":
						sayCue(t("nav.arrivedSpoken"));
						break;
					case "requestRejoin": {
						if (rejoinInFlight.current) break;
						rejoinInFlight.current = true;
						const activity = store.active?.activity ?? "cycle";
						computeRoute(
							[
								{ coord: effect.from, type: "routed" },
								{ coord: effect.target, type: "routed" },
							],
							activity,
							DEFAULT_REJOIN_PREFERENCES,
							{ snap: false },
						)
							.then((outcome) => {
								const current = useNavigationStore.getState();
								if (!current.active || current.active.engine.status === "ended") return;
								// An offline direct-line "route" is not a Rejoin; the
								// session stays offRoute and the UI shows the bearing
								// arrow instead (ADR 0038: offline degrades honestly).
								if (!outcome.ok || outcome.offline || outcome.routePath.length < 2) {
									Logger.warn("[Navigation] Rejoin unavailable:", outcome.ok ? "offline" : outcome.error);
									return;
								}
								current.setEngine(
									applyRejoin(current.active.engine, outcome.routePath, effect.targetDistanceAlongMeters),
								);
								sayCue(t("nav.rejoinSpoken"));
							})
							.catch((err) => Logger.warn("[Navigation] Rejoin request failed:", err))
							.finally(() => {
								rejoinInFlight.current = false;
							});
						break;
					}
				}
			}
		},
		[sayCue],
	);

	// GPS in: every fix advances the engine. The subscription, not React
	// renders, drives the session.
	useEffect(() => {
		if (!context || !running) return;

		const onLocationUpdate = (state: LocationState) => {
			if (!state.location || state.timestamp == null) return;
			const fix: PositionFix = {
				coord: state.location,
				timestampMs: state.timestamp,
				speedMps: state.speed,
				headingDeg: state.heading,
				accuracyMeters: state.accuracy,
			};
			const store = useNavigationStore.getState();
			if (!store.active || store.active.engine.status === "ended") return;
			store.setLastFix(fix);
			const result = advanceNavigation(context, store.active.engine, fix);
			if (result.state !== store.active.engine) store.setEngine(result.state);
			handleEffects(context, result.effects);
		};

		const unsubscribe = locationService.subscribe({ onLocationUpdate });
		locationService.startTracking({ enableHighAccuracy: true });
		return () => {
			unsubscribe();
			locationService.stopTracking();
			stopSpeech();
		};
	}, [context, running, handleEffects]);

	const requestRejoin = useCallback(() => {
		const store = useNavigationStore.getState();
		if (!context || !store.active || !store.lastFix) return;
		const result = forceRejoin(context, store.active.engine, store.lastFix);
		store.setEngine(result.state);
		handleEffects(context, result.effects);
	}, [context, handleEffects]);

	const remaining = context && active ? remainingMeters(context, active.engine, lastFix ?? undefined) : 0;

	return { context, remaining, requestRejoin };
}
