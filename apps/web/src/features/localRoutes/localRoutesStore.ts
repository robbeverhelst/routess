import type { Waypoint } from "@routess/core";
import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { waypointsEqual } from "@/features/routing/draftDirty";
import type { CreationSource } from "@/lib/analytics/events";
import type { CreateRouteRequest } from "@/lib/api";
import { Logger } from "@/lib/logger";
import { useRoutingStore } from "@/stores/routingStore";
import { createDefaultBackend, type LocalRoute, type LocalRouteBackend } from "./localRouteDb";

let backend: LocalRouteBackend | null = null;
const getBackend = (): LocalRouteBackend => {
	backend ??= createDefaultBackend();
	return backend;
};

// Tests swap in an in-memory backend.
export function setLocalRouteBackend(next: LocalRouteBackend): void {
	backend = next;
}

const newestFirst = (a: LocalRoute, b: LocalRoute) => b.updatedAt.localeCompare(a.updatedAt);

export interface SaveLocalRouteResult {
	localRoute: LocalRoute;
	// True when the save overwrote the LocalRoute the draft is bound to.
	isUpdate: boolean;
}

interface LocalRoutesState {
	routes: LocalRoute[];
	hydrated: boolean;
	// The LocalRoute the current draft was saved as or opened from, so saving
	// again updates it in place instead of piling up copies. Persisted (like
	// the draft itself) so it survives a reload.
	boundLocalId: string | null;
	// Undo depth at which a route was last loaded into the editor; undoing
	// below it brings back a draft from before that load.
	loadedAtUndoDepth: number;

	hydrate: () => Promise<void>;
	save: (route: CreateRouteRequest, creationSource: CreationSource) => Promise<SaveLocalRouteResult>;
	remove: (localId: string) => Promise<void>;
	bind: (localId: string | null) => void;
	// Another route was loaded into the editor: the draft is no longer the
	// LocalRoute it was bound to.
	draftReplaced: () => void;
}

export const useLocalRoutesStore = create<LocalRoutesState>()(
	persist(
		(set, get) => ({
			routes: [],
			hydrated: false,
			boundLocalId: null,
			loadedAtUndoDepth: 0,

			hydrate: async () => {
				try {
					const routes = await getBackend().list();
					set({ routes: routes.sort(newestFirst), hydrated: true });
				} catch (error) {
					Logger.error("[localRoutes] failed to read routes saved on this device:", error);
					set({ hydrated: true });
				}
			},

			save: async (route, creationSource) => {
				const { routes, boundLocalId } = get();
				const now = new Date().toISOString();
				const existing = boundLocalId ? routes.find((r) => r.localId === boundLocalId) : undefined;
				const localRoute: LocalRoute = existing
					? { ...existing, route, updatedAt: now }
					: { localId: crypto.randomUUID(), route, creationSource, createdAt: now, updatedAt: now };
				await getBackend().put(localRoute);
				set({
					routes: [localRoute, ...routes.filter((r) => r.localId !== localRoute.localId)],
					boundLocalId: localRoute.localId,
				});
				return { localRoute, isUpdate: !!existing };
			},

			remove: async (localId) => {
				await getBackend().delete(localId);
				set((s) => ({
					routes: s.routes.filter((r) => r.localId !== localId),
					boundLocalId: s.boundLocalId === localId ? null : s.boundLocalId,
				}));
			},

			bind: (boundLocalId) => set({ boundLocalId }),

			draftReplaced: () =>
				set({ boundLocalId: null, loadedAtUndoDepth: useRoutingStore.getState().history.past.length }),
		}),
		{
			name: "routess-local-routes",
			// The routes live in IndexedDB; only the draft binding is small
			// enough (and synchronous enough) for localStorage. The undo depth
			// persists with it because the undo history does too.
			partialize: (s) => ({ boundLocalId: s.boundLocalId, loadedAtUndoDepth: s.loadedAtUndoDepth }),
		},
	),
);

// A cleared draft, one bound to a saved account Route, or one undone back
// to before the last load is no longer the LocalRoute it came from.
useRoutingStore.subscribe((state, prev) => {
	const { past } = state.history;
	const undoDepth = past.length;
	// At the history cap the oldest snapshots are dropped, shifting the
	// depth the last load sits at.
	const dropped = undoDepth > 0 ? prev.history.past.indexOf(past[0]) : -1;
	if (dropped > 0) {
		useLocalRoutesStore.setState((s) => ({ loadedAtUndoDepth: Math.max(0, s.loadedAtUndoDepth - dropped) }));
	}
	if (undoDepth < useLocalRoutesStore.getState().loadedAtUndoDepth) {
		useLocalRoutesStore.setState({ boundLocalId: null, loadedAtUndoDepth: undoDepth });
		return;
	}
	if (!useLocalRoutesStore.getState().boundLocalId) return;
	const cleared = state.waypoints.length === 0 && prev.waypoints.length > 0;
	if (cleared || state.mode.kind === "editing") useLocalRoutesStore.getState().bind(null);
});

// The routes saved on this device, read from storage on first use.
export function useLocalRoutes(): { routes: LocalRoute[]; hydrated: boolean } {
	const routes = useLocalRoutesStore((s) => s.routes);
	const hydrated = useLocalRoutesStore((s) => s.hydrated);
	useEffect(() => {
		if (!useLocalRoutesStore.getState().hydrated) void useLocalRoutesStore.getState().hydrate();
	}, []);
	return { routes, hydrated };
}

export const useBoundLocalRoute = (): LocalRoute | null =>
	useLocalRoutesStore((s) => (s.boundLocalId ? (s.routes.find((r) => r.localId === s.boundLocalId) ?? null) : null));

// True when the draft is exactly what was last saved on this device, so
// replacing it loses nothing.
export function isDraftSavedLocally(waypoints: Waypoint[]): boolean {
	const { boundLocalId, routes } = useLocalRoutesStore.getState();
	const bound = boundLocalId ? routes.find((r) => r.localId === boundLocalId) : undefined;
	return !!bound && waypointsEqual(bound.route.waypoints, waypoints);
}
