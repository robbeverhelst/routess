import type { ApiRoute } from "@routess/api-client";
import { create } from "zustand";

// Cross-tree state for the library panel: the selected route drives a
// non-destructive preview layer on the main map (LibraryRoutePreview), and
// sharedCollectionId carries a ?collection= deep link into the panel.
interface LibraryState {
	selectedRoute: ApiRoute | null;
	sharedCollectionId: number | null;

	selectRoute: (route: ApiRoute | null) => void;
	setSharedCollectionId: (id: number | null) => void;
}

export const useLibraryStore = create<LibraryState>()((set, get) => ({
	selectedRoute: null,
	sharedCollectionId: null,

	selectRoute: (route) => {
		// Clicking the selected card again deselects it.
		if (route && get().selectedRoute?.id === route.id) {
			set({ selectedRoute: null });
			return;
		}
		set({ selectedRoute: route });
	},
	setSharedCollectionId: (sharedCollectionId) => set({ sharedCollectionId }),
}));
