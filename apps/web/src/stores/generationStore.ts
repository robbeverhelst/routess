import type {
	Coordinate,
	GenerationFailureCode,
	Heading,
	RouteActivity,
	RouteGenerationType,
	RoutingPreferences,
	SurfaceType,
} from "@routess/core";
import { create } from "zustand";

// Client-side view of one GenerationCandidate (geometry already decoded).
export interface GenerationCandidateView {
	bearingDeg: number;
	viaPoints: Coordinate[];
	/** Parallel to viaPoints: Node ref / landmark name when the via has one. */
	viaMeta: ({ ref?: string; name?: string } | undefined)[];
	geometry: Coordinate[];
	distanceKm: number;
	durationSeconds: number;
	overlapPct: number;
	score: number;
	lowQuality: boolean;
	/** NetworkFit %, only present when knooppunt mode found a Node pool. */
	networkFitPct?: number;
	surfaceMetersByBucket: Record<"paved" | "compacted" | "unpaved" | "path", number>;
	/** Computed client-side after candidates arrive; null while sampling. */
	elevationGainM: number | null;
}

export interface GenerationRequestSnapshot {
	routeType: RouteGenerationType;
	start: Coordinate;
	/** A-to-b destination; absent for loops. */
	end?: Coordinate;
	activity: RouteActivity;
	targetDistanceKm: number;
	heading: Heading;
	surface: SurfaceType;
	preferNodeNetworks: boolean;
	/** Pinned must-pass landmarks sent as required anchors. */
	landmarks: { coord: Coordinate; name: string }[];
	/** The RoutingPreferences sent to the API; copied onto the draft on confirm (ADR-0023). */
	preferences: RoutingPreferences;
}

export type GenerationStatus = "idle" | "loading" | "ready" | "failed";

interface GenerationState {
	status: GenerationStatus;
	request: GenerationRequestSnapshot | null;
	candidates: GenerationCandidateView[];
	selectedIndex: number;
	failure: { code: GenerationFailureCode; bestOverlapPct?: number } | null;
	/** Bearings shown across this session's runs; regenerate excludes them. */
	shownBearings: number[];

	startLoading: (request: GenerationRequestSnapshot) => void;
	setCandidates: (candidates: GenerationCandidateView[]) => void;
	setCandidateElevation: (index: number, gainMeters: number) => void;
	setFailure: (failure: { code: GenerationFailureCode; bestOverlapPct?: number }) => void;
	select: (index: number) => void;
	dismiss: () => void;
}

const initial = {
	status: "idle" as GenerationStatus,
	request: null,
	candidates: [],
	selectedIndex: 0,
	failure: null,
	shownBearings: [],
};

export const useGenerationStore = create<GenerationState>()((set) => ({
	...initial,

	startLoading: (request) =>
		set((state) => ({
			status: "loading",
			request,
			candidates: [],
			selectedIndex: 0,
			failure: null,
			// A fresh request (different start/params) resets exclusions; a
			// regenerate keeps them so the fan explores new bearings.
			shownBearings: sameRequest(state.request, request) ? state.shownBearings : [],
		})),

	setCandidates: (candidates) =>
		set((state) => ({
			status: "ready",
			candidates,
			selectedIndex: 0,
			failure: null,
			shownBearings: [...state.shownBearings, ...candidates.map((c) => c.bearingDeg)],
		})),

	setCandidateElevation: (index, gainMeters) =>
		set((state) => ({
			candidates: state.candidates.map((c, i) => (i === index ? { ...c, elevationGainM: gainMeters } : c)),
		})),

	setFailure: (failure) => set({ status: "failed", failure, candidates: [], selectedIndex: 0 }),

	select: (selectedIndex) => set({ selectedIndex }),

	dismiss: () => set({ ...initial }),
}));

function sameRequest(a: GenerationRequestSnapshot | null, b: GenerationRequestSnapshot): boolean {
	if (!a) return false;
	return (
		a.routeType === b.routeType &&
		a.start[0] === b.start[0] &&
		a.start[1] === b.start[1] &&
		a.end?.[0] === b.end?.[0] &&
		a.end?.[1] === b.end?.[1] &&
		a.activity === b.activity &&
		a.targetDistanceKm === b.targetDistanceKm &&
		a.heading === b.heading &&
		a.surface === b.surface &&
		a.preferNodeNetworks === b.preferNodeNetworks
	);
}
