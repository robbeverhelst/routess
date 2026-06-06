import { create } from "zustand";

export type RedesignModal =
	| "save"
	| "loop"
	| "routing"
	| "share"
	| "import"
	| "confirm-delete"
	| "palette"
	| "search"
	| null;

export type RedesignOverlay = "layers" | "notifications" | null;

// What selecting a search result should do: just fly the map, or replace a
// route endpoint (loop = both endpoints share one anchor coordinate).
export type SearchIntent = "fly" | "replace-start" | "replace-end" | "replace-loop";

interface ModalsState {
	modal: RedesignModal;
	overlay: RedesignOverlay;
	deletingRouteId: number | null;
	searchIntent: SearchIntent;

	openModal: (m: Exclude<RedesignModal, null>) => void;
	closeModal: () => void;
	openOverlay: (o: Exclude<RedesignOverlay, null>) => void;
	closeOverlay: () => void;
	openDelete: (routeId: number) => void;
	openSearch: (intent: SearchIntent) => void;
}

export const useModalsStore = create<ModalsState>()((set) => ({
	modal: null,
	overlay: null,
	deletingRouteId: null,
	searchIntent: "fly",

	openModal: (m) => set({ modal: m, searchIntent: "fly" }),
	closeModal: () => set({ modal: null, deletingRouteId: null, searchIntent: "fly" }),
	openOverlay: (o) => set({ overlay: o }),
	closeOverlay: () => set({ overlay: null }),
	openDelete: (routeId) => set({ modal: "confirm-delete", deletingRouteId: routeId }),
	openSearch: (intent) => set({ modal: "search", searchIntent: intent }),
}));
