import { create } from "zustand";
import { type PersistOptions, persist } from "zustand/middleware";
import {
	emptyHistory,
	type HistoryStacks,
	canRedo as historyCanRedo,
	canUndo as historyCanUndo,
	recordSnapshot,
	redoStep,
	undoStep,
} from "../history";
import type { Coordinate, Logger, Waypoint, WaypointType } from "../types";

// ===== STATE & ACTIONS =====

export interface ElevationProfilePoint {
	distanceMeters: number;
	elevationMeters: number;
}

export interface RouteState {
	waypoints: Waypoint[];
	routePath: Coordinate[];

	routeDistance: string;
	routeDuration: string;
	hasRoute: boolean;

	elevationGain?: number;
	elevationLoss?: number;
	elevationProfile?: ElevationProfilePoint[];
	isComputingElevation: boolean;

	isMapLocked: boolean;

	history: HistoryStacks<Waypoint[]>;
	canUndo: boolean;
	canRedo: boolean;
}

export interface RouteActions {
	addWaypoint: (coord: Coordinate, type: WaypointType) => void;
	removeWaypoint: (index: number) => void;
	setWaypoints: (waypoints: Waypoint[]) => void;
	updateWaypointCoords: (coords: Coordinate[]) => void;
	setWaypointType: (index: number, type: WaypointType) => void;
	setWaypointName: (index: number, name: string | undefined) => void;
	clearWaypoints: () => void;

	setRoutePath: (routePath: Coordinate[]) => void;
	clearRoutePath: () => void;

	setRouteDistance: (distance: string) => void;
	setRouteDuration: (duration: string) => void;
	setHasRoute: (hasRoute: boolean) => void;

	setElevation: (data: { gainMeters: number; lossMeters: number; profile: ElevationProfilePoint[] }) => void;
	clearElevation: () => void;
	setIsComputingElevation: (computing: boolean) => void;

	setIsMapLocked: (isLocked: boolean) => void;

	saveSnapshot: () => void;
	undo: () => void;
	redo: () => void;
	clearHistory: () => void;
}

export type RoutingStore = RouteState & RouteActions;

// ===== INITIAL STATE =====

const initialState: RouteState = {
	waypoints: [],
	routePath: [],
	routeDistance: "",
	routeDuration: "",
	hasRoute: false,
	elevationGain: undefined,
	elevationLoss: undefined,
	elevationProfile: undefined,
	isComputingElevation: false,
	isMapLocked: false,
	history: emptyHistory<Waypoint[]>(),
	canUndo: false,
	canRedo: false,
};

// ===== PERSISTENCE MIGRATION =====

// v0 stored waypoints as Coordinate[] alongside a parallel directFlags: boolean[].
// v1 collapses both into Waypoint[] = { coord, type }[]. Pre-existing undo/redo
// stacks are dropped on migration; history is no longer persisted.
type LegacyPersistedRoute = {
	waypoints?: Coordinate[];
	directFlags?: boolean[];
	[key: string]: unknown;
};

const migrateWaypoints = (coords: Coordinate[] = [], flags: boolean[] = []): Waypoint[] =>
	coords.map((coord, i) => ({ coord, type: flags[i] ? "direct" : "routed" }));

const migrateLegacyPersistedState = (persisted: LegacyPersistedRoute): Partial<RouteState> => {
	const { waypoints, directFlags, undoStack: _u, redoStack: _r, ...rest } = persisted;
	return {
		...(rest as Partial<RouteState>),
		waypoints: migrateWaypoints(waypoints ?? [], directFlags ?? []),
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
		// History (undo/redo stacks) is persisted so undo still works after a
		// page refresh — users expect that. Bounded growth is enforced by the
		// 50-snapshot cap inside HistoryManager.recordSnapshot, so localStorage
		// stays small.
		partialize: (state) => ({
			waypoints: state.waypoints,
			routePath: state.routePath,
			routeDistance: state.routeDistance,
			routeDuration: state.routeDuration,
			hasRoute: state.hasRoute,
			elevationGain: state.elevationGain,
			elevationLoss: state.elevationLoss,
			elevationProfile: state.elevationProfile,
			isMapLocked: state.isMapLocked,
			history: state.history,
			canUndo: state.canUndo,
			canRedo: state.canRedo,
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

				setWaypointName: (index, name) => {
					const trimmed = name?.trim();
					set((state) => ({
						waypoints: state.waypoints.map((wp, i) =>
							i === index ? { ...wp, name: trimmed && trimmed.length > 0 ? trimmed : undefined } : wp,
						),
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
						elevationGain: undefined,
						elevationLoss: undefined,
						elevationProfile: undefined,
						isComputingElevation: false,
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

				// === ELEVATION ===
				setElevation: ({ gainMeters, lossMeters, profile }) => {
					set({
						elevationGain: gainMeters,
						elevationLoss: lossMeters,
						elevationProfile: profile,
					});
				},

				clearElevation: () => {
					set({
						elevationGain: undefined,
						elevationLoss: undefined,
						elevationProfile: undefined,
					});
				},

				setIsComputingElevation: (computing) => {
					set({ isComputingElevation: computing });
				},

				// === MAP CONFIG ===
				setIsMapLocked: (isLocked) => {
					set({ isMapLocked: isLocked });
				},

				// === HISTORY ===
				saveSnapshot: () => {
					set((state) => {
						const snapshot = state.waypoints.map((wp) => ({ ...wp }));
						const nextHistory = recordSnapshot(state.history, snapshot);
						logger.info("[RoutingStore] Saving snapshot:", snapshot.length, "waypoints");
						return {
							history: nextHistory,
							canUndo: historyCanUndo(nextHistory),
							canRedo: historyCanRedo(nextHistory),
						};
					});
				},

				undo: () => {
					set((state) => {
						const current = state.waypoints.map((wp) => ({ ...wp }));
						const step = undoStep(state.history, current);
						if (!step) {
							logger.warn("[RoutingStore] No actions to undo");
							return state;
						}
						logger.info("[RoutingStore] Undo:", state.waypoints.length, "->", step.previous.length, "waypoints");
						return {
							waypoints: step.previous,
							history: step.history,
							canUndo: historyCanUndo(step.history),
							canRedo: historyCanRedo(step.history),
						};
					});
				},

				redo: () => {
					set((state) => {
						const current = state.waypoints.map((wp) => ({ ...wp }));
						const step = redoStep(state.history, current);
						if (!step) {
							logger.warn("[RoutingStore] No actions to redo");
							return state;
						}
						logger.info("[RoutingStore] Redo:", state.waypoints.length, "->", step.next.length, "waypoints");
						return {
							waypoints: step.next,
							history: step.history,
							canUndo: historyCanUndo(step.history),
							canRedo: historyCanRedo(step.history),
						};
					});
				},

				clearHistory: () => {
					logger.info("[RoutingStore] Clearing history");
					set({ history: emptyHistory<Waypoint[]>(), canUndo: false, canRedo: false });
				},
			}),
			persistConfig,
		),
	);
}

// Selector hooks live with their consumers — see apps/web/src/stores/routingStore.ts.
// Keep this module focused on the store itself.
