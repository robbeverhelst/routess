import type { RoutePrivacy } from "@routess/core";
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
	"routess:load-route": {
		routeId?: number;
		name?: string;
		waypoints: Waypoint[];
		geometry?: [number, number][];
		distance?: number;
		duration?: number;
		elevationGain?: number;
		privacy?: RoutePrivacy;
		tags?: string[];
		description?: string;
	};
	"routess:set-map-style": { styleKey: RedesignMapStyle };
	"routess:set-pois": { visible: boolean };
	"routess:open-account": NoDetail;
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
	return {
		routeId: route.id,
		name: route.name,
		waypoints: route.waypoints,
		geometry: route.geometry,
		distance: route.distance,
		duration: route.duration,
		elevationGain: route.elevationGain,
		privacy: route.privacy,
		tags: route.tags,
		description: route.description,
	};
}
