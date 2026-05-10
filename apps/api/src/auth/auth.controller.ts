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
import {
	EmailLoginDto,
	EmailSignupDto,
	RequestPasswordResetDto,
	ResetPasswordDto,
	VerifyEmailDto,
} from "./dto/email-auth.dto";
import { LogoutResponseDto } from "./dto/logout-response.dto";
import { EmailAuthService } from "./email-auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
	constructor(
		private authService: AuthService,
		private emailAuth: EmailAuthService,
		@Inject(APP_CONFIG) private readonly config: AppConfig,
	) {}

	@ApiOperation({
		summary: "Google OAuth authentication",
		description: "Authenticates user using a Google OAuth2 authorization code from the popup auth-code flow",
	})
	@ApiBody({ type: GoogleAuthDto })
	@ApiResponse({ status: 200, description: "Authentication successful", type: AuthResponseDto })
	@ApiResponse({ status: 400, description: "Invalid Google authorization code" })
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
		summary: "Email + password signup (request)",
		description:
			"Step 1 of email+password signup. Validates the password (length 12-128, HIBP breach check) and emails a verification link. The User row is NOT created until the verification link is clicked. Rejected with 409 if an account with this email already exists.",
	})
	@ApiBody({ type: EmailSignupDto })
	@ApiResponse({ status: 200, description: "Verification email sent" })
	@ApiResponse({ status: 400, description: "Invalid password (too short, too long, or breached)" })
	@ApiResponse({ status: 409, description: "Email already in use" })
	@HttpCode(200)
	@ThrottleAuth()
	@Post("signup-email")
	async signupEmail(@Body() dto: EmailSignupDto): Promise<{ success: true }> {
		await this.emailAuth.signupRequest(dto.email, dto.name ?? "", dto.password);
		return { success: true };
	}

	@ApiOperation({
		summary: "Email + password signup (verify)",
		description: "Step 2: consume the verification token, create the User and password method, and start a session.",
	})
	@ApiBody({ type: VerifyEmailDto })
	@ApiResponse({ status: 200, type: AuthResponseDto })
	@ApiResponse({ status: 400, description: "Token invalid or expired" })
	@ApiResponse({ status: 409, description: "Email was claimed by another signup in the meantime" })
	@HttpCode(200)
	@ThrottleAuth()
	@Post("verify-email")
	async verifyEmail(
		@Body() dto: VerifyEmailDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	): Promise<AuthResponseDto> {
		const result = await this.emailAuth.verifyEmail(dto.token, {
			userAgent: req.headers["user-agent"],
			ipAddress: req.ip,
		});
		this.setSessionCookie(res, result.accessToken);
		return result;
	}

	@ApiOperation({
		summary: "Email + password login",
		description: "Authenticates with email + password. Returns a session JWT. Generic error message on failure.",
	})
	@ApiBody({ type: EmailLoginDto })
	@ApiResponse({ status: 200, type: AuthResponseDto })
	@ApiResponse({ status: 401, description: "Email or password is incorrect" })
	@HttpCode(200)
	@ThrottleAuth()
	@Post("login-email")
	async loginEmail(
		@Body() dto: EmailLoginDto,
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
	): Promise<AuthResponseDto> {
		const result = await this.emailAuth.login(dto.email, dto.password, {
			userAgent: req.headers["user-agent"],
			ipAddress: req.ip,
		});
		this.setSessionCookie(res, result.accessToken);
		return result;
	}

	@ApiOperation({
		summary: "Request a password reset email",
		description:
			"Always returns 200 to avoid email enumeration. If a user with this email and a password method exists, a reset email is sent.",
	})
	@ApiBody({ type: RequestPasswordResetDto })
	@ApiResponse({ status: 200, description: "Request accepted (always 200)" })
	@HttpCode(200)
	@ThrottleAuth()
	@Post("request-password-reset")
	async requestPasswordReset(@Body() dto: RequestPasswordResetDto): Promise<{ success: true }> {
		await this.emailAuth.requestPasswordReset(dto.email);
		return { success: true };
	}

	@ApiOperation({
		summary: "Reset password using a token",
		description: "Consumes a reset token, sets a new password, and revokes ALL sessions for the user.",
	})
	@ApiBody({ type: ResetPasswordDto })
	@ApiResponse({ status: 200, description: "Password reset" })
	@ApiResponse({ status: 400, description: "Token invalid or expired, or password failed validation" })
	@HttpCode(200)
	@ThrottleAuth()
	@Post("reset-password")
	async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ success: true }> {
		await this.emailAuth.resetPassword(dto.token, dto.password);
		return { success: true };
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
