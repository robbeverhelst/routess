import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
	bucketFromValhallaSurface,
	bucketMatchesPreference,
	type CandidateEdge,
	type CandidatePlan,
	type Coordinate,
	closestPointOnSegment,
	collectSurfaceAnchors,
	decodePolyline6,
	encodePolyline6,
	type GenerationFailureCode,
	haversineDistance,
	isLowQuality,
	loopRadiusKm,
	OVERLAP_WARN_LIMIT,
	planCandidateFan,
	planSurfaceAnchoredCandidates,
	planSurfaceWave,
	type RoutedCandidate,
	refinePlanForDistance,
	repairSpurVias,
	type ScoredCandidate,
	SURFACE_WAVE_TRIGGER_FIT,
	type SurfaceBucket,
	type SurfaceType,
	scoreCandidate,
	selectDiverseCandidates,
	type ValhallaCostingRequest,
	valhallaCostingFromPreferences,
} from "@routess/core";
import { RoutingService } from "../routing/routing.service";
import { ROUTE_GENERATION_COMPLETED, type RouteGenerationCompletedEvent } from "../telemetry/domain-events";
import type { GenerateRequestDto, GenerateResponseDto, GenerationCandidateDto } from "./dto/generate.dto";

// Orchestrates the RouteGeneration pipeline (ADR-0029): the pure stages live
// in @routess/core; this service owns the Valhalla calls — one batched
// /locate for snap validation, then per candidate /route (via points typed
// `through` so the router cannot U-turn at them) and /trace_attributes for
// way-level Overlap + surface composition.

// Keep a single generation's fan from monopolising the shared 32-call
// concurrency cap (which sheds, not queues).
const MAX_PARALLEL_CANDIDATES = 4;

/** A start that snaps further than this is effectively somewhere else. */
const MAX_START_SNAP_KM = 0.5;

interface ValhallaLocateEdge {
	correlated_lat?: number;
	correlated_lon?: number;
	distance?: number;
	outbound_reach?: number;
	inbound_reach?: number;
	edge?: {
		classification?: { classification?: string; use?: string; surface?: string };
	};
}

interface ValhallaLocateResult {
	edges?: ValhallaLocateEdge[] | null;
}

// A via snapped onto one of these is a guaranteed silly detour (driveways,
// parking aisles); skip such edges when a better candidate edge exists.
const BAD_EDGE_USES = new Set(["driveway", "parking_aisle", "parking", "alley", "emergency_access", "drive_through"]);

// Reach = how much network is connected through the edge (capped at 50 by
// /locate). Tiny values mean a dead-end pocket; the loop would spur in and
// straight back out.
const MIN_EDGE_REACH = 10;

// How far around a via /locate searches for an edge on the preferred surface
// (the surface nudge). Within the via snap allowance, which is ≥500m.
const SURFACE_NUDGE_RADIUS_M = 500;

// Surface-wave iteration: re-anchor on each new loop's fresh surface, stopping
// when a round adds little fit. Bounded so a generation can't fan out forever.
const MAX_WAVE_ROUNDS = 3;
const WAVE_IMPROVEMENT_EPSILON = 0.05;

// An anchored candidate steers through gravel by force, which risks spur-in-
// and-back excursions. Reject any the app would badge as low quality: a clean
// fan loop beats a gravelly one riddled with dead-ends. (= OVERLAP_WARN_LIMIT.)
const WAVE_MAX_OVERLAP = OVERLAP_WARN_LIMIT;

function pickViaEdge(edges: ValhallaLocateEdge[] | null | undefined, pref: SurfaceType): ValhallaLocateEdge | null {
	const usable = (edges ?? []).filter(
		(e) => typeof e.correlated_lat === "number" && typeof e.correlated_lon === "number",
	);
	if (usable.length === 0) return null;
	const preferred = usable.filter((e) => {
		const use = e.edge?.classification?.use ?? "";
		const reach = Math.min(e.outbound_reach ?? 0, e.inbound_reach ?? 0);
		return !BAD_EDGE_USES.has(use) && reach >= MIN_EDGE_REACH;
	});
	let pool = preferred.length > 0 ? preferred : usable;
	// The surface nudge: with a strict preference, a farther edge on the right
	// surface beats the nearest one on the wrong surface; the via then drags
	// the whole loop onto that network (Valhalla never detours for surface on
	// its own; vias are the only lever that can).
	if (pref !== "mixed") {
		const matching = pool.filter((e) => {
			const surface = e.edge?.classification?.surface;
			return typeof surface === "string" && bucketMatchesPreference(bucketFromValhallaSurface(surface), pref);
		});
		if (matching.length > 0) pool = matching;
	}
	// Among acceptable edges, nearest to the requested point wins.
	return pool.reduce((best, e) => ((e.distance ?? Infinity) < (best.distance ?? Infinity) ? e : best));
}

interface ValhallaTripLeg {
	shape?: string;
	summary?: { length?: number; time?: number };
}

interface ValhallaRouteResponse {
	trip?: { legs?: ValhallaTripLeg[] };
	error?: string;
}

interface ValhallaTraceEdge {
	way_id?: number;
	surface?: string;
	length?: number;
	begin_heading?: number;
	end_heading?: number;
	begin_shape_index?: number;
	end_shape_index?: number;
}

interface ValhallaTraceResponse {
	shape?: string;
	edges?: ValhallaTraceEdge[];
}

interface RoutedLeg {
	geometry: Coordinate[];
	shape: string;
	distanceKm: number;
	durationSeconds: number;
}

class GenerationFailure extends Error {
	constructor(readonly failureCode: GenerationFailureCode) {
		super(failureCode);
	}
}

/** Nearest point on the loop geometry, refined onto the adjacent segments. */
function projectOntoGeometry(point: Coordinate, geometry: Coordinate[]): Coordinate {
	if (geometry.length === 0) return point;
	let nearestIndex = 0;
	let nearestKm = Infinity;
	for (let i = 0; i < geometry.length; i++) {
		const km = haversineDistance(point, geometry[i]);
		if (km < nearestKm) {
			nearestKm = km;
			nearestIndex = i;
		}
	}
	let best = geometry[nearestIndex];
	let bestKm = nearestKm;
	for (const j of [nearestIndex - 1, nearestIndex]) {
		if (j < 0 || j + 1 >= geometry.length) continue;
		const projected = closestPointOnSegment(point, geometry[j], geometry[j + 1]);
		const km = haversineDistance(point, projected);
		if (km < bestKm) {
			bestKm = km;
			best = projected;
		}
	}
	return best;
}

@Injectable()
export class GenerationService {
	private readonly logger = new Logger(GenerationService.name);

	constructor(
		private readonly routing: RoutingService,
		private readonly eventEmitter: EventEmitter2,
	) {}

	async generate(request: GenerateRequestDto): Promise<GenerateResponseDto> {
		const startedAt = performance.now();
		let valhallaCalls = 0;
		const countCall = <T>(promise: Promise<T>): Promise<T> => {
			valhallaCalls++;
			return promise;
		};

		const emit = (outcome: "succeeded" | "failed", extra: Partial<RouteGenerationCompletedEvent> = {}) => {
			const event: RouteGenerationCompletedEvent = {
				outcome,
				activity: request.activity,
				durationMs: Math.round(performance.now() - startedAt),
				valhallaCalls,
				candidateCount: 0,
				...extra,
			};
			this.eventEmitter.emit(ROUTE_GENERATION_COMPLETED, event);
		};

		const fail = (code: GenerationFailureCode, bestOverlapPct?: number): GenerateResponseDto => {
			emit("failed", { failureCode: code, bestOverlapPct });
			return {
				candidates: [],
				failure: { code, ...(bestOverlapPct !== undefined ? { bestOverlapPct } : {}) },
			};
		};

		const start: Coordinate = [request.start.lon, request.start.lat];
		const costing = valhallaCostingFromPreferences(request.activity, request.preferences);

		const plans = planCandidateFan(start, request.heading, request.targetDistanceKm, request.excludeBearings);
		if (plans.length === 0) return fail("all_bearings_excluded");

		// One batched /locate validates the start and every via point: vias in
		// fields, water, or off-network get their candidate dropped or snapped
		// to the correlated road position (the dead-end-spur fix).
		let snappedPlans: CandidatePlan[];
		try {
			snappedPlans = await countCall(
				this.snapPlans(start, plans, request.targetDistanceKm, costing, request.preferences.surfacePreference),
			);
		} catch (err) {
			if (err instanceof GenerationFailure) return fail(err.failureCode);
			throw err;
		}
		if (snappedPlans.length === 0) return fail("no_candidates_routable");

		const scored = await this.routeAndScore(snappedPlans, start, request, costing, countCall);
		if (scored.length === 0) return fail("no_candidates_routable");

		scored.push(...(await this.surfaceWave(scored, plans, start, request, costing, countCall)));

		const selected = selectDiverseCandidates(scored);
		if (selected.length === 0) {
			const bestOverlap = Math.min(...scored.map((c) => c.score.overlap));
			return fail("all_candidates_low_quality", Math.round(bestOverlap * 100));
		}

		emit("succeeded", {
			candidateCount: selected.length,
			bestOverlapPct: Math.round(selected[0].score.overlap * 100),
		});

		return { candidates: selected.map((candidate) => this.toDto(candidate)) };
	}

	private async snapPlans(
		start: Coordinate,
		plans: CandidatePlan[],
		targetDistanceKm: number,
		costing: ValhallaCostingRequest,
		surfacePreference: SurfaceType,
	): Promise<CandidatePlan[]> {
		// A strict surface preference widens the via search so /locate returns
		// every edge within the nudge radius, not just the nearest; pickViaEdge
		// then snaps onto the preferred surface when one is in range.
		const viaRadius = surfacePreference === "mixed" ? undefined : SURFACE_NUDGE_RADIUS_M;
		const locations = [
			{ lat: start[1], lon: start[0] },
			...plans.flatMap((plan) =>
				plan.viaPoints.map(([lon, lat]) => (viaRadius ? { lat, lon, radius: viaRadius } : { lat, lon })),
			),
		];

		const results = await this.routing.callValhalla<ValhallaLocateResult[]>(
			"/locate",
			{
				locations,
				costing: costing.costing,
				costing_options: costing.costing_options,
				verbose: true,
			},
			"generation",
		);

		const snappedCoord = (result: ValhallaLocateResult | undefined, pref: SurfaceType): Coordinate | null => {
			const edge = pickViaEdge(result?.edges, pref);
			if (!edge) return null;
			return [edge.correlated_lon as number, edge.correlated_lat as number];
		};

		// /locate snaps generously (a point in open water correlates to a road
		// kilometers away), so presence of an edge is not enough: a snap that
		// moved the point too far would silently distort the loop instead of
		// failing honestly. Vias may drift up to half the loop radius; the
		// start barely at all (the user picked it deliberately).
		const radius = loopRadiusKm(targetDistanceKm);
		const maxViaSnapKm = Math.max(0.5, radius / 2);

		// The start never surface-nudges: the user picked it deliberately.
		const snappedStart = snappedCoord(results[0], "mixed");
		if (!snappedStart || haversineDistance(start, snappedStart) > MAX_START_SNAP_KM) {
			throw new GenerationFailure("start_not_routable");
		}

		const snapped: CandidatePlan[] = [];
		let cursor = 1;
		for (const plan of plans) {
			const vias: Coordinate[] = [];
			let viable = true;
			for (let i = 0; i < plan.viaPoints.length; i++) {
				const coord = snappedCoord(results[cursor + i], surfacePreference);
				if (!coord || haversineDistance(plan.viaPoints[i], coord) > maxViaSnapKm) {
					viable = false;
					break;
				}
				vias.push(coord);
			}
			cursor += plan.viaPoints.length;
			if (viable) snapped.push({ bearingDeg: plan.bearingDeg, viaPoints: vias });
		}
		return snapped;
	}

	private async routeAndScore(
		plans: CandidatePlan[],
		start: Coordinate,
		request: GenerateRequestDto,
		costing: ValhallaCostingRequest,
		countCall: <T>(promise: Promise<T>) => Promise<T>,
		options: { refineDistance: boolean } = { refineDistance: true },
	): Promise<(ScoredCandidate & { shape: string })[]> {
		const results: (ScoredCandidate & { shape: string })[] = [];
		const queue = [...plans];

		const worker = async () => {
			for (let plan = queue.shift(); plan; plan = queue.shift()) {
				try {
					const candidate = await this.buildCandidate(plan, start, request, costing, countCall, options);
					if (candidate) results.push(candidate);
				} catch (err) {
					// One failed candidate never sinks the generation; the fan has more.
					this.logger.warn(`Candidate at bearing ${plan.bearingDeg} failed: ${(err as Error).message}`);
				}
			}
		};

		await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_CANDIDATES, plans.length) }, () => worker()));
		return results;
	}

	// The surface wave (second-wave candidate tactic): when a strict surface
	// preference is still poorly met after the fan, exploit what the fan
	// learned. Harvest the matching surface runs from existing traces and route
	// a candidate anchored on them (the only lever that genuinely drags the
	// loop onto that network). Then iterate: each anchored loop crosses fresh
	// surface the fan never saw, so re-harvesting from it yields richer anchors
	// — a loop-until-no-improvement exploitation. If no anchors ever surface,
	// fall back to probing the bearings adjacent to the best-fitting candidate.
	private async surfaceWave(
		scored: (ScoredCandidate & { shape: string })[],
		fanPlans: CandidatePlan[],
		start: Coordinate,
		request: GenerateRequestDto,
		costing: ValhallaCostingRequest,
		countCall: <T>(promise: Promise<T>) => Promise<T>,
	): Promise<(ScoredCandidate & { shape: string })[]> {
		const pref = request.preferences.surfacePreference;
		if (pref === "mixed" || scored.length === 0) return [];
		const best = scored.reduce((a, b) => (b.score.surfaceFit > a.score.surfaceFit ? b : a));
		if (best.score.surfaceFit >= SURFACE_WAVE_TRIGGER_FIT) return [];

		const produced: (ScoredCandidate & { shape: string })[] = [];
		const pool = [...scored];
		let bestFit = best.score.surfaceFit;

		for (let round = 0; round < MAX_WAVE_ROUNDS; round++) {
			const anchors = collectSurfaceAnchors(pool, pref, start, request.targetDistanceKm);
			const plans = planSurfaceAnchoredCandidates(start, anchors, request.targetDistanceKm).filter(
				(plan) => !this.bearingAlreadySeen(plan.bearingDeg, request.excludeBearings),
			);
			// Anchor vias are midpoints of edges already traversed: on the network
			// by construction (no snap pass), and re-planning for distance would
			// rebuild the geometric ring (no refinement). Plans descend by via
			// count; take the first that routes, since many `through` points often
			// defeat the router.
			let routed: (ScoredCandidate & { shape: string }) | null = null;
			for (const plan of plans) {
				const [candidate] = await this.routeAndScore([plan], start, request, costing, countCall, {
					refineDistance: false,
				});
				// Forcing the loop through gravel can spur in and back out; a
				// candidate with too much overlap reads as dead-ends, so skip it
				// and let the cascade's fewer-via plans try a cleaner shape.
				if (candidate && candidate.score.overlap <= WAVE_MAX_OVERLAP) {
					routed = candidate;
					break;
				}
			}
			if (!routed) break;

			produced.push(routed);
			pool.push(routed);
			// Stop once a round stops meaningfully improving surface fit.
			if (routed.score.surfaceFit <= bestFit + WAVE_IMPROVEMENT_EPSILON) break;
			bestFit = routed.score.surfaceFit;
		}
		if (produced.length > 0) return produced;

		// No anchors ever surfaced: probe bearings adjacent to the best fit.
		const usedBearings = [...fanPlans.map((p) => p.bearingDeg), ...(request.excludeBearings ?? [])];
		const wavePlans = planSurfaceWave(start, best.plan.bearingDeg, request.targetDistanceKm, usedBearings);
		if (wavePlans.length === 0) return [];

		let snapped: CandidatePlan[];
		try {
			snapped = await countCall(this.snapPlans(start, wavePlans, request.targetDistanceKm, costing, pref));
		} catch {
			// The wave is opportunistic; the fan's candidates stand on their own.
			return [];
		}
		if (snapped.length === 0) return [];
		return this.routeAndScore(snapped, start, request, costing, countCall);
	}

	/** A regenerated anchored candidate would rebuild near the same bearing; skip it. */
	private bearingAlreadySeen(bearingDeg: number, excludeBearings: number[] | undefined): boolean {
		const delta = (a: number, b: number) => {
			const d = Math.abs(a - b) % 360;
			return d > 180 ? 360 - d : d;
		};
		return (excludeBearings ?? []).some((seen) => delta(bearingDeg, seen) < 10);
	}

	private async buildCandidate(
		plan: CandidatePlan,
		start: Coordinate,
		request: GenerateRequestDto,
		costing: ValhallaCostingRequest,
		countCall: <T>(promise: Promise<T>) => Promise<T>,
		options: { refineDistance: boolean } = { refineDistance: true },
	): Promise<(ScoredCandidate & { shape: string }) | null> {
		let activePlan = plan;
		let routed = await countCall(this.routeLoop(activePlan, start, costing));
		if (!routed) return null;

		// One-shot radius refinement when the routed distance misses badly.
		const refined = options.refineDistance
			? refinePlanForDistance(start, activePlan, request.targetDistanceKm, routed.distanceKm, plan.viaPoints.length)
			: null;
		if (refined) {
			const rerouted = await countCall(this.routeLoop(refined, start, costing));
			if (
				rerouted &&
				Math.abs(rerouted.distanceKm - request.targetDistanceKm) <
					Math.abs(routed.distanceKm - request.targetDistanceKm)
			) {
				routed = rerouted;
				activePlan = refined;
			}
		}

		// Spur repair: a via partway along a side road forces the loop to ride
		// in and back out (visible only after routing as a pinch around the
		// via). Move such vias to the pinch junction and route once more; the
		// loop then passes through naturally. Score decides which version wins.
		const repair = repairSpurVias(routed.geometry, activePlan.viaPoints, request.targetDistanceKm);
		let scored = await this.scoreRouted(activePlan, routed, request, countCall);
		if (repair.movedCount > 0) {
			const repairedPlan: CandidatePlan = { bearingDeg: activePlan.bearingDeg, viaPoints: repair.viaPoints };
			const rerouted = await countCall(this.routeLoop(repairedPlan, start, costing));
			if (rerouted) {
				const repairedScored = await this.scoreRouted(repairedPlan, rerouted, request, countCall);
				if (repairedScored.score.total > scored.score.total) scored = repairedScored;
			}
		}
		return scored;
	}

	private async scoreRouted(
		plan: CandidatePlan,
		routed: RoutedLeg,
		request: GenerateRequestDto,
		countCall: <T>(promise: Promise<T>) => Promise<T>,
	): Promise<ScoredCandidate & { shape: string }> {
		const costing = valhallaCostingFromPreferences(request.activity, request.preferences);
		const edges = await countCall(this.traceEdges(routed.shape, costing));

		const metersByBucket: Record<SurfaceBucket, number> = { paved: 0, compacted: 0, unpaved: 0, path: 0 };
		for (const edge of edges) {
			metersByBucket[bucketFromValhallaSurface(edge.surface)] += edge.lengthKm * 1000;
		}

		const candidate: RoutedCandidate = {
			plan,
			geometry: routed.geometry,
			distanceKm: routed.distanceKm,
			durationSeconds: routed.durationSeconds,
			edges,
		};
		const score = scoreCandidate(
			candidate,
			request.targetDistanceKm,
			request.preferences.surfacePreference,
			metersByBucket,
		);

		return {
			...candidate,
			score,
			metersByBucket,
			lowQuality: isLowQuality(score.overlap),
			shape: routed.shape,
		};
	}

	private async routeLoop(
		plan: CandidatePlan,
		start: Coordinate,
		costing: ValhallaCostingRequest,
	): Promise<RoutedLeg | null> {
		const data = await this.routing.callValhalla<ValhallaRouteResponse>(
			"/route",
			{
				locations: [
					{ lat: start[1], lon: start[0], type: "break" },
					// `through` forbids U-turns at via points: the router must pass
					// through and keep going, which is what makes the loop a loop.
					...plan.viaPoints.map(([lon, lat]) => ({ lat, lon, type: "through" })),
					{ lat: start[1], lon: start[0], type: "break" },
				],
				costing: costing.costing,
				costing_options: costing.costing_options,
				directions_options: { units: "kilometers" },
				format: "json",
			},
			"generation",
		);

		const legs = data.trip?.legs ?? [];
		if (data.error || legs.length === 0) return null;

		let distanceKm = 0;
		let durationSeconds = 0;
		const geometry: Coordinate[] = [];
		for (const leg of legs) {
			distanceKm += leg.summary?.length ?? 0;
			durationSeconds += leg.summary?.time ?? 0;
			if (typeof leg.shape !== "string") continue;
			const coords = decodePolyline6(leg.shape);
			if (geometry.length === 0) geometry.push(...coords);
			else geometry.push(...coords.slice(1));
		}
		if (geometry.length < 4) return null;

		const shape = legs.length === 1 && typeof legs[0].shape === "string" ? legs[0].shape : encodePolyline6(geometry);
		return { geometry, shape, distanceKm, durationSeconds };
	}

	private async traceEdges(shape: string, costing: ValhallaCostingRequest): Promise<CandidateEdge[]> {
		// The shape comes verbatim from Valhalla's own route response, but
		// edge_walk still rejects it when costing nuances differ; walk_or_snap
		// tries the exact walk first and falls back to map matching.
		const data = await this.routing.callValhalla<ValhallaTraceResponse>(
			"/trace_attributes",
			{
				encoded_polyline: shape,
				shape_match: "walk_or_snap",
				costing: costing.costing,
				costing_options: costing.costing_options,
				filters: {
					attributes: [
						"edge.way_id",
						"edge.surface",
						"edge.length",
						"edge.begin_heading",
						"edge.end_heading",
						"edge.begin_shape_index",
						"edge.end_shape_index",
						"shape",
					],
					action: "include",
				},
			},
			"generation",
		);

		// Edge midpoints (via the matched shape) feed surface-anchored planning.
		const matchedShape = typeof data.shape === "string" ? decodePolyline6(data.shape) : [];
		const midpointOf = (edge: ValhallaTraceEdge): Coordinate | undefined => {
			const begin = edge.begin_shape_index;
			const end = edge.end_shape_index;
			if (typeof begin !== "number" || typeof end !== "number" || begin > end) return undefined;
			return matchedShape[Math.floor((begin + end) / 2)];
		};

		return (data.edges ?? []).map((edge) => ({
			wayId: edge.way_id,
			lengthKm: edge.length ?? 0,
			surface: edge.surface,
			beginHeadingDeg: edge.begin_heading,
			endHeadingDeg: edge.end_heading,
			midpoint: midpointOf(edge),
		}));
	}

	private toDto(candidate: ScoredCandidate & { shape: string }): GenerationCandidateDto {
		return {
			bearingDeg: candidate.plan.bearingDeg,
			// Vias project onto the routed loop so waypoint markers sit exactly
			// on the road the loop uses (the locate snap can sit on a parallel
			// edge the router didn't pick).
			viaPoints: candidate.plan.viaPoints
				.map((via) => projectOntoGeometry(via, candidate.geometry))
				.map(([lon, lat]) => ({ lat, lon })),
			shape: candidate.shape,
			distanceKm: candidate.distanceKm,
			durationSeconds: candidate.durationSeconds,
			overlapPct: Math.round(candidate.score.overlap * 100),
			score: Number(candidate.score.total.toFixed(3)),
			lowQuality: candidate.lowQuality,
			surfaceMetersByBucket: {
				paved: Math.round(candidate.metersByBucket.paved),
				compacted: Math.round(candidate.metersByBucket.compacted),
				unpaved: Math.round(candidate.metersByBucket.unpaved),
				path: Math.round(candidate.metersByBucket.path),
			},
		};
	}
}
