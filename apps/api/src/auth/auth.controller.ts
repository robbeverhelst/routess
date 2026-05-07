import { Body, Controller, HttpCode, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ThrottleAuth, ThrottleModerate } from "../common/decorators/throttle.decorator";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { AuthService } from "./auth.service";
import type { AuthenticatedUser } from "./authenticated-user";
import { CurrentUser } from "./decorators/current-user.decorator";
import { AuthResponseDto, GoogleAuthDto } from "./dto";
import { LogoutResponseDto } from "./dto/logout-response.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
	constructor(
		private authService: AuthService,
		@Inject(APP_CONFIG) private readonly config: AppConfig,
	) {}

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
	async googleAuth(
		@Body() googleAuthDto: GoogleAuthDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	): Promise<AuthResponseDto> {
		const authResponse = await this.authService.googleAuth(googleAuthDto, {
			userAgent: req.headers["user-agent"],
			ipAddress: req.ip,
		});
		this.setSessionCookie(res, authResponse.accessToken);
		return authResponse;
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
	async logout(
		@CurrentUser() user: AuthenticatedUser,
		@Res({ passthrough: true }) res: Response,
	): Promise<LogoutResponseDto> {
		await this.authService.logout(user.jti);
		this.clearSessionCookie(res);
		return { success: true };
	}

	private setSessionCookie(res: Response, accessToken: string): void {
		res.cookie(this.config.auth.cookieName, accessToken, {
			httpOnly: true,
			secure: this.config.app.isProduction,
			sameSite: this.config.app.isProduction ? "none" : "lax",
			maxAge: this.config.auth.sessionTtlMs,
			path: "/",
		});
	}

	private clearSessionCookie(res: Response): void {
		res.clearCookie(this.config.auth.cookieName, {
			httpOnly: true,
			secure: this.config.app.isProduction,
			sameSite: this.config.app.isProduction ? "none" : "lax",
			path: "/",
		});
	}
}
