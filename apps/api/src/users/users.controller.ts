import { Body, Controller, Delete, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ThrottleModerate, ThrottleStrict } from "../common/decorators/throttle.decorator";
import { RouteLibraryService } from "../route-library/route-library.service";
import { UpdateCurrentUserDto } from "./dto/update-current-user.dto";
import { UserProfileDto } from "./dto/user-response.dto";
import { toUserProfileDto } from "./user.mapper";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth("JWT-auth")
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
	constructor(
		private readonly usersService: UsersService,
		private readonly routeLibrary: RouteLibraryService,
	) {}

	@ApiOperation({
		summary: "Get current user profile",
	})
	@ApiResponse({ status: 200, type: UserProfileDto })
	@ThrottleModerate()
	@Get(["me", "profile"])
	async getProfile(@CurrentUser() currentUser: AuthenticatedUser) {
		const user = await this.usersService.findOne(currentUser.id);
		const statistics = await this.routeLibrary.statisticsFor(currentUser.id);
		return toUserProfileDto(user, statistics);
	}

	@ApiOperation({
		summary: "Update current user profile",
	})
	@ApiResponse({ status: 200, type: UserProfileDto })
	@ThrottleModerate()
	@Patch("me")
	async update(@CurrentUser() currentUser: AuthenticatedUser, @Body() updateUserDto: UpdateCurrentUserDto) {
		const user = await this.usersService.update(currentUser.id, updateUserDto);
		const statistics = await this.routeLibrary.statisticsFor(currentUser.id);
		return toUserProfileDto(user, statistics);
	}

	@ApiOperation({
		summary: "Delete current user account",
	})
	@ApiResponse({
		status: 200,
		schema: { example: { success: true } },
	})
	@ThrottleStrict()
	@Delete("me")
	async remove(@CurrentUser() currentUser: AuthenticatedUser) {
		await this.usersService.remove(currentUser.id);
		return { success: true };
	}
}
