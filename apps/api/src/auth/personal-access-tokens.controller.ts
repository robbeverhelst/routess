import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ThrottleStrict } from "../common/decorators/throttle.decorator";
import type { AuthenticatedUser } from "./authenticated-user";
import { CurrentUser } from "./decorators/current-user.decorator";
import {
	CreatePersonalAccessTokenDto,
	CreatePersonalAccessTokenResponseDto,
	PersonalAccessTokenResponseDto,
	RevokePersonalAccessTokenResponseDto,
} from "./dto/personal-access-token.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PersonalAccessTokensService } from "./personal-access-tokens.service";

@ApiTags("auth")
@ApiBearerAuth("JWT-auth")
@Controller("auth/tokens")
@UseGuards(JwtAuthGuard)
export class PersonalAccessTokensController {
	constructor(private readonly tokensService: PersonalAccessTokensService) {}

	@ApiOperation({
		summary: "Mint a personal access token",
		description:
			"Creates a new PAT for the authenticated user. Returns the plaintext exactly once; it is hashed at rest and cannot be retrieved again. Tokens authenticate non-browser clients (CLI, AI agents, scripts) via `Authorization: Bearer routess_pat_…`. PATs are blocked from `/v1/admin/*` and from `DELETE /v1/users/me` regardless of the owner's role.",
	})
	@ApiBody({ type: CreatePersonalAccessTokenDto })
	@ApiResponse({ status: 201, description: "Token created", type: CreatePersonalAccessTokenResponseDto })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ThrottleStrict()
	@Post()
	create(
		@Body() dto: CreatePersonalAccessTokenDto,
		@CurrentUser() user: AuthenticatedUser,
	): Promise<CreatePersonalAccessTokenResponseDto> {
		return this.tokensService.mint(user.id, dto.label, dto.scope, dto.expiresAt ? new Date(dto.expiresAt) : undefined);
	}

	@ApiOperation({
		summary: "List personal access tokens",
		description:
			"Lists the authenticated user's active (non-revoked) PATs. Plaintext is never returned; only metadata.",
	})
	@ApiResponse({ status: 200, description: "Tokens retrieved", type: PersonalAccessTokenResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ThrottleStrict()
	@Get()
	list(@CurrentUser() user: AuthenticatedUser): Promise<PersonalAccessTokenResponseDto[]> {
		return this.tokensService.list(user.id);
	}

	@ApiOperation({
		summary: "Revoke a personal access token",
		description: "Revokes the token with the given ID. Idempotent: revoking an already-revoked token succeeds.",
	})
	@ApiParam({ name: "id", description: "Token ID", type: "number" })
	@ApiResponse({ status: 200, description: "Token revoked", type: RevokePersonalAccessTokenResponseDto })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ApiResponse({ status: 404, description: "Token not found" })
	@ThrottleStrict()
	@HttpCode(200)
	@Delete(":id")
	async revoke(
		@Param("id", ParseIntPipe) id: number,
		@CurrentUser() user: AuthenticatedUser,
	): Promise<RevokePersonalAccessTokenResponseDto> {
		await this.tokensService.revoke(user.id, id);
		return { success: true };
	}
}
