import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RoutingProfile = "fast" | "scenic" | "safe" | "flat";

export interface RoutingPreferences {
	profile: RoutingProfile;
	bike: boolean;
	climbs: boolean;
	climbGradient: number;
	unpaved: boolean;
	highways: boolean;
	snap: boolean;
}

interface RoutingPreferencesState extends RoutingPreferences {
	setProfile: (profile: RoutingProfile) => void;
	setBike: (bike: boolean) => void;
	setClimbs: (climbs: boolean) => void;
	setClimbGradient: (gradient: number) => void;
	setUnpaved: (unpaved: boolean) => void;
	setHighways: (highways: boolean) => void;
	setSnap: (snap: boolean) => void;
	reset: () => void;
}

export const DEFAULT_ROUTING_PREFERENCES: RoutingPreferences = {
	profile: "scenic",
	bike: true,
	climbs: true,
	climbGradient: 6,
	unpaved: false,
	highways: true,
	snap: true,
};

export const MIN_CLIMB_GRADIENT = 2;
export const MAX_CLIMB_GRADIENT = 15;

export const useRoutingPreferencesStore = create<RoutingPreferencesState>()(
	persist(
		(set) => ({
			...DEFAULT_ROUTING_PREFERENCES,
			setProfile: (profile) => set({ profile }),
			setBike: (bike) => set({ bike }),
			setClimbs: (climbs) => set({ climbs }),
			setClimbGradient: (climbGradient) => set({ climbGradient }),
			setUnpaved: (unpaved) => set({ unpaved }),
			setHighways: (highways) => set({ highways }),
			setSnap: (snap) => set({ snap }),
			reset: () => set({ ...DEFAULT_ROUTING_PREFERENCES }),
		}),
		{
			name: "routess.redesign.routing-prefs",
			version: 1,
		},
	),
);

export function getRoutingPreferences(): RoutingPreferences {
	const s = useRoutingPreferencesStore.getState();
	return {
		profile: s.profile,
		bike: s.bike,
		climbs: s.climbs,
		climbGradient: s.climbGradient,
		unpaved: s.unpaved,
		highways: s.highways,
		snap: s.snap,
	};
}
