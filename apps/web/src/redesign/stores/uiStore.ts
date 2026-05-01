import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RedesignContext = "plan" | "library" | "activity" | "settings";
export type RedesignAccent = "violet" | "cobalt" | "forest" | "ember";
export type RedesignDensity = "compact" | "default" | "comfy";
export type RedesignTheme = "light" | "dark";
export type RedesignActivity = "run" | "cycle" | "walk";
export type RedesignLayout = "sidebar" | "floating" | "bottom";

interface UiState {
	context: RedesignContext;
	accent: RedesignAccent;
	density: RedesignDensity;
	theme: RedesignTheme;
	activityType: RedesignActivity;
	layout: RedesignLayout;
	panelCollapsed: boolean;
	favouriteRouteIds: number[];
	welcomeCompleted: boolean;

	setContext: (c: RedesignContext) => void;
	setAccent: (a: RedesignAccent) => void;
	setDensity: (d: RedesignDensity) => void;
	setTheme: (t: RedesignTheme) => void;
	toggleTheme: () => void;
	setActivityType: (a: RedesignActivity) => void;
	setLayout: (l: RedesignLayout) => void;
	togglePanel: () => void;
	setPanelCollapsed: (v: boolean) => void;
	toggleFavourite: (routeId: number) => void;
	completeWelcome: () => void;
}

export const useUiStore = create<UiState>()(
	persist(
		(set, get) => ({
			context: "plan",
			accent: "violet",
			density: "default",
			theme: "light",
			activityType: "cycle",
			layout: "sidebar",
			panelCollapsed: false,
			favouriteRouteIds: [],
			welcomeCompleted: false,

			setContext: (context) => set({ context }),
			setAccent: (accent) => set({ accent }),
			setDensity: (density) => set({ density }),
			setTheme: (theme) => set({ theme }),
			toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
			setActivityType: (activityType) => set({ activityType }),
			setLayout: (layout) => set({ layout }),
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
		},
	),
);
