import type { ApiDiscoverRoute } from "@routess/api-client";
import { create } from "zustand";

// Bridge between the Discover panel and the map (CONTEXT.md "Discover").
// The map writes the viewport bbox (debounced moveend); the panel queries with
// it and mirrors the results back so the map overlay can render markers and
// the hovered path. Nothing here is persisted.
interface DiscoverState {
	// 'minLng,minLat,maxLng,maxLat' of the current viewport, null until the
	// map reports one.
	viewportBbox: string | null;
	routes: ApiDiscoverRoute[];
	hoveredRouteId: number | null;

	setViewportBbox: (bbox: string | null) => void;
	setRoutes: (routes: ApiDiscoverRoute[]) => void;
	setHoveredRouteId: (id: number | null) => void;
}

export const useDiscoverStore = create<DiscoverState>()((set) => ({
	viewportBbox: null,
	routes: [],
	hoveredRouteId: null,

	setViewportBbox: (viewportBbox) => set({ viewportBbox }),
	setRoutes: (routes) => set({ routes }),
	setHoveredRouteId: (hoveredRouteId) => set({ hoveredRouteId }),
}));
