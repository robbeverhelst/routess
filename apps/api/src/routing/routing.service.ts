import { HttpException, HttpStatus, Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { valhallaCostingFromPreferences } from "@routess/core";
import { CacheService } from "../cache/cache.service";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { MetricsService } from "../telemetry/metrics.service";
import type { RouteLegDto, RouteRequestDto, RouteSnappedLocationDto, RoutingRouteResponseDto } from "./dto/route.dto";
import type {
	TraceAttributesEdgeDto,
	TraceAttributesRequestDto,
	TraceAttributesResponseDto,
} from "./dto/trace-attributes.dto";

interface ValhallaTraceAttributesResponse {
	edges?: TraceAttributesEdgeDto[];
	shape?: string;
}

interface ValhallaTripLeg {
	shape?: string;
	summary?: { length?: number; time?: number };
}

interface ValhallaTripLocation {
	lat?: number;
	lon?: number;
	original_index?: number;
}

interface ValhallaRouteResponse {
	trip?: {
		legs?: ValhallaTripLeg[];
		locations?: ValhallaTripLocation[];
	};
	error?: string;
	error_code?: number;
}

const VALHALLA_TIMEOUT_MS = 8000;

// trace_attributes is a pure function of (shape, costing): same geometry
// always classifies the same until the OSM tiles refresh. /route is less
// cacheable (waypoint combos are near-unique) but a shorter TTL still dedupes
// generation-pipeline repeats and recalcs of saved routes. See ADR 0032.
const TRACE_CACHE_TTL_S = 30 * 24 * 60 * 60;
const ROUTE_CACHE_TTL_S = 7 * 24 * 60 * 60;

// The routing endpoints are reachable without auth (planning works before
// sign-in), so per-IP throttling alone can be sidestepped with enough IPs.
// This cap bounds the total concurrent upstream work one API replica can
// drive into Valhalla; excess requests are shed with a 503 instead of queued.
const MAX_CONCURRENT_VALHALLA_CALLS = 32;

@Injectable()
export class RoutingService {
	private readonly logger = new Logger(RoutingService.name);
	private inFlightValhallaCalls = 0;

	constructor(
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
		private readonly metrics: MetricsService,
		private readonly cache: CacheService,
	) {}

	async traceAttributes(request: TraceAttributesRequestDto): Promise<TraceAttributesResponseDto> {
		const cacheKey = this.cache.hashKey({ shape: request.shape, costing: request.costing });
		return this.cache.getOrSet("valhalla-trace", cacheKey, TRACE_CACHE_TTL_S, async () => {
			const data = await this.callValhalla<ValhallaTraceAttributesResponse>("/trace_attributes", {
				shape: request.shape,
				shape_match: "map_snap",
				costing: request.costing,
				filters: {
					attributes: ["edge.surface", "edge.length", "edge.begin_shape_index", "edge.end_shape_index", "shape"],
					action: "include",
				},
			});

			return {
				edges: data.edges ?? [],
				shape: data.shape,
			};
		});
	}

	async route(request: RouteRequestDto): Promise<RoutingRouteResponseDto> {
		const costing = valhallaCostingFromPreferences(request.activity, request.preferences, {
			walkingSpeedKmh: request.walkingSpeedKmh,
		});
		const locations = request.locations.map((l) => ({ lat: l.lat, lon: l.lon }));
		const cacheKey = this.cache.hashKey({ locations, costing });
		return this.cache.getOrSet("valhalla-route", cacheKey, ROUTE_CACHE_TTL_S, () =>
			this.computeRoute(locations, costing),
		);
	}

	private async computeRoute(
		locations: { lat: number; lon: number }[],
		costing: ReturnType<typeof valhallaCostingFromPreferences>,
	): Promise<RoutingRouteResponseDto> {
		const data = await this.callValhalla<ValhallaRouteResponse>("/route", {
			locations,
			costing: costing.costing,
			costing_options: costing.costing_options,
			directions_options: { units: "kilometers" },
			format: "json",
		});

		if (data.error || !data.trip?.legs?.length) {
			this.logger.warn(`Valhalla /route returned no trip: ${data.error ?? "empty legs"}`);
			throw new HttpException(data.error ?? "Valhalla returned no trip", HttpStatus.BAD_GATEWAY);
		}

		const legs: RouteLegDto[] = data.trip.legs
			.filter((leg): leg is Required<Pick<ValhallaTripLeg, "shape">> & ValhallaTripLeg => typeof leg.shape === "string")
			.map((leg) => ({
				shape: leg.shape,
				summary: {
					length: leg.summary?.length ?? 0,
					time: leg.summary?.time ?? 0,
				},
			}));

		const snappedLocations: RouteSnappedLocationDto[] = (data.trip.locations ?? [])
			.filter((loc): loc is Required<Pick<ValhallaTripLocation, "lat" | "lon">> & ValhallaTripLocation => {
				return typeof loc.lat === "number" && typeof loc.lon === "number";
			})
			.map((loc) => ({
				lat: loc.lat,
				lon: loc.lon,
				original_index: loc.original_index,
			}));

		return { legs, locations: snappedLocations };
	}

	// Public so GenerationModule can drive its candidate fan through the same
	// concurrency cap and timeout instead of opening a second path to Valhalla.
	async callValhalla<T>(path: string, body: unknown, feature = "routing"): Promise<T> {
		const baseUrl = this.config.routing.valhallaUrl;
		if (!baseUrl) {
			throw new ServiceUnavailableException("Valhalla routing is not configured");
		}

		if (this.inFlightValhallaCalls >= MAX_CONCURRENT_VALHALLA_CALLS) {
			this.logger.warn(`Valhalla concurrency cap (${MAX_CONCURRENT_VALHALLA_CALLS}) reached, shedding request`);
			throw new ServiceUnavailableException("Routing is busy, try again shortly");
		}

		this.inFlightValhallaCalls++;
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), VALHALLA_TIMEOUT_MS);
		const start = Date.now();
		let response: Response;
		try {
			response = await fetch(`${baseUrl}${path}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
				signal: controller.signal,
			});
		} catch (err) {
			const error = err as Error;
			this.metrics.recordExternalRequest("valhalla", "error", Date.now() - start);
			this.metrics.recordProviderCall("valhalla", path, feature, "error");
			this.logger.warn(`Valhalla request failed: ${error.message}`);
			throw new ServiceUnavailableException("Valhalla request failed");
		} finally {
			clearTimeout(timeout);
			this.inFlightValhallaCalls--;
		}

		this.metrics.recordExternalRequest("valhalla", response.ok ? "success" : "error", Date.now() - start);
		this.metrics.recordProviderCall("valhalla", path, feature, response.ok ? "success" : "error");

		if (!response.ok) {
			this.logger.warn(`Valhalla returned ${response.status} for ${path}`);
			// Surface 4xx/5xx as a generic upstream error; do not leak Valhalla's body.
			throw new HttpException("Valhalla returned an error", HttpStatus.BAD_GATEWAY);
		}

		return (await response.json()) as T;
	}
}
