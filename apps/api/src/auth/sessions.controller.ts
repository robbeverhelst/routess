import {
	BadRequestException,
	Controller,
	Delete,
	Get,
	HttpCode,
	NotFoundException,
	Param,
	ParseIntPipe,
	Post,
	UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ThrottleModerate, ThrottleStrict } from "../common/decorators/throttle.decorator";
import type { AuthenticatedUser } from "./authenticated-user";
import { CurrentUser } from "./decorators/current-user.decorator";
import { SessionResponseDto } from "./dto/session-response.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { SessionService } from "./session.service";

@ApiTags("sessions")
@ApiBearerAuth("JWT-auth")
@UseGuards(JwtAuthGuard)
@Controller("me/sessions")
export class SessionsController {
	constructor(private readonly sessions: SessionService) {}

	@ApiOperation({
		summary: "List active sessions",
		description:
			"Returns all active sessions for the authenticated user. The session that issued the current JWT is marked with isCurrent=true.",
	})
	@ApiResponse({ status: 200, type: SessionResponseDto, isArray: true })
	@ThrottleModerate()
	@Get()
	async list(@CurrentUser() user: AuthenticatedUser): Promise<SessionResponseDto[]> {
		const sessions = await this.sessions.getUserActiveSessions(user.id);
		return sessions.map((s) => ({
			id: s.id,
			isCurrent: s.jti === user.jti,
			userAgent: s.userAgent,
			ipAddress: s.ipAddress,
			lastActivity: s.lastActivity?.toISOString(),
			expiresAt: s.expiresAt.toISOString(),
			createdAt: s.createdAt.toISOString(),
		}));
	}

	@ApiOperation({
		summary: "Revoke a specific session",
		description:
			"Revokes the given session for the authenticated user. The current session cannot be revoked here; use POST /auth/logout for that.",
	})
	@ApiParam({ name: "id", description: "Session ID", type: "number" })
	@ApiResponse({ status: 200, schema: { example: { success: true } } })
	@ApiResponse({ status: 400, description: "Cannot revoke the current session" })
	@ApiResponse({ status: 404, description: "Session not found" })
	@HttpCode(200)
	@ThrottleStrict()
	@Delete(":id")
	async revoke(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
		const sessions = await this.sessions.getUserActiveSessions(user.id);
		const target = sessions.find((s) => s.id === id);
		if (!target) {
			throw new NotFoundException(`Session ${id} not found`);
		}
		if (target.jti === user.jti) {
			throw new BadRequestException("Cannot revoke the current session; use POST /auth/logout instead");
		}
		await this.sessions.invalidateSession(target.jti, "revoked");
		return { success: true };
	}

	@ApiOperation({
		summary: "Sign out from all devices",
		description: "Revokes every active session for the authenticated user, including the current one.",
	})
	@ApiResponse({ status: 200, schema: { example: { success: true } } })
	@HttpCode(200)
	@ThrottleStrict()
	@Post("logout-everywhere")
	async logoutEverywhere(@CurrentUser() user: AuthenticatedUser) {
		await this.sessions.invalidateUserSessions(user.id, "logout_everywhere");
		return { success: true };
	}
}
