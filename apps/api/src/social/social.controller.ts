import {
	Body,
	Controller,
	DefaultValuePipe,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseIntPipe,
	Post,
	Query,
	Res,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ThrottleModerate } from "../common/decorators/throttle.decorator";
import { ProfileSummaryDto } from "../profiles/dto/profile-response.dto";
import { RouteResponseDto } from "../routes/dto/route-response.dto";
import { CreateRouteShareDto } from "./dto/create-route-share.dto";
import { FeedItemDto } from "./dto/feed-item.dto";
import { FollowsResponseDto } from "./dto/follows-response.dto";
import { RouteShareResponseDto, ShareUnreadCountDto } from "./dto/route-share-response.dto";
import { SocialService } from "./social.service";

// All social endpoints are browser-session only (JWT): the Follow graph and
// the inbox are interactive surfaces, not PAT/agent surfaces (ADR 0022).
@ApiTags("social")
@ApiBearerAuth("JWT-auth")
@UseGuards(JwtAuthGuard)
@Controller("social")
export class SocialController {
	constructor(private readonly socialService: SocialService) {}

	@ApiOperation({
		summary: "Follow a profile",
		description: "Asymmetric, no approval, grants no access (ADR 0027). Idempotent.",
	})
	@ApiParam({ name: "handle", type: "string" })
	@ApiResponse({ status: 204, description: "Following" })
	@ApiResponse({ status: 404, description: "Profile not found" })
	@ThrottleModerate()
	@HttpCode(204)
	@Post("follows/:handle")
	async follow(@Param("handle") handle: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
		await this.socialService.follow(user.id, handle);
	}

	@ApiOperation({ summary: "Unfollow a profile", description: "Idempotent." })
	@ApiParam({ name: "handle", type: "string" })
	@ApiResponse({ status: 204, description: "No longer following" })
	@ThrottleModerate()
	@HttpCode(204)
	@Delete("follows/:handle")
	async unfollow(@Param("handle") handle: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
		await this.socialService.unfollow(user.id, handle);
	}

	@ApiOperation({
		summary: "List who you follow and who follows you",
		description: "Owner-only: follower lists are never public, only counts on the Profile are.",
	})
	@ApiResponse({ status: 200, type: FollowsResponseDto })
	@ThrottleModerate()
	@Get("follows")
	follows(@CurrentUser() user: AuthenticatedUser): Promise<FollowsResponseDto> {
		return this.socialService.listFollows(user.id);
	}

	@ApiOperation({
		summary: "Your feed",
		description:
			"Public Routes of the Profiles you follow, ordered by publishedAt desc. A derived view: routes flipped back to private vanish instantly. Total in X-Total-Count.",
	})
	@ApiQuery({ name: "limit", required: false, type: "number" })
	@ApiQuery({ name: "offset", required: false, type: "number" })
	@ApiResponse({ status: 200, type: FeedItemDto, isArray: true })
	@ThrottleModerate()
	@Get("feed")
	async feed(
		@CurrentUser() user: AuthenticatedUser,
		@Res({ passthrough: true }) res: Response,
		@Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
		@Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset: number,
	): Promise<FeedItemDto[]> {
		const { items, total } = await this.socialService.feed(
			user.id,
			Math.min(Math.max(limit, 1), 100),
			Math.max(offset, 0),
		);
		res.setHeader("X-Total-Count", String(total));
		return items;
	}

	@ApiOperation({
		summary: "Share a route with another user",
		description:
			"Only unlisted/public Routes are shareable (ADR 0027). Sharing your own private Route returns a coded 409 so clients can offer to unlist it first.",
	})
	@ApiBody({ type: CreateRouteShareDto })
	@ApiResponse({ status: 201, type: RouteShareResponseDto })
	@ApiResponse({ status: 404, description: "Route or recipient not found" })
	@ApiResponse({ status: 409, description: "Route is private" })
	@ThrottleModerate()
	@Post("shares")
	share(@Body() dto: CreateRouteShareDto, @CurrentUser() user: AuthenticatedUser): Promise<RouteShareResponseDto> {
		return this.socialService.createShare(user.id, dto.routeId, dto.recipientHandle, dto.message);
	}

	@ApiOperation({
		summary: "Your shared-routes inbox",
		description: "Live references: a route deleted or flipped back to private shows as unavailable.",
	})
	@ApiResponse({ status: 200, type: RouteShareResponseDto, isArray: true })
	@ThrottleModerate()
	@Get("shares/inbox")
	inbox(@CurrentUser() user: AuthenticatedUser): Promise<RouteShareResponseDto[]> {
		return this.socialService.inbox(user.id);
	}

	@ApiOperation({ summary: "Unread share count (inbox badge)" })
	@ApiResponse({ status: 200, type: ShareUnreadCountDto })
	@ThrottleModerate()
	@Get("shares/unread-count")
	async unreadCount(@CurrentUser() user: AuthenticatedUser): Promise<ShareUnreadCountDto> {
		return { unread: await this.socialService.unreadCount(user.id) };
	}

	@ApiOperation({ summary: "Mark a share as read" })
	@ApiParam({ name: "id", type: "number" })
	@ApiResponse({ status: 204, description: "Marked read" })
	@ThrottleModerate()
	@HttpCode(204)
	@Post("shares/:id/read")
	async markRead(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser): Promise<void> {
		await this.socialService.markRead(id, user.id);
	}

	@ApiOperation({
		summary: "Save a copy of a shared route to your library",
		description: "The copy keeps the original's Provenance and records copiedFrom lineage. It starts private.",
	})
	@ApiParam({ name: "id", type: "number" })
	@ApiResponse({ status: 201, type: RouteResponseDto })
	@ApiResponse({ status: 409, description: "Route no longer available" })
	@ThrottleModerate()
	@Post("shares/:id/copy")
	copy(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser): Promise<RouteResponseDto> {
		return this.socialService.copyShare(id, user.id);
	}

	@ApiOperation({
		summary: "Search users to follow or share with",
		description: "Prefix match on handle and display name. Returns at most 10 results; excludes yourself.",
	})
	@ApiQuery({ name: "q", required: true, type: "string" })
	@ApiResponse({ status: 200, type: ProfileSummaryDto, isArray: true })
	@ThrottleModerate()
	@Get("users/search")
	search(@Query("q") q: string, @CurrentUser() user: AuthenticatedUser): Promise<ProfileSummaryDto[]> {
		return this.socialService.searchUsers(q ?? "", user.id);
	}
}
