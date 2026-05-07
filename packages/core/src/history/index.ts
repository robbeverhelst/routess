// Generic undo/redo HistoryManager. Pure, immutable, ephemeral. Used by the
// routing store to keep WaypointHistory snapshots; reusable for any other
// editable state. Snapshots are full values (T) — premature to delta-encode
// for the small arrays the RouteDraft contains. Capped depth so the stacks
// don't grow without bound.

export interface HistoryStacks<T> {
	past: T[];
	future: T[];
}

export interface HistoryConfig<T> {
	maxDepth?: number;
	equals?: (a: T, b: T) => boolean;
}

export const emptyHistory = <T>(): HistoryStacks<T> => ({ past: [], future: [] });

export const canUndo = <T>(history: HistoryStacks<T>): boolean => history.past.length > 0;
export const canRedo = <T>(history: HistoryStacks<T>): boolean => history.future.length > 0;

const DEFAULT_MAX_DEPTH = 50;

export function recordSnapshot<T>(
	history: HistoryStacks<T>,
	current: T,
	config: HistoryConfig<T> = {},
): HistoryStacks<T> {
	const { maxDepth = DEFAULT_MAX_DEPTH, equals } = config;
	const lastPast = history.past[history.past.length - 1];
	if (lastPast !== undefined && equals?.(lastPast, current)) {
		return history;
	}
	const past = [...history.past, current];
	const trimmed = past.length > maxDepth ? past.slice(past.length - maxDepth) : past;
	return { past: trimmed, future: [] };
}

export function undoStep<T>(history: HistoryStacks<T>, current: T): { history: HistoryStacks<T>; previous: T } | null {
	if (history.past.length === 0) return null;
	const previous = history.past[history.past.length - 1];
	return {
		history: { past: history.past.slice(0, -1), future: [...history.future, current] },
		previous,
	};
}

export function redoStep<T>(history: HistoryStacks<T>, current: T): { history: HistoryStacks<T>; next: T } | null {
	if (history.future.length === 0) return null;
	const next = history.future[history.future.length - 1];
	return {
		history: { past: [...history.past, current], future: history.future.slice(0, -1) },
		next,
	};
}
