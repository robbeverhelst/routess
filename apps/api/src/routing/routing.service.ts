import { HttpException, HttpStatus, Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import type {
	TraceAttributesEdgeDto,
	TraceAttributesRequestDto,
	TraceAttributesResponseDto,
} from "./dto/trace-attributes.dto";

interface ValhallaTraceAttributesResponse {
	edges?: TraceAttributesEdgeDto[];
	shape?: string;
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
		const baseUrl = this.config.routing.valhallaUrl;
		if (!baseUrl) {
			throw new ServiceUnavailableException("Valhalla routing is not configured");
		}

		const body = {
			shape: request.shape,
			shape_match: "map_snap",
			costing: request.costing,
			filters: {
				attributes: ["edge.surface", "edge.length", "edge.begin_shape_index", "edge.end_shape_index", "shape"],
				action: "include",
			},
		};

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), VALHALLA_TIMEOUT_MS);
		let response: Response;
		try {
			response = await fetch(`${baseUrl}/trace_attributes`, {
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
			this.logger.warn(`Valhalla returned ${response.status}`);
			// Surface 4xx/5xx as a generic upstream error; do not leak Valhalla's body.
			throw new HttpException("Valhalla returned an error", HttpStatus.BAD_GATEWAY);
		}

		const data = (await response.json()) as ValhallaTraceAttributesResponse;
		return {
			edges: data.edges ?? [],
			shape: data.shape,
		};
	}
}
