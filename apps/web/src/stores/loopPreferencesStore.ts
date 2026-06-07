import { type Heading, isHeading, isSurfaceType, type SurfaceType } from "@routess/core";
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Where the loop starts. `center` resolves to the live map center at
// generate time; a `point` was explicitly chosen (geolocation or map pick).
// Session-only: a stale coordinate from last week is worse than the default.
export type LoopStart =
	| { kind: "center" }
	| { kind: "point"; coord: [number, number]; source: "geolocation" | "picked" };

interface LoopPreferencesState {
	distanceKm: number;
	heading: Heading;
	surface: SurfaceType;
	start: LoopStart;

	setDistanceKm: (v: number) => void;
	setHeading: (v: Heading) => void;
	setSurface: (v: SurfaceType) => void;
	setStart: (v: LoopStart) => void;
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
			distanceKm: 12,
			heading: "any",
			surface: "mixed",
			start: { kind: "center" },
			setDistanceKm: (distanceKm) => set({ distanceKm }),
			setHeading: (heading) => set({ heading }),
			setSurface: (surface) => set({ surface }),
			setStart: (start) => set({ start }),
		}),
		{
			name: "routess.redesign.loop-prefs",
			version: 2,
			partialize: (state) => ({
				distanceKm: state.distanceKm,
				heading: state.heading,
				surface: state.surface,
			}),
			migrate: (persisted, version) => {
				const state = (persisted ?? {}) as Record<string, unknown>;
				if (version >= 2) return state as unknown as LoopPreferencesState;
				const heading = V1_DIRECTION_TO_HEADING[String(state.direction)] ?? "any";
				const surface = V1_SURFACE_TO_SURFACE_TYPE[String(state.surface)] ?? "mixed";
				return {
					distanceKm: typeof state.distanceKm === "number" ? state.distanceKm : 12,
					heading: isHeading(heading) ? heading : "any",
					surface: isSurfaceType(surface) ? surface : "mixed",
				} as LoopPreferencesState;
			},
		},
	),
);
