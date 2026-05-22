import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ThrottleModerate } from "../common/decorators/throttle.decorator";
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
}
