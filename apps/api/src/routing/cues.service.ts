import { EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
	buildPathIndex,
	type Coordinate,
	decodePolyline6,
	downsampleCoordinates,
	encodePolyline6,
	type PathIndex,
	projectOntoPath,
	type RouteActivity,
	routeBoundingBox,
	valhallaCostingModelForActivity,
} from "@routess/core";
import { CacheService } from "../cache/cache.service";
import { ExternalRoute } from "../entities/external-route.entity";
import { Route } from "../entities/route.entity";
import { NodeNetworksService, nodeKindForActivity } from "../generation/node-networks.service";
import { type CueDto, type CueLocale, type CuesRequestDto, CuesResponseDto } from "./dto/cues.dto";
import { RoutingService } from "./routing.service";

// Cue derivation for NavigationSessions (ADR 0038): map-match the stored
// RoutePath through Valhalla trace_route for ManeuverCues, decorate with
// NodeNetwork passages for NodeCues, and anchor everything back onto the
// stored geometry, which stays canonical. Cues are derived data: cached per
// ADR 0032, never persisted.

// Same invalidation profile as /route responses: cues change only when the
// Valhalla tiles or the geometry change, and the key hashes the geometry.
const CUES_CACHE_TTL_S = 7 * 24 * 60 * 60;

// Valhalla's trace service caps shape size; long external routes are
// downsampled for the match only. Cue anchors still land on the full path.
const MAX_TRACE_SHAPE_POINTS = 8000;

const MIN_GEOMETRY_POINTS = 2;
const MAX_GEOMETRY_POINTS = 50_000;

// A Node passage is the geometry passing within this distance of a Node.
const NODE_PASSAGE_METERS = 25;
// The same ref within this window is one passage, not two.
const NODE_DEDUPE_METERS = 200;

const VALHALLA_LANGUAGE: Record<CueLocale, string> = {
	en: "en-US",
	nl: "nl-NL",
	fr: "fr-FR",
	de: "de-DE",
};

// The two cue texts we synthesize ourselves (Valhalla narrates the rest).
const NODE_CUE_TEXT: Record<CueLocale, (ref: string, next: string) => string> = {
	en: (ref, next) => `At node ${ref}, head toward node ${next}`,
	nl: (ref, next) => `Bij knooppunt ${ref}, richting knooppunt ${next}`,
	fr: (ref, next) => `Au point-nœud ${ref}, direction point-nœud ${next}`,
	de: (ref, next) => `Am Knotenpunkt ${ref} Richtung Knotenpunkt ${next}`,
};

const FOLLOW_PATH_TEXT: Record<CueLocale, string> = {
	en: "Follow the route",
	nl: "Volg de route",
	fr: "Suivez l'itinéraire",
	de: "Folge der Route",
};

interface ValhallaManeuver {
	type?: number;
	instruction?: string;
	street_names?: string[];
	begin_shape_index?: number;
	length?: number;
}

interface ValhallaTraceRouteResponse {
	trip?: {
		legs?: { shape?: string; maneuvers?: ValhallaManeuver[] }[];
	};
}

@Injectable()
export class CuesService {
	private readonly logger = new Logger(CuesService.name);

	constructor(
		private readonly routing: RoutingService,
		private readonly cache: CacheService,
		private readonly nodeNetworks: NodeNetworksService,
		@InjectRepository(Route)
		private readonly routeRepository: EntityRepository<Route>,
		@InjectRepository(ExternalRoute)
		private readonly externalRouteRepository: EntityRepository<ExternalRoute>,
	) {}

	async cues(request: CuesRequestDto): Promise<CuesResponseDto> {
		const geometry = await this.resolveGeometry(request);
		const locale: CueLocale = request.locale ?? "en";
		const cacheKey = this.cache.hashKey({
			geometry: encodePolyline6(geometry),
			activity: request.activity,
			locale,
		});

		try {
			const cues = await this.cache.getOrSet<CueDto[]>("valhalla-cues", cacheKey, CUES_CACHE_TTL_S, () =>
				this.buildCues(geometry, request.activity, locale),
			);
			return { cues, degraded: false };
		} catch (err) {
			// Degrade honestly instead of failing the session: one follow-the-path
			// cue, not cached, so recovery is immediate once Valhalla is back.
			this.logger.warn(`Cue derivation degraded to followPath: ${(err as Error).message}`);
			return {
				cues: [{ kind: "followPath", shapeIndex: 0, distanceAlongMeters: 0, text: FOLLOW_PATH_TEXT[locale] }],
				degraded: true,
			};
		}
	}

	private async resolveGeometry(request: CuesRequestDto): Promise<Coordinate[]> {
		const provided = [request.routeId, request.externalRouteId, request.geometry].filter((v) => v != null);
		if (provided.length !== 1) {
			throw new BadRequestException("Provide exactly one of routeId, externalRouteId, or geometry");
		}

		let geometry: Coordinate[] | undefined;
		if (request.routeId != null) {
			// Anonymous endpoint: private routes do not resolve by id (owners hold
			// the geometry and send it by value), and they 404 rather than 403 so
			// ids stay unenumerable, matching the public route pages.
			const route = await this.routeRepository.findOne({
				id: request.routeId,
				visibility: { $in: ["public", "unlisted"] },
			});
			if (!route) throw new NotFoundException("Route not found");
			geometry = route.geometry;
		} else if (request.externalRouteId != null) {
			const route = await this.externalRouteRepository.findOne({ id: request.externalRouteId });
			if (!route) throw new NotFoundException("External route not found");
			geometry = route.geometry;
		} else if (request.geometry) {
			geometry = decodePolyline6(request.geometry);
		}

		if (!geometry || geometry.length < MIN_GEOMETRY_POINTS) {
			throw new BadRequestException("Route has no navigable geometry");
		}
		if (geometry.length > MAX_GEOMETRY_POINTS) {
			throw new BadRequestException(`Geometry exceeds ${MAX_GEOMETRY_POINTS} points`);
		}
		return geometry;
	}

	private async buildCues(geometry: Coordinate[], activity: RouteActivity, locale: CueLocale): Promise<CueDto[]> {
		const pathIndex = buildPathIndex(geometry);
		const maneuverCues = await this.maneuverCues(geometry, pathIndex, activity, locale);
		const nodeCues = await this.nodeCues(geometry, pathIndex, activity, locale);
		return [...maneuverCues, ...nodeCues].sort((a, b) => a.distanceAlongMeters - b.distanceAlongMeters);
	}

	private async maneuverCues(
		geometry: Coordinate[],
		pathIndex: PathIndex,
		activity: RouteActivity,
		locale: CueLocale,
	): Promise<CueDto[]> {
		const traceShape =
			geometry.length > MAX_TRACE_SHAPE_POINTS ? downsampleCoordinates(geometry, MAX_TRACE_SHAPE_POINTS) : geometry;

		const data = await this.routing.callValhalla<ValhallaTraceRouteResponse>(
			"/trace_route",
			{
				shape: traceShape.map(([lng, lat]) => ({ lat, lon: lng })),
				shape_match: "map_snap",
				costing: valhallaCostingModelForActivity(activity),
				directions_options: { units: "kilometers", language: VALHALLA_LANGUAGE[locale] },
			},
			"navigation",
		);

		const legs = data.trip?.legs ?? [];
		if (legs.length === 0) throw new Error("trace_route returned no legs");

		// Maneuver shape indices point into the leg's own matched shape, which
		// can deviate from the stored RoutePath. Project each maneuver's matched
		// coordinate back onto the stored path: the client never sees the matched
		// geometry, so every surface stays in agreement (ADR 0038).
		const cues: CueDto[] = [];
		let hint = 0;
		for (const leg of legs) {
			const matchedShape = leg.shape ? decodePolyline6(leg.shape) : [];
			if (matchedShape.length === 0) continue;
			for (const maneuver of leg.maneuvers ?? []) {
				const matchedCoord = matchedShape[Math.min(maneuver.begin_shape_index ?? 0, matchedShape.length - 1)];
				if (!matchedCoord || !maneuver.instruction) continue;
				const projection = projectOntoPath(pathIndex, matchedCoord, hint);
				hint = projection.segmentIndex;
				cues.push({
					kind: "maneuver",
					shapeIndex: projection.segmentIndex,
					distanceAlongMeters: Math.round(projection.distanceAlongMeters),
					text: maneuver.instruction,
					streetNames: maneuver.street_names,
					maneuverType: maneuver.type,
				});
			}
		}
		if (cues.length === 0) throw new Error("trace_route returned no maneuvers");
		return cues;
	}

	// NodeCues decorate, never replace (CONTEXT.md "Cue"): detection failures
	// degrade to ordinary turn-by-turn, so this is strictly fail-open.
	private async nodeCues(
		geometry: Coordinate[],
		pathIndex: PathIndex,
		activity: RouteActivity,
		locale: CueLocale,
	): Promise<CueDto[]> {
		try {
			const bbox = routeBoundingBox(geometry);
			if (!bbox) return [];
			const anchors = await this.nodeNetworks.anchorsForBbox(
				{ minLon: bbox.minLng, minLat: bbox.minLat, maxLon: bbox.maxLng, maxLat: bbox.maxLat },
				nodeKindForActivity(activity),
			);

			const passages: { ref: string; shapeIndex: number; distanceAlongMeters: number }[] = [];
			for (const anchor of anchors) {
				if (!anchor.ref) continue;
				const projection = projectOntoPath(pathIndex, anchor.coordinate);
				if (projection.distanceFromPathMeters > NODE_PASSAGE_METERS) continue;
				passages.push({
					ref: anchor.ref,
					shapeIndex: projection.segmentIndex,
					distanceAlongMeters: Math.round(projection.distanceAlongMeters),
				});
			}

			passages.sort((a, b) => a.distanceAlongMeters - b.distanceAlongMeters);
			const deduped = passages.filter(
				(p, i) =>
					i === 0 ||
					p.ref !== passages[i - 1].ref ||
					p.distanceAlongMeters - passages[i - 1].distanceAlongMeters > NODE_DEDUPE_METERS,
			);

			// "At node 47, head toward 52" needs a 52: the last passage has no
			// next node to point at, so it emits nothing.
			return deduped.slice(0, -1).map((passage, i) => ({
				kind: "node" as const,
				shapeIndex: passage.shapeIndex,
				distanceAlongMeters: passage.distanceAlongMeters,
				text: NODE_CUE_TEXT[locale](passage.ref, deduped[i + 1].ref),
				nodeRef: passage.ref,
				nodeNextRef: deduped[i + 1].ref,
			}));
		} catch (err) {
			this.logger.warn(`Node cue decoration unavailable: ${(err as Error).message}`);
			return [];
		}
	}
}
