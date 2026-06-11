import { Controller, Get, Header, Param, ParseIntPipe, Res } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { buildRouteGpx } from "@routess/core";
import type { Response } from "express";
import { ThrottleModerate } from "../common/decorators/throttle.decorator";
import { ExternalRouteResponseDto } from "./dto/external-route-response.dto";
import { ExternalRoutesService } from "./external-routes.service";

// Public, anonymous read surface for seeded ExternalRoutes (ADR 0035). They are
// always public, so there is no auth, visibility, or share-token logic here —
// just id-addressed detail and GPX with attribution embedded.
@ApiTags("external-routes")
@Controller("external-routes")
export class ExternalRoutesController {
	constructor(private readonly externalRoutesService: ExternalRoutesService) {}

	@ApiOperation({
		summary: "Download external route as GPX",
		description: "GPX 1.1 with the SeedSource attribution embedded as <copyright> (license obligation, ADR 0035).",
	})
	@ApiParam({ name: "id", description: "External route ID", type: "number" })
	@ApiResponse({ status: 200, description: "GPX document" })
	@ApiResponse({ status: 404, description: "External route not found" })
	@ThrottleModerate()
	@Get(":id/gpx")
	async downloadGpx(@Param("id", ParseIntPipe) id: number, @Res() res: Response): Promise<void> {
		const route = await this.externalRoutesService.findEntityForGpx(id);
		const source = route.source as unknown as { attribution: string; sourceUrl: string };
		const gpx = buildRouteGpx({
			name: route.name,
			description: route.description,
			waypoints: [],
			geometry: route.geometry,
			attribution: source.attribution,
			sourceUrl: source.sourceUrl,
		});
		const filename = `${route.name.replace(/[^a-z0-9-]+/gi, "-")}-x${route.id}.gpx`;
		res.setHeader("Content-Type", "application/gpx+xml; charset=utf-8");
		res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
		res.send(gpx);
	}

	@ApiOperation({
		summary: "Get an external route by ID",
		description: "Detail for a seeded ExternalRoute, addressed by its numeric id (the '-x{id}' page form).",
	})
	@ApiParam({ name: "id", description: "External route ID", type: "number" })
	@ApiResponse({ status: 200, type: ExternalRouteResponseDto })
	@ApiResponse({ status: 404, description: "External route not found" })
	@ThrottleModerate()
	@Header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=300")
	@Get(":id")
	findOne(@Param("id", ParseIntPipe) id: number): Promise<ExternalRouteResponseDto> {
		return this.externalRoutesService.findById(id);
	}
}
