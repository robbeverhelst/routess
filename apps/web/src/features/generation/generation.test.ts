import type { ApiBillingStatus, ApiFeature } from "@routess/api-client";
import type { Coordinate } from "@routess/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient, queryKeys } from "@/lib/query-client";
import { type GenerationCandidateView, useGenerationStore } from "@/stores/generationStore";
import { useLoopPreferencesStore } from "@/stores/loopPreferencesStore";
import { candidateWaypoints, startGeneration } from "./generationService";

const candidate = (bearingDeg: number): GenerationCandidateView => ({
	bearingDeg,
	viaPoints: [
		[3.75, 51.08],
		[3.7, 51.09],
		[3.68, 51.07],
	],
	viaMeta: [undefined, undefined, undefined],
	geometry: [
		[3.7174, 51.0543],
		[3.75, 51.08],
		[3.7, 51.09],
		[3.68, 51.07],
		[3.7174, 51.0543],
	],
	distanceKm: 30,
	durationSeconds: 5400,
	overlapPct: 2,
	score: 0.91,
	lowQuality: false,
	surfaceMetersByBucket: { paved: 28000, compacted: 1000, unpaved: 1000, path: 0 },
	elevationGainM: null,
});

const request = {
	routeType: "loop" as const,
	start: [3.7174, 51.0543] as Coordinate,
	activity: "cycle" as const,
	targetDistanceKm: 30,
	heading: "any" as const,
	surface: "mixed" as const,
	preferNodeNetworks: false,
	landmarks: [],
	preferences: { surfacePreference: "mixed" as const, avoidFerries: true, avoidHighways: false },
};

describe("candidateWaypoints", () => {
	it("builds start + vias + start, all routed", () => {
		const waypoints = candidateWaypoints(candidate(45), "loop");
		expect(waypoints).toHaveLength(5);
		expect(waypoints[0].coord).toEqual(waypoints[4].coord);
		expect(waypoints[0].coord).toEqual([3.7174, 51.0543]);
		expect(waypoints.every((wp) => wp.type === "routed")).toBe(true);
		expect(waypoints.slice(1, 4).map((wp) => wp.coord)).toEqual(candidate(45).viaPoints);
	});

	it("names vias by knooppunt ref or landmark name", () => {
		const withMeta = { ...candidate(45), viaMeta: [{ ref: "45" }, undefined, { name: "Kasteel van Horst" }] };
		const waypoints = candidateWaypoints(withMeta, "loop");
		expect(waypoints[1].name).toBe("Knooppunt 45");
		expect(waypoints[2].name).toBeUndefined();
		expect(waypoints[3].name).toBe("Kasteel van Horst");
	});

	it("ends an a-to-b candidate at the geometry's last point", () => {
		const atob = {
			...candidate(90),
			geometry: [
				[3.7174, 51.0543],
				[3.75, 51.08],
				[3.7, 51.09],
				[3.68, 51.07],
				[3.9, 51.1],
			] as Coordinate[],
		};
		const waypoints = candidateWaypoints(atob, "a-to-b");
		expect(waypoints[0].coord).toEqual([3.7174, 51.0543]);
		expect(waypoints[waypoints.length - 1].coord).toEqual([3.9, 51.1]);
	});
});

describe("generationStore", () => {
	beforeEach(() => {
		useGenerationStore.getState().dismiss();
	});

	it("accumulates shown bearings across runs of the same request", () => {
		const store = useGenerationStore.getState();
		store.startLoading(request);
		useGenerationStore.getState().setCandidates([candidate(0), candidate(90)]);
		expect(useGenerationStore.getState().shownBearings).toEqual([0, 90]);

		useGenerationStore.getState().startLoading(request);
		useGenerationStore.getState().setCandidates([candidate(180)]);
		expect(useGenerationStore.getState().shownBearings).toEqual([0, 90, 180]);
	});

	it("resets shown bearings when the request changes", () => {
		useGenerationStore.getState().startLoading(request);
		useGenerationStore.getState().setCandidates([candidate(0)]);
		useGenerationStore.getState().startLoading({ ...request, targetDistanceKm: 50 });
		expect(useGenerationStore.getState().shownBearings).toEqual([]);
	});

	it("tracks failure state and clears on dismiss", () => {
		useGenerationStore.getState().startLoading(request);
		useGenerationStore.getState().setFailure({ code: "all_candidates_low_quality", bestOverlapPct: 61 });
		expect(useGenerationStore.getState().status).toBe("failed");
		expect(useGenerationStore.getState().failure).toEqual({ code: "all_candidates_low_quality", bestOverlapPct: 61 });

		useGenerationStore.getState().dismiss();
		expect(useGenerationStore.getState().status).toBe("idle");
		expect(useGenerationStore.getState().failure).toBeNull();
	});

	it("fills in elevation per candidate", () => {
		useGenerationStore.getState().startLoading(request);
		useGenerationStore.getState().setCandidates([candidate(0), candidate(90)]);
		useGenerationStore.getState().setCandidateElevation(1, 320);
		expect(useGenerationStore.getState().candidates[0].elevationGainM).toBeNull();
		expect(useGenerationStore.getState().candidates[1].elevationGainM).toBe(320);
	});
});

describe("startGeneration on a 429", () => {
	function respond(status: number, body: unknown) {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
			),
		);
	}

	beforeEach(() => {
		useGenerationStore.getState().dismiss();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("turns the daily generation quota into a quota failure carrying the upgrade path", async () => {
		respond(429, {
			statusCode: 429,
			code: "RATE_LIMITED",
			message: "Daily route generation limit of 3 reached. Try again tomorrow.",
			details: { reason: "generation_quota", limit: 3, tier: "free", upgrade: "pro" },
		});

		await startGeneration([3.7174, 51.0543]);

		expect(useGenerationStore.getState().status).toBe("failed");
		expect(useGenerationStore.getState().failure).toEqual({ code: "quota_exceeded", limit: 3, upgrade: "pro" });
	});

	it("keeps a per-minute throttle 429 as an unavailable engine", async () => {
		respond(429, { statusCode: 429, code: "RATE_LIMITED", message: "ThrottlerException: Too Many Requests" });

		await startGeneration([3.7174, 51.0543]);

		expect(useGenerationStore.getState().failure).toEqual({ code: "provider_unavailable" });
	});
});

describe("startGeneration and the knooppunt Pro gate (ADR 0039)", () => {
	const freeStatus = (features: ApiFeature[]): ApiBillingStatus => ({
		enabled: true,
		account: {
			plan: "free",
			proExpiresAt: null,
			ogGrantExpiresAt: null,
			canBuy: true,
			features,
			savedRoutes: { count: 0, limit: 5 },
		},
	});

	beforeEach(() => {
		useGenerationStore.getState().dismiss();
		useLoopPreferencesStore.setState({ preferNodeNetworks: true });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		queryClient.clear();
		useLoopPreferencesStore.setState({ preferNodeNetworks: false });
	});

	function sentBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
		const init = fetchMock.mock.calls[0][1] as RequestInit;
		return JSON.parse(init.body as string);
	}

	function stubFetch(status: number, body: unknown) {
		const fetchMock = vi.fn(
			async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
		);
		vi.stubGlobal("fetch", fetchMock);
		return fetchMock;
	}

	it("does not send a kept knooppunt preference while the Feature is locked", async () => {
		queryClient.setQueryData(queryKeys.billing.status(false), freeStatus(["route_generation", "gpx_export"]));
		const fetchMock = stubFetch(200, { candidates: [] });

		await startGeneration([3.7174, 51.0543]);

		expect(sentBody(fetchMock).preferNodeNetworks).toBeUndefined();
		expect(useGenerationStore.getState().request?.preferNodeNetworks).toBe(false);
	});

	it("sends it when the account has the Feature", async () => {
		queryClient.setQueryData(
			queryKeys.billing.status(false),
			freeStatus(["route_generation", "gpx_export", "node_network_generation"]),
		);
		const fetchMock = stubFetch(200, { candidates: [] });

		await startGeneration([3.7174, 51.0543]);

		expect(sentBody(fetchMock).preferNodeNetworks).toBe(true);
	});

	it("turns a Pro gate 403 into a pro_required failure", async () => {
		stubFetch(403, {
			statusCode: 403,
			code: "FORBIDDEN",
			message: "Knooppunt routes are part of Pro.",
			details: { reason: "pro_required", feature: "node_network_generation", upgrade: "pro" },
		});

		await startGeneration([3.7174, 51.0543]);

		expect(useGenerationStore.getState().failure).toEqual({
			code: "pro_required",
			feature: "node_network_generation",
		});
	});
});
