import type { RouteActivity, RouteDraftMode, Waypoint } from "@routess/core";
import { isDraftSavedLocally } from "@/features/localRoutes/localRoutesStore";
import { t } from "@/lib/i18n";
import { isDraftDirty } from "./draftDirty";

// Guards a destructive load (replacing the current draft with a different
// Route). Returns true when there's nothing at risk OR the user confirmed.
// Returns false when the user cancelled. Uses window.confirm to stay outside
// React; a richer modal can replace this without changing call sites.
export function confirmDiscardIfDirty(
	mode: RouteDraftMode,
	activity: RouteActivity | undefined,
	waypoints: Waypoint[],
	message?: string,
): boolean {
	// A draft saved on this device and untouched since loses nothing.
	const hasUnsavedFresh = mode.kind === "unsaved" && waypoints.length > 0 && !isDraftSavedLocally(waypoints);
	const hasUnsavedEdits = mode.kind === "editing" && isDraftDirty({ mode, activity, waypoints });
	if (!hasUnsavedFresh && !hasUnsavedEdits) return true;
	const text = message ?? t("plan.discardConfirm");
	return window.confirm(text);
}
