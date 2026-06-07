import {
	type Coordinate,
	decodePolyline6,
	defaultPreferencesForActivity,
	type GenerationFailureCode,
	type RouteActivity,
	type RoutingPreferences,
	type Waypoint,
} from "@routess/core";
import { trackEvent } from "@/lib/analytics/track";
import { Logger } from "@/lib/logger";
import { getRuntimeConfig } from "@/lib/runtime-config";
import {
	type GenerationCandidateView,
	type GenerationRequestSnapshot,
	useGenerationStore,
} from "@/stores/generationStore";
import { useLoopPreferencesStore } from "@/stores/loopPreferencesStore";
import { useRedesignSettingsStore } from "@/stores/redesignSettingsStore";
import { useRoutingStore } from "@/stores/routingStore";
import { useUiStore } from "@/stores/uiStore";
import { computeElevationForCandidate } from "./candidateElevation";

// Generation requests go through the API like routing does (ADR-0021 spirit,
// ADR-0029): the server runs the candidate fan next to Valhalla and returns
// scored candidates in one round trip.
const API_BASE_URL = getRuntimeConfig("VITE_API_URL") ?? "";
const GENERATION_URL = `${API_BASE_URL.replace(/\/+$/, "")}/api/v1/generation`;

interface ApiCandidate {
	bearingDeg: number;
	viaPoints: { lat: number; lon: number }[];
	shape: string;
	distanceKm: number;
	durationSeconds: number;
	overlapPct: number;
	score: number;
	lowQuality: boolean;
	surfaceMetersByBucket: Record<"paved" | "compacted" | "unpaved" | "path", number>;
}

interface ApiGenerateResponse {
	candidates: ApiCandidate[];
	failure?: { code: GenerationFailureCode; bestOverlapPct?: number };
}

function resolvePreferences(activity: RouteActivity): RoutingPreferences {
	const draftPrefs = useRoutingStore.getState().routingPreferences;
	if (draftPrefs) return draftPrefs;
	const userDefaults = useRedesignSettingsStore.getState().routingDefaults;
	return userDefaults?.[activity] ?? defaultPreferencesForActivity(activity);
}

function distanceBucket(targetKm: number): string {
	if (targetKm < 5) return "<5km";
	if (targetKm < 15) return "5-15km";
	if (targetKm < 30) return "15-30km";
	if (targetKm < 60) return "30-60km";
	return "60km+";
}

function durationBucket(ms: number): string {
	if (ms < 1000) return "<1s";
	if (ms < 3000) return "1-3s";
	if (ms < 8000) return "3-8s";
	return "8s+";
}

function deltaBucket(actualKm: number, targetKm: number): string {
	const pct = Math.abs(actualKm - targetKm) / targetKm;
	if (pct <= 0.05) return "<5%";
	if (pct <= 0.1) return "5-10%";
	if (pct <= 0.2) return "10-20%";
	return "20%+";
}

const FAILURE_TO_EVENT_REASON: Record<GenerationFailureCode, "no_route_found" | "provider_error" | "invalid_input"> = {
	invalid_input: "invalid_input",
	start_not_routable: "no_route_found",
	no_candidates_routable: "no_route_found",
	all_candidates_low_quality: "no_route_found",
	all_bearings_excluded: "no_route_found",
	provider_unavailable: "provider_error",
};

export async function startGeneration(start: Coordinate, options?: { regenerate?: boolean }): Promise<void> {
	const store = useGenerationStore.getState();
	const loopPrefs = useLoopPreferencesStore.getState();
	const activity = useUiStore.getState().activityType;
	const preferences = resolvePreferences(activity);

	// Generation biases costing toward the loop form's surface choice, not the
	// draft's previous surface preference.
	const requestPreferences: RoutingPreferences = { ...preferences, surfacePreference: loopPrefs.surface };

	const request: GenerationRequestSnapshot = {
		start,
		activity,
		targetDistanceKm: loopPrefs.distanceKm,
		heading: loopPrefs.heading,
		surface: loopPrefs.surface,
		preferences: requestPreferences,
	};

	const excludeBearings = options?.regenerate ? store.shownBearings : [];
	useGenerationStore.getState().startLoading(request);

	trackEvent({
		name: "route_generation_started",
		properties: {
			activity,
			route_type: "loop",
			target_distance_m_bucket: distanceBucket(loopPrefs.distanceKm),
			surface_type: loopPrefs.surface,
			heading: loopPrefs.heading,
		},
	});

	const startedAt = performance.now();
	let response: Response;
	try {
		response = await fetch(GENERATION_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({
				start: { lat: start[1], lon: start[0] },
				activity,
				targetDistanceKm: loopPrefs.distanceKm,
				heading: loopPrefs.heading,
				preferences: requestPreferences,
				...(excludeBearings.length > 0 ? { excludeBearings } : {}),
			}),
		});
	} catch (err) {
		Logger.warn("[Generation] transport failure:", err);
		failWith("provider_unavailable", activity);
		return;
	}

	if (!response.ok) {
		Logger.warn(`[Generation] API returned ${response.status}`);
		failWith(response.status === 400 ? "invalid_input" : "provider_unavailable", activity);
		return;
	}

	const data = (await response.json()) as ApiGenerateResponse;
	if (data.failure || data.candidates.length === 0) {
		const code = data.failure?.code ?? "no_candidates_routable";
		useGenerationStore.getState().setFailure({
			code,
			...(data.failure?.bestOverlapPct !== undefined ? { bestOverlapPct: data.failure.bestOverlapPct } : {}),
		});
		trackEvent({
			name: "route_generation_failed",
			properties: { activity, route_type: "loop", failure_reason: FAILURE_TO_EVENT_REASON[code] },
		});
		return;
	}

	const candidates: GenerationCandidateView[] = data.candidates.map((c) => ({
		bearingDeg: c.bearingDeg,
		viaPoints: c.viaPoints.map((p) => [p.lon, p.lat] as Coordinate),
		geometry: decodePolyline6(c.shape),
		distanceKm: c.distanceKm,
		durationSeconds: c.durationSeconds,
		overlapPct: c.overlapPct,
		score: c.score,
		lowQuality: c.lowQuality,
		surfaceMetersByBucket: c.surfaceMetersByBucket,
		elevationGainM: null,
	}));

	useGenerationStore.getState().setCandidates(candidates);

	trackEvent({
		name: "route_generation_succeeded",
		properties: {
			activity,
			route_type: "loop",
			candidate_count: candidates.length,
			duration_ms_bucket: durationBucket(performance.now() - startedAt),
			delta_from_target_pct_bucket: deltaBucket(candidates[0].distanceKm, loopPrefs.distanceKm),
		},
	});

	// Elevation per candidate samples in the background; the cards fill in.
	candidates.forEach((candidate, index) => {
		void computeElevationForCandidate(candidate.geometry).then((gain) => {
			if (gain !== null) useGenerationStore.getState().setCandidateElevation(index, gain);
		});
	});
}

function failWith(code: GenerationFailureCode, activity: RouteActivity): void {
	useGenerationStore.getState().setFailure({ code });
	trackEvent({
		name: "route_generation_failed",
		properties: { activity, route_type: "loop", failure_reason: FAILURE_TO_EVENT_REASON[code] },
	});
}

/** The Waypoints a confirmed candidate carries into the RouteDraft. */
export function candidateWaypoints(candidate: GenerationCandidateView): Waypoint[] {
	const start = candidate.geometry[0];
	return [
		{ coord: start, type: "routed" },
		...candidate.viaPoints.map((coord): Waypoint => ({ coord, type: "routed" })),
		{ coord: start, type: "routed" },
	];
}
