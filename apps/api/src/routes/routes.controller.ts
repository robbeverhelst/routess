import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ThrottleModerate, ThrottleStrict } from "../common/decorators/throttle.decorator";
import { CreateRouteDto } from "./dto/create-route.dto";
import { UpdateRouteDto } from "./dto/update-route.dto";
import { RoutesService } from "./routes.service";

interface AuthenticatedRequest extends Request {
	user: {
		id: number;
		email: string;
		name: string;
	};
}

@ApiTags("routes")
@ApiBearerAuth("JWT-auth")
@Controller("routes")
@UseGuards(JwtAuthGuard)
export class RoutesController {
	constructor(private readonly routesService: RoutesService) {}

	@ApiOperation({
		summary: "Create a new route",
		description: "Creates a new route for the authenticated user",
	})
	@ApiBody({ type: CreateRouteDto })
	@ApiResponse({ status: 201, description: "Route created successfully" })
	@ApiResponse({ status: 400, description: "Invalid route data" })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ThrottleModerate() // Moderate rate limiting for route creation
	@Post()
	create(@Body() createRouteDto: CreateRouteDto, @Request() req: AuthenticatedRequest) {
		return this.routesService.create(createRouteDto, req.user.id);
	}

	@ApiOperation({
		summary: "Get all user routes",
		description: "Retrieves all routes belonging to the authenticated user",
	})
	@ApiResponse({ status: 200, description: "Routes retrieved successfully" })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ThrottleModerate() // Moderate rate limiting for listing routes
	@Get()
	findAll(@Request() req: AuthenticatedRequest) {
		return this.routesService.findAll(req.user.id);
	}

	@ApiOperation({
		summary: "Get route by ID",
		description: "Retrieves a specific route by ID for the authenticated user",
	})
	@ApiParam({ name: "id", description: "Route ID", type: "number" })
	@ApiResponse({ status: 200, description: "Route retrieved successfully" })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ApiResponse({ status: 404, description: "Route not found" })
	@ThrottleModerate() // Moderate rate limiting for route lookup
	@Get(":id")
	findOne(@Param("id", ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
		return this.routesService.findOne(id, req.user.id);
	}

	@ApiOperation({
		summary: "Update route",
		description: "Updates a specific route for the authenticated user",
	})
	@ApiParam({ name: "id", description: "Route ID", type: "number" })
	@ApiBody({ type: UpdateRouteDto })
	@ApiResponse({ status: 200, description: "Route updated successfully" })
	@ApiResponse({ status: 400, description: "Invalid route data" })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ApiResponse({ status: 404, description: "Route not found" })
	@ThrottleModerate() // Moderate rate limiting for route updates
	@Patch(":id")
	update(
		@Param("id", ParseIntPipe) id: number,
		@Body() updateRouteDto: UpdateRouteDto,
		@Request() req: AuthenticatedRequest,
	) {
		return this.routesService.update(id, updateRouteDto, req.user.id);
	}

	@ApiOperation({
		summary: "Delete route",
		description: "Deletes a specific route for the authenticated user",
	})
	@ApiParam({ name: "id", description: "Route ID", type: "number" })
	@ApiResponse({
		status: 200,
		description: "Route deleted successfully",
		schema: { example: { success: true, message: "Route deleted successfully" } },
	})
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ApiResponse({ status: 404, description: "Route not found" })
	@ThrottleStrict() // Strict rate limiting for route deletion
	@Delete(":id")
	async remove(@Param("id", ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
		await this.routesService.remove(id, req.user.id);
		return { success: true, message: "Route deleted successfully" };
	}
}
