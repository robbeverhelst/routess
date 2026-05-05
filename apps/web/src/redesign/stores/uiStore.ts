import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RedesignContext = "plan" | "library" | "discover" | "social" | "settings";
export type RedesignAccent = "violet" | "cobalt" | "forest" | "ember";
export type RedesignTheme = "light" | "dark";
export type RedesignActivity = "run" | "cycle" | "walk";

interface UiState {
	context: RedesignContext;
	accent: RedesignAccent;
	theme: RedesignTheme;
	activityType: RedesignActivity;
	panelCollapsed: boolean;
	favouriteRouteIds: number[];
	welcomeCompleted: boolean;

	setContext: (c: RedesignContext) => void;
	setAccent: (a: RedesignAccent) => void;
	setTheme: (t: RedesignTheme) => void;
	toggleTheme: () => void;
	setActivityType: (a: RedesignActivity) => void;
	togglePanel: () => void;
	setPanelCollapsed: (v: boolean) => void;
	toggleFavourite: (routeId: number) => void;
	completeWelcome: () => void;
}

type PersistedUiState = Partial<UiState> & {
	context?: string;
};

export const useUiStore = create<UiState>()(
	persist(
		(set, get) => ({
			context: "plan",
			accent: "violet",
			theme: "light",
			activityType: "cycle",
			panelCollapsed: false,
			favouriteRouteIds: [],
			welcomeCompleted: false,

			setContext: (context) => set({ context }),
			setAccent: (accent) => set({ accent }),
			setTheme: (theme) => set({ theme }),
			toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
			setActivityType: (activityType) => set({ activityType }),
			togglePanel: () => set({ panelCollapsed: !get().panelCollapsed }),
			setPanelCollapsed: (panelCollapsed) => set({ panelCollapsed }),
			toggleFavourite: (routeId) => {
				const cur = get().favouriteRouteIds;
				set({
					favouriteRouteIds: cur.includes(routeId) ? cur.filter((id) => id !== routeId) : [...cur, routeId],
				});
			},
			completeWelcome: () => set({ welcomeCompleted: true }),
		}),
		{
			name: "routess-redesign-ui",
			version: 3,
			migrate: (persistedState) => {
				const state = (persistedState ?? {}) as PersistedUiState;
				if (state.context === "activity") {
					state.context = "social";
				}
				if (state.context === "explore") {
					state.context = "discover";
				}
				return state as UiState;
			},
		},
	),
);
