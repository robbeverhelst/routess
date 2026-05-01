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

interface ModalsState {
	modal: RedesignModal;
	overlay: RedesignOverlay;
	deletingRouteId: number | null;

	openModal: (m: Exclude<RedesignModal, null>) => void;
	closeModal: () => void;
	openOverlay: (o: Exclude<RedesignOverlay, null>) => void;
	closeOverlay: () => void;
	openDelete: (routeId: number) => void;
}

export const useModalsStore = create<ModalsState>()((set) => ({
	modal: null,
	overlay: null,
	deletingRouteId: null,

	openModal: (m) => set({ modal: m }),
	closeModal: () => set({ modal: null, deletingRouteId: null }),
	openOverlay: (o) => set({ overlay: o }),
	closeOverlay: () => set({ overlay: null }),
	openDelete: (routeId) => set({ modal: "confirm-delete", deletingRouteId: routeId }),
}));
