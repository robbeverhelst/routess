import type { RouteVisibility } from "@routess/core";
import type { RedesignMapStyle } from "@/stores/redesignSettingsStore";
import type { ApiRoute, Waypoint } from "./api";

type NoDetail = undefined;

export interface AppEventMap {
	"routess:undo": NoDetail;
	"routess:redo": NoDetail;
	"routess:reset-route": NoDetail;
	"routess:save-draft": NoDetail;
	"routess:focus-route": NoDetail;
	"routess:share-route": NoDetail;
	"routess:export-gpx": { routeId?: number } | undefined;
	"routess:import-gpx": { gpxString: string; fileName?: string };
	"routess:reroute": NoDetail;
	"routess:recalculate-route": NoDetail;
	"routess:locate": NoDetail;
	"routess:zoom-in": NoDetail;
	"routess:zoom-out": NoDetail;
	"routess:fly-to": { coordinates: [number, number]; zoom?: number };
	"routess:load-route": // Full saved Route: editor.loadFromApiRoute sets mode + baseline +
	// activity in addition to loading waypoints/geometry. Used by the
	// library, command palette, and any other "open this saved Route"
	// surface. The listener lives in MapWithRouting because the editor is
	// only visible inside that subtree, and is also where confirm-on-dirty
	// gating happens before the destructive load.
		| { source: "saved"; route: ApiRoute }
		// Legacy unsaved-waypoints payload used by share-link / GPX paths;
		// loads waypoints without binding to a saved Route. Currently only
		// emitted by external code paths if any survive; kept for safety.
		| {
				source: "waypoints";
				name?: string;
				waypoints: Waypoint[];
				geometry?: [number, number][];
				distance?: number;
				duration?: number;
				elevationGain?: number;
				visibility?: RouteVisibility;
				tags?: string[];
				description?: string;
		  };
	// Kicks off RouteGeneration (#136). `start` is the loop start point; when
	// omitted the handler (in MapWithRouting, where the map lives) falls back
	// to the current map center.
	"routess:generate-loop": { start?: [number, number] } | undefined;
	// Enters one-shot pick mode: the next map click becomes the loop start
	// and the loop modal reopens. Handled in MapWithRouting (cursor + map).
	"routess:pick-loop-start": NoDetail;
	"routess:set-map-style": { styleKey: RedesignMapStyle };
	"routess:set-pois": { visible: boolean };
	"routess:open-user-settings": NoDetail;
	"routess:open-profile": NoDetail;
	"routess:open-login": NoDetail;
	"routess:open-signup": NoDetail;
	"routess:open-discover": NoDetail;
	"routess:open-explore": NoDetail;
	"routess:open-social": NoDetail;
	"routess:open-activity": NoDetail;
	"routess:export-all-data": NoDetail;
}

type EventName = keyof AppEventMap;

export function emitAppEvent<K extends EventName>(
	type: K,
	...args: AppEventMap[K] extends undefined ? [] : [detail: AppEventMap[K]]
): void {
	const detail = args[0];
	window.dispatchEvent(detail === undefined ? new CustomEvent(type) : new CustomEvent(type, { detail }));
}

export function onAppEvent<K extends EventName>(
	type: K,
	handler: (detail: AppEventMap[K], event: CustomEvent<AppEventMap[K]>) => void,
): () => void {
	const listener = (event: Event) => {
		const customEvent = event as CustomEvent<AppEventMap[K]>;
		handler(customEvent.detail, customEvent);
	};
	window.addEventListener(type, listener);
	return () => window.removeEventListener(type, listener);
}

export function routeToLoadDetail(route: ApiRoute): AppEventMap["routess:load-route"] {
	return { source: "saved", route };
}
