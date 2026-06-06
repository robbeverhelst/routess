// Demo route fixtures shared by the screenshot capture script and the live
// MiniPlanner. Coordinates are real places around Sint-Amands / Klein-Brabant
// (BE) so Mapbox Directions snaps them to actual roads and paths.

export type LngLat = [number, number];

export type DirectionsProfile = "walking" | "cycling";

export interface DemoWaypoint {
	coord: LngLat;
	type: "routed";
}

export interface DemoRoute {
	slug: string;
	profile: DirectionsProfile;
	waypoints: LngLat[];
}

export const toWaypoints = (coords: LngLat[]): DemoWaypoint[] => coords.map((coord) => ({ coord, type: "routed" }));

// Hero + share-card #1: the Sint-Amands loop, through Lippelobos and
// Buggenhout bos so the surface breakdown shows a real paved/gravel/path mix.
export const SINT_AMANDS_LOOP: DemoRoute = {
	slug: "sint-amands-loop",
	profile: "cycling",
	waypoints: [
		[4.2069, 51.0566], // Sint-Amands, kaai
		[4.2445, 51.0851], // Branst
		[4.2867, 51.0741], // Puurs
		[4.2363, 51.0179], // Malderen
		[4.1828, 51.0079], // Buggenhout bos
		[4.2069, 51.0566], // back to start
	],
};

// Library cards 2-4 (order matches dict.sharing.routes).
export const SHARING_ROUTES: DemoRoute[] = [
	SINT_AMANDS_LOOP,
	{
		slug: "river-dawn-run",
		profile: "walking",
		waypoints: [
			[4.2069, 51.0566],
			[4.1843, 51.0689], // Mariekerke, along the Scheldt
			[4.1693, 51.0796], // Baasrode ferry
		],
	},
	{
		slug: "forest-gravel-grind",
		profile: "cycling",
		waypoints: [
			[4.2422, 51.0973], // Bornem
			[4.1561, 51.1281], // Temse bridge
			[4.1106, 51.1597], // Sint-Niklaas south
			[4.0407, 51.1232], // Waasmunster, Heide
		],
	},
	{
		slug: "sunday-slow-walk",
		profile: "walking",
		// Anchored on the walking network around the Oude Schelde so the
		// Directions result is a clean loop instead of out-and-back spurs.
		waypoints: [
			[4.2421, 51.0975], // Bornem castle
			[4.2303, 51.1036], // Oude Schelde, north bank
			[4.2201, 51.0999], // Weert
			[4.2306, 51.0938], // Marselaer
			[4.2421, 51.0975],
		],
	},
];

// Panel capture: a forest walk through Hallerbos, which yields a real
// paved/gravel/path surface mix for the surface-intelligence section.
export const FOREST_WALK: DemoRoute = {
	slug: "hallerbos-walk",
	profile: "walking",
	waypoints: [
		[4.268, 50.747], // Hallerbos, north entrance
		[4.285, 50.7405], // Vlasmarktdreef area
		[4.2755, 50.732], // deep in the bos
		[4.268, 50.747],
	],
};

// RouteGen "generated loop" preview. East-bank villages only (the old route
// pointed at the Baasrode ferry, which the cycling profile detours around).
export const ROUTEGEN_LOOP: DemoRoute = {
	slug: "routegen-loop",
	profile: "cycling",
	waypoints: [
		[4.2068, 51.0568], // Sint-Amands
		[4.2374, 51.0866], // Branst
		[4.2606, 51.0637], // Oppuurs
		[4.2429, 51.0443], // Malderen
		[4.2068, 51.0568],
	],
};

// MiniPlanner: initial pins, kept short so the demo route reads at a glance.
export const MINI_PLANNER_START: LngLat[] = [
	[4.2069, 51.0566],
	[4.2247, 51.0702],
	[4.2445, 51.0851],
];

export const MINI_PLANNER_CENTER: LngLat = [4.2226, 51.071];
export const MINI_PLANNER_ZOOM = 12.4;

// Mirrors the app's wire format v1 in apps/web/src/lib/shareUtils.ts:
// url-safe base64 of zlib-deflated { waypoints, locked }. CompressionStream's
// "deflate" emits zlib framing, which pako.inflate on the app side accepts.
export async function encodeShareRoute(coords: LngLat[]): Promise<string | null> {
	try {
		const json = JSON.stringify({ waypoints: toWaypoints(coords), locked: false });
		const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("deflate"));
		const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
		let binary = "";
		for (const byte of bytes) binary += String.fromCharCode(byte);
		return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
	} catch {
		return null;
	}
}
