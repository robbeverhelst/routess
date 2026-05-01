// useActivities — backend has no activities/sessions endpoint yet.
// Returns mock fixtures with __source: "mock" so the UI can render a
// preview badge. Swap this implementation when the API ships.

export interface ActivitySession {
	id: string;
	when: string;
	title: string;
	distance: string;
	pace: string;
}

export interface ActivitySummary {
	weekDistanceKm: number;
	weekSessions: number;
	weeklyHistory: number[];
	recent: ActivitySession[];
	__source: "mock" | "live";
}

const MOCK: ActivitySummary = {
	weekDistanceKm: 48.2,
	weekSessions: 4,
	weeklyHistory: [22, 33, 18, 27, 41, 15, 30, 25, 38, 28, 35, 48],
	recent: [
		{ id: "a1", when: "Today · 07:14", title: "Morning ride", distance: "18.4 km", pace: "27 km/h" },
		{ id: "a2", when: "Apr 28 · 18:02", title: "Tempo run", distance: "7.8 km", pace: "4:48 /km" },
		{ id: "a3", when: "Apr 27 · 09:30", title: "Schelde loop", distance: "12.4 km", pace: "26 km/h" },
		{ id: "a4", when: "Apr 25 · 19:15", title: "Recovery walk", distance: "3.6 km", pace: "13:20 /km" },
	],
	__source: "mock",
};

export function useActivities(): ActivitySummary {
	return MOCK;
}
