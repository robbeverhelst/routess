import { type Heading, isHeading, isSurfaceType, type RouteGenerationType, type SurfaceType } from "@routess/core";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Where the loop starts. `center` resolves to the live map center at
// generate time; a `point` was explicitly chosen (geolocation or map pick).
// Session-only: a stale coordinate from last week is worse than the default.
export type LoopStart =
	| { kind: "center" }
	| { kind: "point"; coord: [number, number]; source: "geolocation" | "picked" };

/** A pinned must-pass landmark (generation v2 slice: POI anchors). */
export interface GenerationLandmark {
	coord: [number, number];
	name: string;
}

export const MAX_LANDMARKS = 3;

interface LoopPreferencesState {
	routeType: RouteGenerationType;
	distanceKm: number;
	heading: Heading;
	surface: SurfaceType;
	start: LoopStart;
	/** A-to-b destination; same session-only semantics as start. */
	end: LoopStart;
	preferNodeNetworks: boolean;
	/** Session-only: pinned must-pass anchors for the next generation. */
	landmarks: GenerationLandmark[];

	setRouteType: (v: RouteGenerationType) => void;
	setDistanceKm: (v: number) => void;
	setHeading: (v: Heading) => void;
	setSurface: (v: SurfaceType) => void;
	setStart: (v: LoopStart) => void;
	setEnd: (v: LoopStart) => void;
	setPreferNodeNetworks: (v: boolean) => void;
	addLandmark: (v: GenerationLandmark) => void;
	removeLandmark: (index: number) => void;
}

// v1 persisted `direction: "any"|"n"|"e"|"s"|"w"` and a 4-value UI surface
// string; v2 speaks the domain vocabulary (Heading + SurfaceType).
const V1_DIRECTION_TO_HEADING: Record<string, Heading> = {
	any: "any",
	n: "north",
	e: "east",
	s: "south",
	w: "west",
};

const V1_SURFACE_TO_SURFACE_TYPE: Record<string, SurfaceType> = {
	Mixed: "mixed",
	"Roads only": "paved",
	Trails: "unpaved",
	"Paved bike paths": "paved",
};

export const useLoopPreferencesStore = create<LoopPreferencesState>()(
	persist(
		(set) => ({
			routeType: "loop",
			distanceKm: 12,
			heading: "any",
			surface: "mixed",
			start: { kind: "center" },
			end: { kind: "center" },
			preferNodeNetworks: false,
			landmarks: [],
			setRouteType: (routeType) => set({ routeType }),
			setDistanceKm: (distanceKm) => set({ distanceKm }),
			setHeading: (heading) => set({ heading }),
			setSurface: (surface) => set({ surface }),
			setStart: (start) => set({ start }),
			setEnd: (end) => set({ end }),
			setPreferNodeNetworks: (preferNodeNetworks) => set({ preferNodeNetworks }),
			addLandmark: (landmark) =>
				set((state) =>
					state.landmarks.length >= MAX_LANDMARKS ? state : { landmarks: [...state.landmarks, landmark] },
				),
			removeLandmark: (index) => set((state) => ({ landmarks: state.landmarks.filter((_, i) => i !== index) })),
		}),
		{
			name: "routess.redesign.loop-prefs",
			version: 3,
			partialize: (state) => ({
				routeType: state.routeType,
				distanceKm: state.distanceKm,
				heading: state.heading,
				surface: state.surface,
				preferNodeNetworks: state.preferNodeNetworks,
			}),
			migrate: (persisted, version) => {
				const state = (persisted ?? {}) as Record<string, unknown>;
				if (version >= 3) return state as unknown as LoopPreferencesState;
				if (version === 2) {
					return { ...state, routeType: "loop", preferNodeNetworks: false } as unknown as LoopPreferencesState;
				}
				const heading = V1_DIRECTION_TO_HEADING[String(state.direction)] ?? "any";
				const surface = V1_SURFACE_TO_SURFACE_TYPE[String(state.surface)] ?? "mixed";
				return {
					routeType: "loop",
					distanceKm: typeof state.distanceKm === "number" ? state.distanceKm : 12,
					heading: isHeading(heading) ? heading : "any",
					surface: isSurfaceType(surface) ? surface : "mixed",
					preferNodeNetworks: false,
				} as LoopPreferencesState;
			},
		},
	),
);
