import { Body, Controller, Delete, Get, HttpCode, Inject, Patch, Post, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiProduces, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequireScope } from "../auth/decorators/require-scope.decorator";
import { SetPasswordDto } from "../auth/dto/email-auth.dto";
import { EmailAuthService } from "../auth/email-auth.service";
import { ScopeGuard } from "../auth/guards/scope.guard";
import { UnifiedAuthGuard } from "../auth/guards/unified-auth.guard";
import { ThrottleModerate, ThrottleStrict } from "../common/decorators/throttle.decorator";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { RouteLibraryService } from "../route-library/route-library.service";
import { DataExportService } from "./data-export.service";
import { UpdateCurrentUserDto } from "./dto/update-current-user.dto";
import { UserProfileDto } from "./dto/user-response.dto";
import { toUserProfileDto } from "./user.mapper";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth("JWT-auth")
@ApiBearerAuth("PAT-auth")
@UseGuards(UnifiedAuthGuard, ScopeGuard)
@Controller("users")
export class UsersController {
	constructor(
		private readonly usersService: UsersService,
		private readonly routeLibrary: RouteLibraryService,
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
		private readonly dataExport: DataExportService,
		private readonly emailAuth: EmailAuthService,
	) {}

	@ApiOperation({
		summary: "Get current user profile",
	})
	@ApiResponse({ status: 200, type: UserProfileDto })
	@ThrottleModerate()
	@RequireScope("read")
	@Get(["me", "profile"])
	async getProfile(@CurrentUser() currentUser: AuthenticatedUser) {
		const user = await this.usersService.findOne(currentUser.id);
		const statistics = await this.routeLibrary.statisticsFor(currentUser.id);
		const hasPassword = await this.emailAuth.userHasPassword(currentUser.id);
		return toUserProfileDto(user, statistics, this.config.analytics.salt, hasPassword);
	}

	@ApiOperation({
		summary: "Update current user profile",
	})
	@ApiResponse({ status: 200, type: UserProfileDto })
	@ThrottleModerate()
	@RequireScope("write")
	@Patch("me")
	async update(@CurrentUser() currentUser: AuthenticatedUser, @Body() updateUserDto: UpdateCurrentUserDto) {
		const user = await this.usersService.update(currentUser.id, updateUserDto);
		const statistics = await this.routeLibrary.statisticsFor(currentUser.id);
		const hasPassword = await this.emailAuth.userHasPassword(currentUser.id);
		return toUserProfileDto(user, statistics, this.config.analytics.salt, hasPassword);
	}

	@ApiOperation({
		summary: "Delete current user account",
		description:
			"Initiates self-deletion (ADR 0017). Soft-deletes the user and their routes, revokes all sessions, and schedules permanent erasure 30 days later. The user can cancel by signing back in and calling POST /users/me/cancel-deletion within the grace window.",
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

	@ApiOperation({
		summary: "Set or change password",
		description:
			"Sets a password for the authenticated user, or changes it if one already exists. HIBP/length validation always applies. Changing an existing password requires the current password. Adding a password to a Google-only account does not require email verification (OAuth already proved email control).",
	})
	@ApiBody({ type: SetPasswordDto })
	@ApiResponse({ status: 200, schema: { example: { success: true } } })
	@ApiResponse({ status: 400, description: "Password failed validation, or current password missing on change" })
	@ApiResponse({ status: 401, description: "Current password is incorrect" })
	@HttpCode(200)
	@ThrottleStrict()
	@Post("me/password")
	async setPassword(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: SetPasswordDto) {
		await this.emailAuth.setPassword(currentUser.id, dto.newPassword, dto.currentPassword);
		return { success: true };
	}

	@ApiOperation({
		summary: "Export account data as ZIP",
		description:
			"Returns a ZIP containing routess-export.json (full account dump) and one GPX file per Route. Soft-capped at 1000 routes; accounts above the cap get a 400 and should contact support. GDPR Art. 15 right of access.",
	})
	@ApiProduces("application/zip")
	@ApiResponse({ status: 200, description: "ZIP archive" })
	@ApiResponse({ status: 400, description: "Account exceeds the export size cap" })
	@ThrottleStrict()
	@Get("me/export")
	async export(@CurrentUser() currentUser: AuthenticatedUser, @Res() res: Response): Promise<void> {
		const { filename, bytes } = await this.dataExport.buildExportZip(currentUser.id);
		res.setHeader("Content-Type", "application/zip");
		res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
		res.setHeader("Content-Length", String(bytes.length));
		res.send(bytes);
	}

	@ApiOperation({
		summary: "Cancel a pending account deletion",
		description:
			"Cancels a self-initiated deletion that's still inside the 30-day grace window. Restores the user's routes and clears the pending status. No-op if the user is not in a pending state.",
	})
	@ApiResponse({ status: 200, type: UserProfileDto })
	@HttpCode(200)
	@ThrottleStrict()
	@Post("me/cancel-deletion")
	async cancelDeletion(@CurrentUser() currentUser: AuthenticatedUser) {
		const user = await this.usersService.cancelDeletion(currentUser.id);
		const statistics = await this.routeLibrary.statisticsFor(currentUser.id);
		const hasPassword = await this.emailAuth.userHasPassword(currentUser.id);
		return toUserProfileDto(user, statistics, this.config.analytics.salt, hasPassword);
	}
}
