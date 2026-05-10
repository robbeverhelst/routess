import type { RouteActivity, RouteBaseline, RouteDraftMode, Waypoint } from "@routess/core";

const waypointEqual = (a: Waypoint, b: Waypoint): boolean =>
	a.coord[0] === b.coord[0] && a.coord[1] === b.coord[1] && a.type === b.type && (a.name ?? "") === (b.name ?? "");

const waypointsEqual = (a: Waypoint[], b: Waypoint[]): boolean => {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (!waypointEqual(a[i], b[i])) return false;
	return true;
};

// Structured comparison of the live draft against the baseline snapshot held
// in mode.editing. Used to gate the Save button when the draft is bound to a
// saved Route. Always false when mode is `unsaved` (there's no baseline to
// diff against; "dirty" only applies to edit-in-place flows).
export function isDraftDirty(args: {
	mode: RouteDraftMode;
	activity: RouteActivity | undefined;
	waypoints: Waypoint[];
}): boolean {
	if (args.mode.kind !== "editing") return false;
	const baseline: RouteBaseline = args.mode.baseline;
	if (args.mode.name !== baseline.name) return true;
	if (args.activity !== baseline.activity) return true;
	if (!waypointsEqual(args.waypoints, baseline.waypoints)) return true;
	return false;
}
