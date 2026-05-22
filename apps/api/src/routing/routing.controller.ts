import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ThrottleModerate } from "../common/decorators/throttle.decorator";
import { RouteRequestDto, RouteResponseDto } from "./dto/route.dto";
import { TraceAttributesRequestDto, TraceAttributesResponseDto } from "./dto/trace-attributes.dto";
import { RoutingService } from "./routing.service";

@ApiTags("routing")
@Controller("routing")
export class RoutingController {
	constructor(private readonly routingService: RoutingService) {}

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
			"Forwards locations + RoutingPreferences to the self-hosted Valhalla `/route` endpoint. The API owns the translation from Routess preferences (SurfaceType, HillPreference, BikeType, avoidFerries, avoidHighways) to Valhalla costing options, so the browser never sees provider-specific knobs.",
	})
	@ApiBody({ type: RouteRequestDto })
	@ApiResponse({ status: 200, description: "Route legs and snapped locations", type: RouteResponseDto })
	@ApiResponse({ status: 502, description: "Valhalla returned an error or no path" })
	@ApiResponse({ status: 503, description: "Valhalla is not configured or unreachable" })
	@ThrottleModerate()
	@HttpCode(HttpStatus.OK)
	@Post("route")
	route(@Body() body: RouteRequestDto): Promise<RouteResponseDto> {
		return this.routingService.route(body);
	}
}
