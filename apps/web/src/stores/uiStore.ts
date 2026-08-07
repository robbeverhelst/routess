import type { RouteActivity } from "@routess/core";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
	loadLanguageFromLocalStorage,
	saveLanguageToLocalStorage,
} from "@/features/routing/services/LocalStorageService";
import type { SupportedLanguage } from "@/lib/i18n";

export type RedesignContext = "plan" | "library" | "discover" | "social" | "settings";
export type RedesignAccent = "violet" | "cobalt" | "forest" | "ember";
export type RedesignTheme = "light" | "dark";
export type RedesignActivity = RouteActivity;

interface UiState {
	context: RedesignContext;
	accent: RedesignAccent;
	theme: RedesignTheme;
	// Default activity used when there's no per-draft activity yet (fresh
	// drafts, the SaveModal "Activity" picker, the welcome screen). Loading a
	// saved Route does not overwrite this; per-route activity lives on the
	// RouteDraft (see packages/core RouteDraftMode).
	activityType: RedesignActivity;
	language: SupportedLanguage;
	panelCollapsed: boolean;
	favouriteRouteIds: number[];

	setContext: (c: RedesignContext) => void;
	setAccent: (a: RedesignAccent) => void;
	setTheme: (t: RedesignTheme) => void;
	toggleTheme: () => void;
	setActivityType: (a: RedesignActivity) => void;
	setLanguage: (l: SupportedLanguage) => void;
	togglePanel: () => void;
	setPanelCollapsed: (v: boolean) => void;
	toggleFavourite: (routeId: number) => void;
}

// context is widened to string on purpose: migrations compare against legacy
// values ("activity", "explore") that the current union no longer contains.
// Intersecting with Partial<UiState> would re-narrow it, so omit it first.
type PersistedUiState = Omit<Partial<UiState>, "context"> & {
	context?: string;
	loadedRoute?: unknown;
	welcomeCompleted?: unknown;
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
		}),
		{
			name: "routess-redesign-ui",
			version: 5,
			migrate: (persistedState) => {
				const state = (persistedState ?? {}) as PersistedUiState;
				if (state.context === "activity") {
					state.context = "social";
				}
				if (state.context === "explore") {
					state.context = "discover";
				}
				// v4 drops loadedRoute (moved into routingStore as RouteDraftMode).
				delete state.loadedRoute;
				// v5 drops welcomeCompleted (welcome wizard removed).
				delete state.welcomeCompleted;
				return state as UiState;
			},
		},
	),
);
