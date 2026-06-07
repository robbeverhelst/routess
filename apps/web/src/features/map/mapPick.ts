import type { Coordinate } from "@routess/core";

// One-shot "pick a point on the map" mode. A requester registers a callback;
// the next map click is consumed by it instead of the normal waypoint-add
// grammar (MapInteractionManager checks consumeMapPick first). Module-level
// because the manager lives outside React.

let pendingPick: ((coord: Coordinate) => void) | null = null;

export function requestMapPick(onPick: (coord: Coordinate) => void): void {
	pendingPick = onPick;
}

export function cancelMapPick(): void {
	pendingPick = null;
}

export function hasPendingMapPick(): boolean {
	return pendingPick !== null;
}

/** Returns true when the click was consumed by a pending pick. */
export function consumeMapPick(coord: Coordinate): boolean {
	if (!pendingPick) return false;
	const onPick = pendingPick;
	pendingPick = null;
	onPick(coord);
	return true;
}
