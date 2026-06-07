import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	Query,
	Res,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser, OptionalCurrentUser } from "../auth/decorators/current-user.decorator";
import { RequireConfirmation } from "../auth/decorators/require-confirmation.decorator";
import { RequireScope } from "../auth/decorators/require-scope.decorator";
import { ConfirmationGuard } from "../auth/guards/confirmation.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { ScopeGuard } from "../auth/guards/scope.guard";
import { UnifiedAuthGuard } from "../auth/guards/unified-auth.guard";
import { ThrottleModerate, ThrottleStrict } from "../common/decorators/throttle.decorator";
import { isShareToken } from "../common/share-token";
import { CreateRouteDto } from "./dto/create-route.dto";
import { ListRoutesQueryDto, ROUTES_PAGE_LIMIT_DEFAULT } from "./dto/list-routes-query.dto";
import { PublicRouteSummaryDto } from "./dto/public-route-summary.dto";
import { PublicRoutesQueryDto } from "./dto/public-routes-query.dto";
import { RouteResponseDto } from "./dto/route-response.dto";
import { UpdateRouteDto } from "./dto/update-route.dto";
import { buildRouteGpx } from "./gpx";
import { RoutesService } from "./routes.service";

@ApiTags("routes")
@Controller("routes")
export class RoutesController {
	constructor(private readonly routesService: RoutesService) {}

	@ApiBearerAuth("JWT-auth")
	@UseGuards(JwtAuthGuard)
	@ApiOperation({
		summary: "Create a new route",
		description: "Creates a new route for the authenticated user. PATs are blocked; route creation lands with #170.",
	})
	@ApiBody({ type: CreateRouteDto })
	@ApiResponse({ status: 201, description: "Route created successfully", type: RouteResponseDto })
	@ApiResponse({ status: 400, description: "Invalid route data" })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ThrottleModerate()
	@Post()
	create(@Body() createRouteDto: CreateRouteDto, @CurrentUser() user: AuthenticatedUser): Promise<RouteResponseDto> {
		return this.routesService.create(createRouteDto, user.id);
	}

	@ApiBearerAuth("JWT-auth")
	@ApiBearerAuth("PAT-auth")
	@UseGuards(UnifiedAuthGuard, ScopeGuard)
	@ApiOperation({
		summary: "Get all user routes",
		description:
			"Retrieves the authenticated user's routes (any visibility), newest first. Paginated via `limit` and `offset`; the total number of routes is returned in the `X-Total-Count` response header.",
	})
	@ApiResponse({
		status: 200,
		description: "Routes retrieved successfully. X-Total-Count carries the total route count.",
		type: RouteResponseDto,
		isArray: true,
	})
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ThrottleModerate()
	@RequireScope("read")
	@Get()
	async findAll(
		@CurrentUser() user: AuthenticatedUser,
		@Query() query: ListRoutesQueryDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<RouteResponseDto[]> {
		const { items, total } = await this.routesService.findAll(
			user.id,
			query.limit ?? ROUTES_PAGE_LIMIT_DEFAULT,
			query.offset ?? 0,
		);
		res.setHeader("X-Total-Count", String(total));
		return items;
	}

	// Static segment must be declared before the dynamic ":id" route below;
	// otherwise NestJS would match "public" against ":id" and ParseIntPipe
	// would 400 before this handler was reached.
	@ApiOperation({
		summary: "List public routes",
		description:
			"Anonymous public route listing behind two gates. gate=indexable (default): Routes clearing the Indexable quality gate (see CONTEXT.md), newest-updated first; feeds the landing sitemap. gate=public: every public Route, newest-published first with downsampled geometry; the in-app Discover surface. Filterable by bbox (viewport overlap), activity, placeCity, and distance bounds. Total count in X-Total-Count.",
	})
	@ApiResponse({ status: 200, type: PublicRouteSummaryDto, isArray: true })
	@ThrottleModerate()
	@Get("public")
	async findPublic(
		@Query() query: PublicRoutesQueryDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<PublicRouteSummaryDto[]> {
		const { items, total } = await this.routesService.findPublicListing(
			query,
			query.limit ?? ROUTES_PAGE_LIMIT_DEFAULT,
			query.offset ?? 0,
		);
		res.setHeader("X-Total-Count", String(total));
		return items;
	}

	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: "Get a user's public routes",
		description: "Returns the public Routes owned by the given user. Excludes private and unlisted routes.",
	})
	@ApiParam({ name: "userId", description: "Owner user ID", type: "number" })
	@ApiResponse({ status: 200, type: RouteResponseDto, isArray: true })
	@ThrottleModerate()
	@Get("by-user/:userId")
	findPublicByUser(@Param("userId", ParseIntPipe) userId: number): Promise<RouteResponseDto[]> {
		return this.routesService.findPublicByOwner(userId);
	}

	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: "Download route as GPX",
		description:
			"Returns the route as a GPX 1.1 document with a routess-namespaced extension carrying per-waypoint Type. `ref` is a numeric route ID (owner: any visibility; non-owners: public only) or a 32-hex share token (public and unlisted). Private routes return 404 to non-owners. Unlisted responses carry X-Robots-Tag: noindex.",
	})
	@ApiParam({ name: "ref", description: "Route ID or 32-hex share token", type: "string" })
	@ApiResponse({ status: 200, description: "GPX document" })
	@ApiResponse({ status: 404, description: "Route not found or not viewable" })
	@ThrottleModerate()
	@Get(":ref/gpx")
	async downloadGpx(
		@Param("ref") ref: string,
		@OptionalCurrentUser() user: AuthenticatedUser | null,
		@Res() res: Response,
	): Promise<void> {
		const route = isShareToken(ref)
			? await this.routesService.findForGpxByShareToken(ref)
			: await this.routesService.findForGpx(parseRouteId(ref), user?.id ?? null);
		const gpx = buildRouteGpx({
			name: route.name,
			description: route.description,
			waypoints: route.waypoints ?? [],
			geometry: route.geometry,
		});
		const filename = `${route.name.replace(/[^a-z0-9-]+/gi, "-")}-${route.id}.gpx`;
		res.setHeader("Content-Type", "application/gpx+xml; charset=utf-8");
		res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
		if (route.visibility !== "public") {
			res.setHeader("X-Robots-Tag", "noindex");
		}
		res.send(gpx);
	}

	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: "Get route by ID or share token",
		description:
			"Returns the route. `ref` is either a numeric route ID (owners see any visibility; non-owners only public, so sequential IDs can't be walked to discover unlisted routes) or a 32-hex share token (serves public and unlisted to anyone with the link). Private routes return 404 to non-owners. PATs hit this through the cookie-or-bearer JWT path; PAT-as-Bearer is not yet supported here (use GET /routes to list and filter).",
	})
	@ApiParam({ name: "ref", description: "Route ID or 32-hex share token", type: "string" })
	@ApiResponse({ status: 200, description: "Route retrieved successfully", type: RouteResponseDto })
	@ApiResponse({ status: 404, description: "Route not found" })
	@ThrottleModerate()
	@Get(":ref")
	findOne(@Param("ref") ref: string, @OptionalCurrentUser() user: AuthenticatedUser | null): Promise<RouteResponseDto> {
		if (isShareToken(ref)) {
			return this.routesService.findOneByShareToken(ref);
		}
		return this.routesService.findOne(parseRouteId(ref), user?.id ?? null);
	}

	@ApiBearerAuth("JWT-auth")
	@ApiBearerAuth("PAT-auth")
	@UseGuards(UnifiedAuthGuard, ScopeGuard, ConfirmationGuard)
	@ApiOperation({
		summary: "Update route",
		description: "Updates a specific route for the authenticated user.",
	})
	@ApiParam({ name: "id", description: "Route ID", type: "number" })
	@ApiBody({ type: UpdateRouteDto })
	@ApiResponse({ status: 200, description: "Route updated successfully", type: RouteResponseDto })
	@ApiResponse({ status: 400, description: "Invalid route data" })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ApiResponse({ status: 404, description: "Route not found" })
	@ApiResponse({
		status: 428,
		description:
			"PAT-authenticated call attempted to set visibility to public without `X-Routess-Confirm: true`. Surface the `impact` field of the response to the user and retry with the header set.",
	})
	@ApiHeader({
		name: "X-Routess-Confirm",
		required: false,
		description: "Set to `true` when a PAT call sets `visibility: public`. Cookie sessions ignore this header.",
	})
	@ThrottleModerate()
	@RequireScope("write")
	@RequireConfirmation((req) =>
		(req.body as { visibility?: string } | undefined)?.visibility === "public"
			? `Make route ${req.params.id} publicly visible. Once public the URL may be archived externally; reverting to private does not unshare.`
			: null,
	)
	@Patch(":id")
	update(
		@Param("id", ParseIntPipe) id: number,
		@Body() updateRouteDto: UpdateRouteDto,
		@CurrentUser() user: AuthenticatedUser,
	): Promise<RouteResponseDto> {
		return this.routesService.update(id, updateRouteDto, user.id);
	}

	@ApiBearerAuth("JWT-auth")
	@ApiBearerAuth("PAT-auth")
	@UseGuards(UnifiedAuthGuard, ScopeGuard, ConfirmationGuard)
	@ApiOperation({
		summary: "Delete route",
		description: "Deletes a specific route for the authenticated user. PAT callers must set X-Routess-Confirm: true.",
	})
	@ApiParam({ name: "id", description: "Route ID", type: "number" })
	@ApiResponse({
		status: 200,
		description: "Route deleted successfully",
		schema: { example: { success: true, message: "Route deleted successfully" } },
	})
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ApiResponse({ status: 404, description: "Route not found" })
	@ApiResponse({
		status: 428,
		description:
			"PAT-authenticated DELETE without `X-Routess-Confirm: true`. Surface the `impact` field of the response to the user and retry with the header set.",
	})
	@ApiHeader({
		name: "X-Routess-Confirm",
		required: false,
		description: "Required as `true` for PAT callers. Cookie sessions ignore this header.",
	})
	@ThrottleStrict()
	@RequireScope("write")
	@RequireConfirmation(
		(req) =>
			`Delete route ${req.params.id}. The route is soft-deleted and can be restored by an admin within the retention window.`,
	)
	@Delete(":id")
	async remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
		await this.routesService.remove(id, user.id);
		return { success: true, message: "Route deleted successfully" };
	}
}

// The read endpoints accept either a numeric id or a share token, so they
// can't use ParseIntPipe; this mirrors its behavior for the id branch.
function parseRouteId(ref: string): number {
	if (!/^\d+$/.test(ref)) {
		throw new BadRequestException("Route reference must be a numeric ID or a share token");
	}
	return Number(ref);
}
