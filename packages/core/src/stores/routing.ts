import { create } from "zustand";
import { type PersistOptions, persist } from "zustand/middleware";
import type { Coordinate, Logger, Waypoint, WaypointHistory, WaypointType } from "../types";

// ===== STATE & ACTIONS =====

export interface RouteState {
	waypoints: Waypoint[];
	routePath: Coordinate[];

	routeDistance: string;
	routeDuration: string;
	hasRoute: boolean;

	isMapLocked: boolean;

	undoStack: WaypointHistory[];
	redoStack: WaypointHistory[];
	canUndo: boolean;
	canRedo: boolean;

	shareNotification: string;
	displayedShareUrl: string | null;
	showRouteInfoError: boolean;
	routeInfoErrorMessage: string;
}

export interface RouteActions {
	addWaypoint: (coord: Coordinate, type: WaypointType) => void;
	removeWaypoint: (index: number) => void;
	setWaypoints: (waypoints: Waypoint[]) => void;
	updateWaypointCoords: (coords: Coordinate[]) => void;
	setWaypointType: (index: number, type: WaypointType) => void;
	clearWaypoints: () => void;

	setRoutePath: (routePath: Coordinate[]) => void;
	clearRoutePath: () => void;

	setRouteDistance: (distance: string) => void;
	setRouteDuration: (duration: string) => void;
	setHasRoute: (hasRoute: boolean) => void;

	setIsMapLocked: (isLocked: boolean) => void;

	saveSnapshot: () => void;
	undo: () => void;
	redo: () => void;
	clearHistory: () => void;

	setShareNotification: (message: string) => void;
	setDisplayedShareUrl: (url: string | null) => void;
	setShowRouteInfoError: (show: boolean) => void;
	setRouteInfoErrorMessage: (message: string) => void;
	clearShareState: () => void;
}

export type RoutingStore = RouteState & RouteActions;

// ===== INITIAL STATE =====

const initialState: RouteState = {
	waypoints: [],
	routePath: [],
	routeDistance: "",
	routeDuration: "",
	hasRoute: false,
	isMapLocked: false,
	undoStack: [],
	redoStack: [],
	canUndo: false,
	canRedo: false,
	shareNotification: "",
	displayedShareUrl: null,
	showRouteInfoError: false,
	routeInfoErrorMessage: "",
};

// ===== PERSISTENCE MIGRATION =====

// v0 stored waypoints as Coordinate[] alongside a parallel directFlags: boolean[].
// v1 collapses both into Waypoint[] = { coord, type }[].
type LegacyRouteSnapshot = {
	waypoints?: Coordinate[];
	directFlags?: boolean[];
	timestamp?: number;
};

type LegacyPersistedRoute = {
	waypoints?: Coordinate[];
	directFlags?: boolean[];
	undoStack?: LegacyRouteSnapshot[];
	redoStack?: LegacyRouteSnapshot[];
	[key: string]: unknown;
};

const migrateWaypoints = (coords: Coordinate[] = [], flags: boolean[] = []): Waypoint[] =>
	coords.map((coord, i) => ({ coord, type: flags[i] ? "direct" : "routed" }));

const migrateSnapshot = (snap: LegacyRouteSnapshot | undefined): WaypointHistory => ({
	waypoints: migrateWaypoints(snap?.waypoints ?? [], snap?.directFlags ?? []),
	timestamp: snap?.timestamp ?? Date.now(),
});

const migrateLegacyPersistedState = (persisted: LegacyPersistedRoute): Partial<RouteState> => {
	const { waypoints, directFlags, undoStack, redoStack, ...rest } = persisted;
	return {
		...(rest as Partial<RouteState>),
		waypoints: migrateWaypoints(waypoints ?? [], directFlags ?? []),
		undoStack: (undoStack ?? []).map(migrateSnapshot),
		redoStack: (redoStack ?? []).map(migrateSnapshot),
	};
};

// ===== STORE FACTORY =====

export function createRoutingStore(logger: Logger) {
	const persistConfig: PersistOptions<RoutingStore, Partial<RouteState>> = {
		name: "routing-store",
		version: 1,
		migrate: (persisted, version) => {
			if (version >= 1) return persisted as Partial<RouteState>;
			return migrateLegacyPersistedState((persisted ?? {}) as LegacyPersistedRoute);
		},
		partialize: (state) => ({
			waypoints: state.waypoints,
			routePath: state.routePath,
			routeDistance: state.routeDistance,
			routeDuration: state.routeDuration,
			hasRoute: state.hasRoute,
			isMapLocked: state.isMapLocked,
			undoStack: state.undoStack,
			redoStack: state.redoStack,
			canUndo: state.canUndo,
			canRedo: state.canRedo,
			shareNotification: state.shareNotification,
			displayedShareUrl: state.displayedShareUrl,
			showRouteInfoError: state.showRouteInfoError,
			routeInfoErrorMessage: state.routeInfoErrorMessage,
		}),
	};

	return create<RoutingStore>()(
		persist(
			(set) => ({
				...initialState,

				// === WAYPOINTS ===
				addWaypoint: (coord, type) => {
					logger.info("[RoutingStore] Adding waypoint:", coord, "type:", type);
					set((state) => ({ waypoints: [...state.waypoints, { coord, type }] }));
				},

				removeWaypoint: (index) => {
					logger.info("[RoutingStore] Removing waypoint at index:", index);
					set((state) => ({ waypoints: state.waypoints.filter((_, i) => i !== index) }));
				},

				setWaypoints: (waypoints) => {
					logger.info("[RoutingStore] Setting waypoints:", waypoints.length);
					set({ waypoints });
				},

				updateWaypointCoords: (coords) => {
					logger.info("[RoutingStore] Updating waypoint coords:", coords.length);
					set((state) => ({
						waypoints: state.waypoints.map((wp, i) => (i < coords.length ? { ...wp, coord: coords[i] } : wp)),
					}));
				},

				setWaypointType: (index, type) => {
					set((state) => ({
						waypoints: state.waypoints.map((wp, i) => (i === index ? { ...wp, type } : wp)),
					}));
				},

				clearWaypoints: () => {
					logger.info("[RoutingStore] Clearing waypoints");
					set({
						waypoints: [],
						routePath: [],
						routeDistance: "",
						routeDuration: "",
						hasRoute: false,
					});
				},

				// === ROUTE PATH ===
				setRoutePath: (routePath) => {
					set({ routePath });
				},

				clearRoutePath: () => {
					set({ routePath: [] });
				},

				// === ROUTE INFO ===
				setRouteDistance: (distance) => {
					set({ routeDistance: distance });
				},

				setRouteDuration: (duration) => {
					set({ routeDuration: duration });
				},

				setHasRoute: (hasRoute) => {
					set({ hasRoute });
				},

				// === MAP CONFIG ===
				setIsMapLocked: (isLocked) => {
					set({ isMapLocked: isLocked });
				},

				// === HISTORY ===
				saveSnapshot: () => {
					set((state) => {
						const snapshot: WaypointHistory = {
							waypoints: state.waypoints.map((wp) => ({ ...wp })),
							timestamp: Date.now(),
						};
						logger.info("[RoutingStore] Saving snapshot:", snapshot.waypoints.length, "waypoints");
						return {
							undoStack: [...state.undoStack, snapshot],
							redoStack: [],
							canUndo: true,
							canRedo: false,
						};
					});
				},

				undo: () => {
					set((state) => {
						if (state.undoStack.length === 0) {
							logger.warn("[RoutingStore] No actions to undo");
							return state;
						}
						const previous = state.undoStack[state.undoStack.length - 1];
						const current: WaypointHistory = {
							waypoints: state.waypoints.map((wp) => ({ ...wp })),
							timestamp: Date.now(),
						};
						logger.info("[RoutingStore] Undo: ", state.waypoints.length, "->", previous.waypoints.length, "waypoints");
						return {
							waypoints: previous.waypoints,
							undoStack: state.undoStack.slice(0, -1),
							redoStack: [...state.redoStack, current],
							canUndo: state.undoStack.length > 1,
							canRedo: true,
						};
					});
				},

				redo: () => {
					set((state) => {
						if (state.redoStack.length === 0) {
							logger.warn("[RoutingStore] No actions to redo");
							return state;
						}
						const current: WaypointHistory = {
							waypoints: state.waypoints.map((wp) => ({ ...wp })),
							timestamp: Date.now(),
						};
						const next = state.redoStack[state.redoStack.length - 1];
						logger.info("[RoutingStore] Redo to snapshot from:", new Date(next.timestamp));
						return {
							waypoints: next.waypoints,
							undoStack: [...state.undoStack, current],
							redoStack: state.redoStack.slice(0, -1),
							canUndo: true,
							canRedo: state.redoStack.length > 1,
						};
					});
				},

				clearHistory: () => {
					logger.info("[RoutingStore] Clearing history");
					set({ undoStack: [], redoStack: [], canUndo: false, canRedo: false });
				},

				// === SHARE / ERROR ===
				setShareNotification: (message) => set({ shareNotification: message }),
				setDisplayedShareUrl: (url) => set({ displayedShareUrl: url }),
				setShowRouteInfoError: (show) => set({ showRouteInfoError: show }),
				setRouteInfoErrorMessage: (message) => set({ routeInfoErrorMessage: message }),
				clearShareState: () =>
					set({
						shareNotification: "",
						displayedShareUrl: null,
						showRouteInfoError: false,
						routeInfoErrorMessage: "",
					}),
			}),
			persistConfig,
		),
	);
}

// Selector hooks live with their consumers — see apps/web/src/stores/routingStore.ts.
// Keep this module focused on the store itself.
