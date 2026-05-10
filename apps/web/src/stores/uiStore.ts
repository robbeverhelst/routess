import type { RouteActivity, RoutePrivacy } from "@routess/core";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
	loadLanguageFromLocalStorage,
	saveLanguageToLocalStorage,
} from "@/features/routing/services/LocalStorageService";
import type { ApiRoute, Waypoint } from "@/lib/api";
import type { SupportedLanguage } from "@/lib/i18n";

export type RedesignContext = "plan" | "library" | "discover" | "social" | "settings";
export type RedesignAccent = "violet" | "cobalt" | "forest" | "ember";
export type RedesignTheme = "light" | "dark";
export type RedesignActivity = RouteActivity;

export interface LoadedRoute {
	id: number;
	name: string;
	baselineName: string;
	activity?: RouteActivity;
	privacy?: RoutePrivacy;
	tags?: string[];
	description?: string;
	waypoints: Waypoint[];
}

export function apiRouteToLoadedRoute(route: ApiRoute): LoadedRoute {
	return {
		id: route.id,
		name: route.name,
		baselineName: route.name,
		activity: route.activity,
		privacy: route.privacy,
		tags: route.tags,
		description: route.description,
		waypoints: route.waypoints,
	};
}

interface UiState {
	context: RedesignContext;
	accent: RedesignAccent;
	theme: RedesignTheme;
	activityType: RedesignActivity;
	language: SupportedLanguage;
	panelCollapsed: boolean;
	favouriteRouteIds: number[];
	welcomeCompleted: boolean;
	// Tracks the saved route currently being edited in the plan panel. Null
	// means the user is composing a fresh route. Not persisted: waypoints in
	// the routing store don't persist either, so a reload starts clean.
	loadedRoute: LoadedRoute | null;

	setContext: (c: RedesignContext) => void;
	setAccent: (a: RedesignAccent) => void;
	setTheme: (t: RedesignTheme) => void;
	toggleTheme: () => void;
	setActivityType: (a: RedesignActivity) => void;
	setLanguage: (l: SupportedLanguage) => void;
	togglePanel: () => void;
	setPanelCollapsed: (v: boolean) => void;
	toggleFavourite: (routeId: number) => void;
	completeWelcome: () => void;
	setLoadedRoute: (route: LoadedRoute | null) => void;
	setLoadedRouteName: (name: string) => void;
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
			language: loadLanguageFromLocalStorage(),
			panelCollapsed: false,
			favouriteRouteIds: [],
			welcomeCompleted: false,
			loadedRoute: null,

			setContext: (context) => set({ context }),
			setAccent: (accent) => set({ accent }),
			setTheme: (theme) => set({ theme }),
			toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
			setActivityType: (activityType) => set({ activityType }),
			setLanguage: (language) => {
				saveLanguageToLocalStorage(language);
				set({ language });
			},
			togglePanel: () => set({ panelCollapsed: !get().panelCollapsed }),
			setPanelCollapsed: (panelCollapsed) => set({ panelCollapsed }),
			toggleFavourite: (routeId) => {
				const cur = get().favouriteRouteIds;
				set({
					favouriteRouteIds: cur.includes(routeId) ? cur.filter((id) => id !== routeId) : [...cur, routeId],
				});
			},
			completeWelcome: () => set({ welcomeCompleted: true }),
			setLoadedRoute: (loadedRoute) => set({ loadedRoute }),
			setLoadedRouteName: (name) => {
				const trimmed = name.trim();
				if (!trimmed) return;
				const cur = get().loadedRoute;
				if (!cur || cur.name === trimmed) return;
				set({ loadedRoute: { ...cur, name: trimmed } });
			},
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
			partialize: (state) => {
				const { loadedRoute: _omit, ...rest } = state;
				return rest;
			},
		},
	),
);
