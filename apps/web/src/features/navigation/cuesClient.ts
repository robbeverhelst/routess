import { type Coordinate, encodePolyline6, type NavCue, type RouteActivity } from "@routess/core";
import { getRuntimeConfig } from "@/lib/runtime-config";

// Cues come from the API (ADR 0038): map-matching needs Valhalla, which the
// browser cannot reach (ADR 0034). Fetched once at session start; offline
// sessions run on the snapshot persisted by the navigation store.
const API_BASE_URL = getRuntimeConfig("VITE_API_URL") ?? "";
const CUES_URL = `${API_BASE_URL.replace(/\/+$/, "")}/api/v1/routing/cues`;

export interface CuesResult {
	cues: NavCue[];
	degraded: boolean;
}

export async function fetchCues(args: {
	geometry: Coordinate[];
	activity: RouteActivity;
	locale: string;
	signal?: AbortSignal;
}): Promise<CuesResult> {
	const response = await fetch(CUES_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({
			geometry: encodePolyline6(args.geometry),
			activity: args.activity,
			locale: args.locale,
		}),
		signal: args.signal,
	});
	if (!response.ok) {
		throw new Error(`cues API ${response.status}`);
	}
	return (await response.json()) as CuesResult;
}
