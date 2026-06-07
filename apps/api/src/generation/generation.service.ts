import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
	bucketFromValhallaSurface,
	type CandidateEdge,
	type CandidatePlan,
	type Coordinate,
	closestPointOnSegment,
	decodePolyline6,
	encodePolyline6,
	type GenerationFailureCode,
	haversineDistance,
	isLowQuality,
	loopRadiusKm,
	planCandidateFan,
	type RoutedCandidate,
	refinePlanForDistance,
	repairSpurVias,
	type ScoredCandidate,
	type SurfaceBucket,
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
		classification?: { classification?: string; use?: string };
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

function pickViaEdge(edges: ValhallaLocateEdge[] | null | undefined): ValhallaLocateEdge | null {
	const usable = (edges ?? []).filter(
		(e) => typeof e.correlated_lat === "number" && typeof e.correlated_lon === "number",
	);
	if (usable.length === 0) return null;
	const preferred = usable.filter((e) => {
		const use = e.edge?.classification?.use ?? "";
		const reach = Math.min(e.outbound_reach ?? 0, e.inbound_reach ?? 0);
		return !BAD_EDGE_USES.has(use) && reach >= MIN_EDGE_REACH;
	});
	const pool = preferred.length > 0 ? preferred : usable;
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
}

interface ValhallaTraceResponse {
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
			snappedPlans = await countCall(this.snapPlans(start, plans, request.targetDistanceKm, costing));
		} catch (err) {
			if (err instanceof GenerationFailure) return fail(err.failureCode);
			throw err;
		}
		if (snappedPlans.length === 0) return fail("no_candidates_routable");

		const scored = await this.routeAndScore(snappedPlans, start, request, costing, countCall);
		if (scored.length === 0) return fail("no_candidates_routable");

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
	): Promise<CandidatePlan[]> {
		const locations = [
			{ lat: start[1], lon: start[0] },
			...plans.flatMap((plan) => plan.viaPoints.map(([lon, lat]) => ({ lat, lon }))),
		];

		const results = await this.routing.callValhalla<ValhallaLocateResult[]>("/locate", {
			locations,
			costing: costing.costing,
			costing_options: costing.costing_options,
			verbose: true,
		});

		const snappedCoord = (result: ValhallaLocateResult | undefined): Coordinate | null => {
			const edge = pickViaEdge(result?.edges);
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

		const snappedStart = snappedCoord(results[0]);
		if (!snappedStart || haversineDistance(start, snappedStart) > MAX_START_SNAP_KM) {
			throw new GenerationFailure("start_not_routable");
		}

		const snapped: CandidatePlan[] = [];
		let cursor = 1;
		for (const plan of plans) {
			const vias: Coordinate[] = [];
			let viable = true;
			for (let i = 0; i < plan.viaPoints.length; i++) {
				const coord = snappedCoord(results[cursor + i]);
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
	): Promise<(ScoredCandidate & { shape: string })[]> {
		const results: (ScoredCandidate & { shape: string })[] = [];
		const queue = [...plans];

		const worker = async () => {
			for (let plan = queue.shift(); plan; plan = queue.shift()) {
				try {
					const candidate = await this.buildCandidate(plan, start, request, costing, countCall);
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

	private async buildCandidate(
		plan: CandidatePlan,
		start: Coordinate,
		request: GenerateRequestDto,
		costing: ValhallaCostingRequest,
		countCall: <T>(promise: Promise<T>) => Promise<T>,
	): Promise<(ScoredCandidate & { shape: string }) | null> {
		let activePlan = plan;
		let routed = await countCall(this.routeLoop(activePlan, start, costing));
		if (!routed) return null;

		// One-shot radius refinement when the routed distance misses badly.
		const refined = refinePlanForDistance(start, activePlan, request.targetDistanceKm, routed.distanceKm);
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
		const data = await this.routing.callValhalla<ValhallaRouteResponse>("/route", {
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
		});

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
		const data = await this.routing.callValhalla<ValhallaTraceResponse>("/trace_attributes", {
			encoded_polyline: shape,
			shape_match: "walk_or_snap",
			costing: costing.costing,
			costing_options: costing.costing_options,
			filters: {
				attributes: ["edge.way_id", "edge.surface", "edge.length", "edge.begin_heading", "edge.end_heading"],
				action: "include",
			},
		});

		return (data.edges ?? []).map((edge) => ({
			wayId: edge.way_id,
			lengthKm: edge.length ?? 0,
			surface: edge.surface,
			beginHeadingDeg: edge.begin_heading,
			endHeadingDeg: edge.end_heading,
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
