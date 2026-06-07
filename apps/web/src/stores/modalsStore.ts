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

// One-shot deep link into the Social panel (a notification pointing at the
// inbox or at a profile). SocialPanel consumes and clears it.
export type SocialPanelRequest = { tab: "feed" | "inbox" | "following" } | { profile: string } | null;

interface ModalsState {
	modal: RedesignModal;
	overlay: RedesignOverlay;
	deletingRouteId: number | null;
	// Share a specific saved route without loading it into the planner.
	sharingRouteId: number | null;
	searchIntent: SearchIntent;
	socialRequest: SocialPanelRequest;

	openModal: (m: Exclude<RedesignModal, null>) => void;
	closeModal: () => void;
	openOverlay: (o: Exclude<RedesignOverlay, null>) => void;
	closeOverlay: () => void;
	openDelete: (routeId: number) => void;
	openShare: (routeId: number) => void;
	openSearch: (intent: SearchIntent) => void;
	requestSocialPanel: (r: Exclude<SocialPanelRequest, null>) => void;
	clearSocialRequest: () => void;
}

export const useModalsStore = create<ModalsState>()((set) => ({
	modal: null,
	overlay: null,
	deletingRouteId: null,
	sharingRouteId: null,
	searchIntent: "fly",
	socialRequest: null,

	openModal: (m) => set({ modal: m, sharingRouteId: null, searchIntent: "fly" }),
	closeModal: () => set({ modal: null, deletingRouteId: null, sharingRouteId: null, searchIntent: "fly" }),
	openOverlay: (o) => set({ overlay: o }),
	closeOverlay: () => set({ overlay: null }),
	openDelete: (routeId) => set({ modal: "confirm-delete", deletingRouteId: routeId }),
	openShare: (routeId) => set({ modal: "share", sharingRouteId: routeId }),
	openSearch: (intent) => set({ modal: "search", searchIntent: intent }),
	requestSocialPanel: (socialRequest) => set({ socialRequest }),
	clearSocialRequest: () => set({ socialRequest: null }),
}));
