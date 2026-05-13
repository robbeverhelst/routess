import type { RouteBaseline } from "@routess/core";
import type { ApiRoute } from "@/lib/api";
import { useRoutingStore } from "@/stores/routingStore";

// Pure-state-mutation half of editor.applySaved: callable from panels that
// don't have access to the map-bound RouteDraftEditor (panels live outside
// RouteDraftEditorProvider, which is scoped to MapWithRouting). Resets the
// baseline and binding after a successful POST/PATCH so the next dirty check
// compares against what the server has.
export function applySavedRoute(route: ApiRoute): void {
	const baseline: RouteBaseline = {
		name: route.name,
		activity: route.activity,
		visibility: route.visibility,
		tags: route.tags,
		description: route.description,
		waypoints: route.waypoints.map((wp) => ({ ...wp })),
	};
	const store = useRoutingStore.getState();
	store.setMode({ kind: "editing", routeId: route.id, name: route.name, baseline });
	if (route.activity !== undefined) store.setActivity(route.activity);
}
