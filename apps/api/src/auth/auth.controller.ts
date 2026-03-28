import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { ThrottleAuth, ThrottleModerate } from "../common/decorators/throttle.decorator";
import { UserProfileDto } from "../users/dto/user-response.dto";
import { AuthService } from "./auth.service";
import type { AuthenticatedUser } from "./authenticated-user";
import { CurrentUser } from "./decorators/current-user.decorator";
import { AuthResponseDto, GoogleAuthDto } from "./dto";
import { LogoutResponseDto } from "./dto/logout-response.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
	constructor(private authService: AuthService) {}

	@ApiOperation({
		summary: "Google OAuth authentication",
		description: "Authenticates user using Google OAuth2 credential token",
	})
	@ApiBody({ type: GoogleAuthDto })
	@ApiResponse({ status: 200, description: "Authentication successful", type: AuthResponseDto })
	@ApiResponse({ status: 400, description: "Invalid Google credential" })
	@ApiResponse({ status: 401, description: "Authentication failed" })
	@ThrottleAuth() // Stricter rate limiting for authentication
	@Post("google")
	async googleAuth(@Body() googleAuthDto: GoogleAuthDto, @Req() req: Request): Promise<AuthResponseDto> {
		return this.authService.googleAuth(googleAuthDto, {
			userAgent: req.headers["user-agent"],
			ipAddress: req.ip,
		});
	}

	@ApiOperation({
		summary: "Get current user profile",
		description: "Retrieves the profile of the currently authenticated user",
	})
	@ApiBearerAuth("JWT-auth")
	@ApiResponse({ status: 200, description: "Profile retrieved successfully", type: UserProfileDto })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ThrottleModerate() // Moderate rate limiting for profile access
	@UseGuards(JwtAuthGuard)
	@Get("me")
	async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileDto> {
		return this.authService.getProfile(user.id);
	}

	@ApiOperation({
		summary: "Logout current session",
		description: "Revokes the current JWT session",
	})
	@ApiBearerAuth("JWT-auth")
	@ApiResponse({ status: 200, description: "Session revoked", type: LogoutResponseDto })
	@HttpCode(200)
	@ThrottleModerate()
	@UseGuards(JwtAuthGuard)
	@Post("logout")
	async logout(@CurrentUser() user: AuthenticatedUser): Promise<LogoutResponseDto> {
		await this.authService.logout(user.jti);
		return { success: true };
	}
}
