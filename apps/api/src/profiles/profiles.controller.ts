import { Controller, Get, Header, Param, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { OptionalCurrentUser } from "../auth/decorators/current-user.decorator";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { ThrottlePublic } from "../common/decorators/throttle.decorator";
import { ProfileResponseDto } from "./dto/profile-response.dto";
import { ProfilesService } from "./profiles.service";

@ApiTags("profiles")
@Controller("profiles")
export class ProfilesController {
	constructor(private readonly profilesService: ProfilesService) {}

	@ApiOperation({
		summary: "List Indexable Profiles",
		description:
			"Profiles with at least 3 Indexable routes (CONTEXT.md 'Indexable'). Anonymous; feeds the landing sitemap.",
	})
	@ApiResponse({ status: 200, description: "Indexable profiles with handle and last update" })
	@ThrottlePublic()
	// Viewer-invariant; edge-cacheable within VisibilityPropagation (ADR 0031).
	@Header("Cache-Control", "public, max-age=30, s-maxage=60")
	@Get()
	findIndexable(): Promise<Array<{ handle: string; updatedAt: string }>> {
		return this.profilesService.findIndexable();
	}

	@UseGuards(OptionalJwtAuthGuard)
	@ApiOperation({
		summary: "Get a public Profile by handle",
		description:
			"The public projection of a User (CONTEXT.md 'Profile'): handle, display name, avatar, stats over public Routes only, and the public route list. Anonymous viewers get isFollowing = null.",
	})
	@ApiParam({ name: "handle", description: "Profile handle", type: "string" })
	@ApiResponse({ status: 200, type: ProfileResponseDto })
	@ApiResponse({ status: 404, description: "Profile not found" })
	@ThrottlePublic()
	@Get(":handle")
	findOne(
		@Param("handle") handle: string,
		@OptionalCurrentUser() user: AuthenticatedUser | null,
	): Promise<ProfileResponseDto> {
		return this.profilesService.findByHandle(handle, user?.id ?? null);
	}
}
