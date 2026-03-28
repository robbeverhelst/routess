import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ThrottleModerate, ThrottleStrict } from "../common/decorators/throttle.decorator";
import { CreateRouteDto } from "./dto/create-route.dto";
import { RouteResponseDto } from "./dto/route-response.dto";
import { UpdateRouteDto } from "./dto/update-route.dto";
import { toRouteResponseDto } from "./route.mapper";
import { RoutesService } from "./routes.service";

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
	@ApiResponse({ status: 201, description: "Route created successfully", type: RouteResponseDto })
	@ApiResponse({ status: 400, description: "Invalid route data" })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ThrottleModerate()
	@Post()
	async create(
		@Body() createRouteDto: CreateRouteDto,
		@CurrentUser() user: AuthenticatedUser,
	): Promise<RouteResponseDto> {
		return toRouteResponseDto(await this.routesService.create(createRouteDto, user.id));
	}

	@ApiOperation({
		summary: "Get all user routes",
		description: "Retrieves all routes belonging to the authenticated user",
	})
	@ApiResponse({ status: 200, description: "Routes retrieved successfully", type: RouteResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ThrottleModerate()
	@Get()
	async findAll(@CurrentUser() user: AuthenticatedUser): Promise<RouteResponseDto[]> {
		return (await this.routesService.findAll(user.id)).map(toRouteResponseDto);
	}

	@ApiOperation({
		summary: "Get route by ID",
		description: "Retrieves a specific route by ID for the authenticated user",
	})
	@ApiParam({ name: "id", description: "Route ID", type: "number" })
	@ApiResponse({ status: 200, description: "Route retrieved successfully", type: RouteResponseDto })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ApiResponse({ status: 404, description: "Route not found" })
	@ThrottleModerate()
	@Get(":id")
	async findOne(
		@Param("id", ParseIntPipe) id: number,
		@CurrentUser() user: AuthenticatedUser,
	): Promise<RouteResponseDto> {
		return toRouteResponseDto(await this.routesService.findOne(id, user.id));
	}

	@ApiOperation({
		summary: "Update route",
		description: "Updates a specific route for the authenticated user",
	})
	@ApiParam({ name: "id", description: "Route ID", type: "number" })
	@ApiBody({ type: UpdateRouteDto })
	@ApiResponse({ status: 200, description: "Route updated successfully", type: RouteResponseDto })
	@ApiResponse({ status: 400, description: "Invalid route data" })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ApiResponse({ status: 404, description: "Route not found" })
	@ThrottleModerate()
	@Patch(":id")
	async update(
		@Param("id", ParseIntPipe) id: number,
		@Body() updateRouteDto: UpdateRouteDto,
		@CurrentUser() user: AuthenticatedUser,
	): Promise<RouteResponseDto> {
		return toRouteResponseDto(await this.routesService.update(id, updateRouteDto, user.id));
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
	@ThrottleStrict()
	@Delete(":id")
	async remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
		await this.routesService.remove(id, user.id);
		return { success: true, message: "Route deleted successfully" };
	}
}
