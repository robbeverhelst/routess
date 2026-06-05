import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser, OptionalCurrentUser } from "../auth/decorators/current-user.decorator";
import { RequireConfirmation } from "../auth/decorators/require-confirmation.decorator";
import { RequireScope } from "../auth/decorators/require-scope.decorator";
import { ConfirmationGuard } from "../auth/guards/confirmation.guard";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { ScopeGuard } from "../auth/guards/scope.guard";
import { UnifiedAuthGuard } from "../auth/guards/unified-auth.guard";
import { ThrottleModerate, ThrottleStrict } from "../common/decorators/throttle.decorator";
import { CollectionsService } from "./collections.service";
import { CollectionDetailResponseDto, CollectionResponseDto } from "./dto/collection-response.dto";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { SetCollectionRoutesDto } from "./dto/set-collection-routes.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";

@ApiTags("collections")
@Controller("collections")
export class CollectionsController {
	constructor(private readonly collectionsService: CollectionsService) {}

	@ApiBearerAuth("JWT-auth")
	@ApiBearerAuth("PAT-auth")
	@UseGuards(UnifiedAuthGuard, ScopeGuard)
	@ApiOperation({
		summary: "Get all user collections",
		description: "Retrieves all collections belonging to the authenticated user, newest first.",
	})
	@ApiResponse({ status: 200, type: CollectionResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ThrottleModerate()
	@RequireScope("read")
	@Get()
	findAll(@CurrentUser() user: AuthenticatedUser): Promise<CollectionResponseDto[]> {
		return this.collectionsService.findAll(user.id);
	}

	@ApiBearerAuth("JWT-auth")
	@ApiBearerAuth("PAT-auth")
	@UseGuards(UnifiedAuthGuard, ScopeGuard)
	@ApiOperation({ summary: "Create a collection" })
	@ApiBody({ type: CreateCollectionDto })
	@ApiResponse({ status: 201, type: CollectionResponseDto })
	@ApiResponse({ status: 400, description: "Invalid collection data" })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ThrottleModerate()
	@RequireScope("write")
	@Post()
	create(@Body() dto: CreateCollectionDto, @CurrentUser() user: AuthenticatedUser): Promise<CollectionResponseDto> {
		return this.collectionsService.create(dto, user.id);
	}

	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: "Get collection by ID",
		description:
			"Owners see the collection regardless of visibility. Non-owners (including anonymous viewers) only see public and unlisted collections, and private routes inside them are omitted. Private collections return 404 to non-owners.",
	})
	@ApiParam({ name: "id", description: "Collection ID", type: "number" })
	@ApiResponse({ status: 200, type: CollectionDetailResponseDto })
	@ApiResponse({ status: 404, description: "Collection not found" })
	@ThrottleModerate()
	@Get(":id")
	findOne(
		@Param("id", ParseIntPipe) id: number,
		@OptionalCurrentUser() user: AuthenticatedUser | null,
	): Promise<CollectionDetailResponseDto> {
		return this.collectionsService.findOne(id, user?.id ?? null);
	}

	@ApiBearerAuth("JWT-auth")
	@ApiBearerAuth("PAT-auth")
	@UseGuards(UnifiedAuthGuard, ScopeGuard, ConfirmationGuard)
	@ApiOperation({ summary: "Update collection" })
	@ApiParam({ name: "id", description: "Collection ID", type: "number" })
	@ApiBody({ type: UpdateCollectionDto })
	@ApiResponse({ status: 200, type: CollectionResponseDto })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ApiResponse({ status: 404, description: "Collection not found" })
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
			? `Make collection ${req.params.id} publicly visible. Once public the URL may be archived externally; reverting to private does not unshare.`
			: null,
	)
	@Patch(":id")
	update(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: UpdateCollectionDto,
		@CurrentUser() user: AuthenticatedUser,
	): Promise<CollectionResponseDto> {
		return this.collectionsService.update(id, dto, user.id);
	}

	@ApiBearerAuth("JWT-auth")
	@ApiBearerAuth("PAT-auth")
	@UseGuards(UnifiedAuthGuard, ScopeGuard)
	@ApiOperation({
		summary: "Set collection routes",
		description:
			"Replaces the collection's full ordered membership. All route IDs must reference routes owned by the caller; array order defines position.",
	})
	@ApiParam({ name: "id", description: "Collection ID", type: "number" })
	@ApiBody({ type: SetCollectionRoutesDto })
	@ApiResponse({ status: 200, type: CollectionDetailResponseDto })
	@ApiResponse({ status: 400, description: "Invalid or non-owned route IDs" })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ApiResponse({ status: 404, description: "Collection not found" })
	@ThrottleModerate()
	@RequireScope("write")
	@Put(":id/routes")
	setRoutes(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: SetCollectionRoutesDto,
		@CurrentUser() user: AuthenticatedUser,
	): Promise<CollectionDetailResponseDto> {
		return this.collectionsService.setRoutes(id, dto, user.id);
	}

	@ApiBearerAuth("JWT-auth")
	@ApiBearerAuth("PAT-auth")
	@UseGuards(UnifiedAuthGuard, ScopeGuard, ConfirmationGuard)
	@ApiOperation({
		summary: "Delete collection",
		description:
			"Deletes the collection (soft-delete). Routes inside it are not deleted. PAT callers must set X-Routess-Confirm: true.",
	})
	@ApiParam({ name: "id", description: "Collection ID", type: "number" })
	@ApiResponse({
		status: 200,
		schema: { example: { success: true, message: "Collection deleted successfully" } },
	})
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ApiResponse({ status: 404, description: "Collection not found" })
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
	@RequireConfirmation((req) => `Delete collection ${req.params.id}. Routes inside the collection are not deleted.`)
	@Delete(":id")
	async remove(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
		await this.collectionsService.remove(id, user.id);
		return { success: true, message: "Collection deleted successfully" };
	}
}
