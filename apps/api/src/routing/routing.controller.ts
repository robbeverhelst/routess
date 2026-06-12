import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ThrottleModerate } from "../common/decorators/throttle.decorator";
import { CuesService } from "./cues.service";
import { CuesRequestDto, CuesResponseDto } from "./dto/cues.dto";
import { RouteRequestDto, RoutingRouteResponseDto } from "./dto/route.dto";
import { TraceAttributesRequestDto, TraceAttributesResponseDto } from "./dto/trace-attributes.dto";
import { RoutingService } from "./routing.service";

@ApiTags("routing")
@Controller("routing")
export class RoutingController {
	constructor(
		private readonly routingService: RoutingService,
		private readonly cuesService: CuesService,
	) {}

	@ApiOperation({
		summary: "Match a recorded shape against the road network",
		description:
			"Forwards the shape to the self-hosted Valhalla `trace_attributes` endpoint and returns per-edge surface data. Used by the web app to render surface composition for a Route.",
	})
	@ApiBody({ type: TraceAttributesRequestDto })
	@ApiResponse({ status: 200, description: "Edge attributes", type: TraceAttributesResponseDto })
	@ApiResponse({ status: 502, description: "Valhalla returned an error" })
	@ApiResponse({ status: 503, description: "Valhalla is not configured or unreachable" })
	@ThrottleModerate()
	@HttpCode(HttpStatus.OK)
	@Post("trace-attributes")
	traceAttributes(@Body() body: TraceAttributesRequestDto): Promise<TraceAttributesResponseDto> {
		return this.routingService.traceAttributes(body);
	}

	@ApiOperation({
		summary: "Compute a route through ordered locations with structured preferences",
		description:
			"Forwards locations + RoutingPreferences to the self-hosted Valhalla `/route` endpoint. The API owns the translation from Routess preferences (SurfaceType, avoidFerries, avoidHighways) to Valhalla costing options, so the browser never sees provider-specific knobs.",
	})
	@ApiBody({ type: RouteRequestDto })
	@ApiResponse({ status: 200, description: "Route legs and snapped locations", type: RoutingRouteResponseDto })
	@ApiResponse({ status: 502, description: "Valhalla returned an error or no path" })
	@ApiResponse({ status: 503, description: "Valhalla is not configured or unreachable" })
	@ThrottleModerate()
	@HttpCode(HttpStatus.OK)
	@Post("route")
	route(@Body() body: RouteRequestDto): Promise<RoutingRouteResponseDto> {
		return this.routingService.route(body);
	}

	@ApiOperation({
		summary: "Derive navigation Cues for a RoutePath",
		description:
			"Map-matches the geometry through Valhalla `trace_route` for street-level ManeuverCues and decorates it with NodeNetwork passages (NodeCues). Cue anchors are projected onto the stored RoutePath, which stays canonical. Accepts a public/unlisted route id, an external route id, or raw geometry. See ADR 0038.",
	})
	@ApiBody({ type: CuesRequestDto })
	@ApiResponse({ status: 200, description: "Ordered cues along the RoutePath", type: CuesResponseDto })
	@ApiResponse({ status: 400, description: "Invalid geometry selector" })
	@ApiResponse({ status: 404, description: "Route not found or not navigable anonymously" })
	@ThrottleModerate()
	@HttpCode(HttpStatus.OK)
	@Post("cues")
	cues(@Body() body: CuesRequestDto): Promise<CuesResponseDto> {
		return this.cuesService.cues(body);
	}
}
