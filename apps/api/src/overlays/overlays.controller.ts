import { Controller, Get, Header, Query } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ThrottleModerate } from "../common/decorators/throttle.decorator";
import { NodeNetworkQueryDto } from "./dto/node-network-query.dto";
import { OverlaysService } from "./overlays.service";
import type { NodeFeatureCollection } from "./overpass";

@ApiTags("overlays")
@Controller("overlays")
export class OverlaysController {
	constructor(private readonly overlaysService: OverlaysService) {}

	@ApiOperation({
		summary: "Node network (knooppunten) overlay for a bbox",
		description:
			"Returns hiking/cycling node-network features as GeoJSON. The API quantizes the bbox to fixed grid cells cached server-side, so one Overpass fetch per cell serves every user (ADR 0031). Anonymous-accessible; the overlay works before sign-in.",
	})
	@ApiResponse({ status: 200, description: "GeoJSON FeatureCollection of nodes and connections" })
	@ApiResponse({ status: 400, description: "Bbox invalid or covering too many grid cells" })
	@ApiResponse({ status: 503, description: "Overpass endpoints are unreachable" })
	@ThrottleModerate()
	// Public, slow-changing OSM data: let the edge and browser hold it for an
	// hour. Not visibility-governed, so this may exceed VisibilityPropagation.
	@Header("Cache-Control", "public, max-age=3600, s-maxage=3600")
	@Get("node-network")
	nodeNetwork(@Query() query: NodeNetworkQueryDto): Promise<NodeFeatureCollection> {
		return this.overlaysService.nodeNetwork(query);
	}
}
