import { HttpException, HttpStatus, Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { valhallaCostingFromPreferences } from "@routess/core";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import type { RouteLegDto, RouteRequestDto, RouteResponseDto, RouteSnappedLocationDto } from "./dto/route.dto";
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

@Injectable()
export class RoutingService {
	private readonly logger = new Logger(RoutingService.name);

	constructor(
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
	) {}

	async traceAttributes(request: TraceAttributesRequestDto): Promise<TraceAttributesResponseDto> {
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
	}

	async route(request: RouteRequestDto): Promise<RouteResponseDto> {
		const costing = valhallaCostingFromPreferences(request.activity, request.preferences, {
			walkingSpeedMps: request.walkingSpeedMps,
		});
		const data = await this.callValhalla<ValhallaRouteResponse>("/route", {
			locations: request.locations.map((l) => ({ lat: l.lat, lon: l.lon })),
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

		const locations: RouteSnappedLocationDto[] = (data.trip.locations ?? [])
			.filter((loc): loc is Required<Pick<ValhallaTripLocation, "lat" | "lon">> & ValhallaTripLocation => {
				return typeof loc.lat === "number" && typeof loc.lon === "number";
			})
			.map((loc) => ({
				lat: loc.lat,
				lon: loc.lon,
				original_index: loc.original_index,
			}));

		return { legs, locations };
	}

	private async callValhalla<T>(path: string, body: unknown): Promise<T> {
		const baseUrl = this.config.routing.valhallaUrl;
		if (!baseUrl) {
			throw new ServiceUnavailableException("Valhalla routing is not configured");
		}

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), VALHALLA_TIMEOUT_MS);
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
			this.logger.warn(`Valhalla request failed: ${error.message}`);
			throw new ServiceUnavailableException("Valhalla request failed");
		} finally {
			clearTimeout(timeout);
		}

		if (!response.ok) {
			this.logger.warn(`Valhalla returned ${response.status} for ${path}`);
			// Surface 4xx/5xx as a generic upstream error; do not leak Valhalla's body.
			throw new HttpException("Valhalla returned an error", HttpStatus.BAD_GATEWAY);
		}

		return (await response.json()) as T;
	}
}
