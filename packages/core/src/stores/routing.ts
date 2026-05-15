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
import type { Coordinate, Logger, RouteActivity, RouteVisibility, Waypoint, WaypointType } from "../types";

// ===== STATE & ACTIONS =====

export interface ElevationProfilePoint {
	distanceMeters: number;
	elevationMeters: number;
}

export interface RouteMetrics {
	distanceMeters: number | null;
	durationSeconds: number | null;
	isOffline: boolean;
}

// Snapshot of a saved Route's editable fields. Held inside `mode.editing` and
// compared against the live draft to compute dirty state.
export interface RouteBaseline {
	name: string;
	activity: RouteActivity | undefined;
	visibility: RouteVisibility;
	tags: string[];
	description: string | undefined;
	waypoints: Waypoint[];
}

// RouteDraft lifecycle. `unsaved` = composing fresh, save will POST a new
// Route. `editing` = bound to a saved Route, save will PATCH that Route.
export type RouteDraftMode =
	| { kind: "unsaved" }
	| { kind: "editing"; routeId: number; name: string; baseline: RouteBaseline };

export interface RouteState {
	waypoints: Waypoint[];
	routePath: Coordinate[];

	distanceMeters: number | null;
	durationSeconds: number | null;
	isOfflineRoute: boolean;
	hasRoute: boolean;

	elevationGain?: number;
	elevationLoss?: number;
	elevationProfile?: ElevationProfilePoint[];
	isComputingElevation: boolean;

	isMapLocked: boolean;

	// RouteDraft binding state (see RouteDraftMode). Persisted across reloads
	// so an in-progress edit-in-place survives a refresh.
	mode: RouteDraftMode;

	// Current activity for this draft. The user toggles it via the activity
	// tabs; loading a saved Route copies its `activity` into here. The global
	// activity preference (`uiStore`) is only the default for fresh drafts.
	activity: RouteActivity | undefined;

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

	setRouteMetrics: (metrics: RouteMetrics) => void;
	clearRouteMetrics: () => void;
	setHasRoute: (hasRoute: boolean) => void;

	setElevation: (data: { gainMeters: number; lossMeters: number; profile: ElevationProfilePoint[] }) => void;
	clearElevation: () => void;
	setIsComputingElevation: (computing: boolean) => void;

	setIsMapLocked: (isLocked: boolean) => void;

	setMode: (mode: RouteDraftMode) => void;
	setEditingName: (name: string) => void;
	setBaseline: (baseline: RouteBaseline) => void;
	setActivity: (activity: RouteActivity | undefined) => void;

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
	distanceMeters: null,
	durationSeconds: null,
	isOfflineRoute: false,
	hasRoute: false,
	elevationGain: undefined,
	elevationLoss: undefined,
	elevationProfile: undefined,
	isComputingElevation: false,
	isMapLocked: false,
	mode: { kind: "unsaved" },
	activity: undefined,
	history: emptyHistory<Waypoint[]>(),
	canUndo: false,
	canRedo: false,
};

// ===== PERSISTENCE MIGRATION =====

// v0 stored waypoints as Coordinate[] alongside a parallel directFlags: boolean[].
// v1 collapses both into Waypoint[] = { coord, type }[]. Pre-existing undo/redo
// stacks are dropped on migration; history is no longer persisted.
// v2 replaces the formatted-string routeDistance/routeDuration with canonical
// distanceMeters / durationSeconds + isOfflineRoute. The cached display strings
// are dropped on migration; the next route calculation repopulates them.
// v3 adds the RouteDraftMode lifecycle (unsaved | editing) and per-draft
// activity. Pre-v3 state had no mode/activity, so they default to
// `unsaved`/`undefined` on migration.
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

const dropLegacyMetricStrings = (persisted: Record<string, unknown> & Partial<RouteState>): Partial<RouteState> => {
	const { routeDistance: _rd, routeDuration: _rdur, ...rest } = persisted as Record<string, unknown>;
	return rest as Partial<RouteState>;
};

// ===== STORE FACTORY =====

export function createRoutingStore(logger: Logger) {
	const persistConfig: PersistOptions<RoutingStore, Partial<RouteState>> = {
		name: "routing-store",
		version: 3,
		migrate: (persisted, version) => {
			let next = (persisted ?? {}) as Record<string, unknown>;
			if (version < 1) {
				next = migrateLegacyPersistedState(next as LegacyPersistedRoute) as Record<string, unknown>;
			}
			if (version < 2) {
				next = dropLegacyMetricStrings(next as Record<string, unknown> & Partial<RouteState>) as Record<
					string,
					unknown
				>;
			}
			return next as Partial<RouteState>;
		},
		// History (undo/redo stacks) is persisted so undo still works after a
		// page refresh - users expect that. Bounded growth is enforced by the
		// 50-snapshot cap inside HistoryManager.recordSnapshot, so localStorage
		// stays small. The RouteDraft mode + activity persist alongside, so an
		// edit-in-place binding survives refresh; the editor re-validates the
		// routeId on rehydration and falls back to `unsaved` if it has gone.
		partialize: (state) => ({
			waypoints: state.waypoints,
			routePath: state.routePath,
			distanceMeters: state.distanceMeters,
			durationSeconds: state.durationSeconds,
			isOfflineRoute: state.isOfflineRoute,
			hasRoute: state.hasRoute,
			elevationGain: state.elevationGain,
			elevationLoss: state.elevationLoss,
			elevationProfile: state.elevationProfile,
			isMapLocked: state.isMapLocked,
			mode: state.mode,
			activity: state.activity,
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
						distanceMeters: null,
						durationSeconds: null,
						isOfflineRoute: false,
						hasRoute: false,
						elevationGain: undefined,
						elevationLoss: undefined,
						elevationProfile: undefined,
						isComputingElevation: false,
						mode: { kind: "unsaved" },
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
				setRouteMetrics: ({ distanceMeters, durationSeconds, isOffline }) => {
					set({ distanceMeters, durationSeconds, isOfflineRoute: isOffline });
				},

				clearRouteMetrics: () => {
					set({ distanceMeters: null, durationSeconds: null, isOfflineRoute: false });
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

				// === DRAFT MODE / ACTIVITY ===
				setMode: (mode) => {
					set({ mode });
				},

				setEditingName: (name) => {
					const trimmed = name.trim();
					if (!trimmed) return;
					set((state) => {
						if (state.mode.kind !== "editing" || state.mode.name === trimmed) return state;
						return { mode: { ...state.mode, name: trimmed } };
					});
				},

				setBaseline: (baseline) => {
					set((state) => {
						if (state.mode.kind !== "editing") return state;
						return { mode: { ...state.mode, name: baseline.name, baseline } };
					});
				},

				setActivity: (activity) => {
					set({ activity });
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
