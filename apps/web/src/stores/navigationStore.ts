import {
	type Coordinate,
	decodePolyline6,
	encodePolyline6,
	endNavigationSession,
	type NavCue,
	type NavigationSessionState,
	type PositionFix,
	type RouteActivity,
	startNavigationSession,
} from "@routess/core";
import { create } from "zustand";
import { Logger } from "@/lib/logger";

// Device-local NavigationSession state (CONTEXT.md "Navigation"). The pure
// engine in @routess/core owns the semantics; this store holds the session
// data plus UI flags, and persists a resume snapshot so an accidental swipe-
// kill 30 km from home does not lose the session.

const SNAPSHOT_KEY = "routess.navigation.v1";
const SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const SNAPSHOT_WRITE_INTERVAL_MS = 5000;

export interface ActiveNavigation {
	routeName: string;
	activity: RouteActivity;
	path: Coordinate[];
	cues: NavCue[];
	degraded: boolean;
	engine: NavigationSessionState;
	startedAtMs: number;
}

interface NavigationSnapshot {
	routeName: string;
	activity: RouteActivity;
	geometry: string;
	cues: NavCue[];
	degraded: boolean;
	engine: NavigationSessionState;
	startedAtMs: number;
	savedAtMs: number;
}

interface NavigationStoreState {
	active: ActiveNavigation | null;
	lastFix: PositionFix | null;
	muted: boolean;
	follow: boolean;
	start: (session: Omit<ActiveNavigation, "engine" | "startedAtMs">, resume?: NavigationSnapshot) => void;
	setEngine: (engine: NavigationSessionState) => void;
	setLastFix: (fix: PositionFix) => void;
	setMuted: (muted: boolean) => void;
	setFollow: (follow: boolean) => void;
	end: () => void;
	dismiss: () => void;
}

let lastSnapshotWriteMs = 0;

function writeSnapshot(active: ActiveNavigation): void {
	const now = Date.now();
	if (now - lastSnapshotWriteMs < SNAPSHOT_WRITE_INTERVAL_MS) return;
	lastSnapshotWriteMs = now;
	try {
		const snapshot: NavigationSnapshot = {
			routeName: active.routeName,
			activity: active.activity,
			geometry: encodePolyline6(active.path),
			cues: active.cues,
			degraded: active.degraded,
			engine: active.engine,
			startedAtMs: active.startedAtMs,
			savedAtMs: now,
		};
		localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
	} catch (err) {
		Logger.debug("[NavigationStore] Snapshot write failed:", err);
	}
}

export function clearNavigationSnapshot(): void {
	try {
		localStorage.removeItem(SNAPSHOT_KEY);
	} catch {
		// Storage unavailable; nothing to clear.
	}
}

/** The resume snapshot, when one exists, is fresh, and was mid-session. */
export function loadNavigationSnapshot(): NavigationSnapshot | null {
	try {
		const raw = localStorage.getItem(SNAPSHOT_KEY);
		if (!raw) return null;
		const snapshot = JSON.parse(raw) as NavigationSnapshot;
		if (
			Date.now() - snapshot.savedAtMs > SNAPSHOT_MAX_AGE_MS ||
			snapshot.engine.status === "ended" ||
			!snapshot.geometry
		) {
			clearNavigationSnapshot();
			return null;
		}
		return snapshot;
	} catch {
		return null;
	}
}

export const useNavigationStore = create<NavigationStoreState>()((set, get) => ({
	active: null,
	lastFix: null,
	muted: false,
	follow: true,

	start: (session, resume) => {
		const active: ActiveNavigation = {
			...session,
			engine: resume?.engine ?? startNavigationSession(),
			startedAtMs: resume?.startedAtMs ?? Date.now(),
		};
		lastSnapshotWriteMs = 0;
		writeSnapshot(active);
		set({ active, lastFix: null, follow: true });
	},

	setEngine: (engine) => {
		const { active } = get();
		if (!active) return;
		const next = { ...active, engine };
		writeSnapshot(next);
		set({ active: next });
	},

	setLastFix: (fix) => set({ lastFix: fix }),
	setMuted: (muted) => set({ muted }),
	setFollow: (follow) => set({ follow }),

	// "End" keeps the session mounted so the summary can render; dismiss
	// actually unmounts it.
	end: () => {
		const { active } = get();
		if (!active) return;
		clearNavigationSnapshot();
		set({ active: { ...active, engine: endNavigationSession(active.engine) } });
	},

	dismiss: () => {
		clearNavigationSnapshot();
		set({ active: null, lastFix: null, follow: true });
	},
}));

export function snapshotToSession(
	snapshot: NavigationSnapshot,
): Omit<ActiveNavigation, "engine" | "startedAtMs"> & { snapshot: NavigationSnapshot } {
	return {
		routeName: snapshot.routeName,
		activity: snapshot.activity,
		path: decodePolyline6(snapshot.geometry),
		cues: snapshot.cues,
		degraded: snapshot.degraded,
		snapshot,
	};
}
