import { Controller, Get, Header, Query } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ThrottleModerate } from "../common/decorators/throttle.decorator";
import { RegionalHubDto, RegionalHubsQueryDto } from "./dto/regional-hub.dto";
import { RegionalHubsService } from "./regional-hubs.service";

// Anonymous read surface for RegionalHubs: places with enough Indexable
// routes to carry a hub page on the landing hosts (CONTEXT.md "RegionalHub").
@ApiTags("places")
@Controller("places")
export class PlacesController {
	constructor(private readonly regionalHubs: RegionalHubsService) {}

	@ApiOperation({
		summary: "List RegionalHubs",
		description:
			"Places with at least 5 Indexable routes (Route + ExternalRoute, read-time union per ADR 0035) for the given activity. Feeds the landing hub pages and their sitemap segment; places below the threshold are absent, so a missing slug means the hub page must 404.",
	})
	@ApiResponse({ status: 200, type: RegionalHubDto, isArray: true })
	@ThrottleModerate()
	// Viewer-invariant aggregate: safe for edge caching within the
	// VisibilityPropagation bound (ADR 0032), same policy as /routes/public.
	@Header("Cache-Control", "public, max-age=15, s-maxage=30, stale-while-revalidate=30")
	@Get("hubs")
	findHubs(@Query() query: RegionalHubsQueryDto): Promise<RegionalHubDto[]> {
		return this.regionalHubs.findHubs(query.activity);
	}
}
