import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
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
import { CreateRouteDto } from "./dto/create-route.dto";
import { RouteResponseDto } from "./dto/route-response.dto";
import { UpdateRouteDto } from "./dto/update-route.dto";
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
		description: "Retrieves all routes belonging to the authenticated user (any visibility)",
	})
	@ApiResponse({ status: 200, description: "Routes retrieved successfully", type: RouteResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ThrottleModerate()
	@RequireScope("read")
	@Get()
	findAll(@CurrentUser() user: AuthenticatedUser): Promise<RouteResponseDto[]> {
		return this.routesService.findAll(user.id);
	}

	// Static segment must be declared before the dynamic ":id" route below;
	// otherwise NestJS would match "by-user" against ":id" and ParseIntPipe
	// would 400 before this handler was reached.
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
		summary: "Get route by ID",
		description:
			"Returns the route. Owners see it regardless of visibility; non-owners (including anonymous viewers) only see public and unlisted routes. Private routes return 404 to non-owners. PATs hit this through the cookie-or-bearer JWT path; PAT-as-Bearer is not yet supported here (use GET /routes to list and filter).",
	})
	@ApiParam({ name: "id", description: "Route ID", type: "number" })
	@ApiResponse({ status: 200, description: "Route retrieved successfully", type: RouteResponseDto })
	@ApiResponse({ status: 404, description: "Route not found" })
	@ThrottleModerate()
	@Get(":id")
	findOne(
		@Param("id", ParseIntPipe) id: number,
		@OptionalCurrentUser() user: AuthenticatedUser | null,
	): Promise<RouteResponseDto> {
		return this.routesService.findOne(id, user?.id ?? null);
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
