import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ThrottleStrict } from "../common/decorators/throttle.decorator";
import type { AuthenticatedUser } from "./authenticated-user";
import { CurrentUser } from "./decorators/current-user.decorator";
import { RequireConfirmation } from "./decorators/require-confirmation.decorator";
import { RequireScope } from "./decorators/require-scope.decorator";
import {
	CreatePersonalAccessTokenDto,
	CreatePersonalAccessTokenResponseDto,
	PersonalAccessTokenResponseDto,
	RevokePersonalAccessTokenResponseDto,
} from "./dto/personal-access-token.dto";
import { ConfirmationGuard } from "./guards/confirmation.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { ScopeGuard } from "./guards/scope.guard";
import { UnifiedAuthGuard } from "./guards/unified-auth.guard";
import { PersonalAccessTokensService } from "./personal-access-tokens.service";

// Minting stays cookie-only: a PAT can never mint another PAT (otherwise
// agent privilege escalation). Listing and revoking are PAT-accessible so
// the CLI can manage credential hygiene; self-revocation is gated behind
// X-Routess-Confirm because it locks the calling agent out (ADR-0023).
@ApiTags("auth")
@Controller("auth/tokens")
export class PersonalAccessTokensController {
	constructor(private readonly tokensService: PersonalAccessTokensService) {}

	@ApiBearerAuth("JWT-auth")
	@UseGuards(JwtAuthGuard)
	@ApiOperation({
		summary: "Mint a personal access token",
		description:
			"Creates a new PAT for the authenticated user. Returns the plaintext exactly once; it is hashed at rest and cannot be retrieved again. Tokens authenticate non-browser clients (CLI, AI agents, scripts) via `Authorization: Bearer routess_pat_…`. Minting is cookie-only: PATs cannot mint other PATs. PATs are blocked from `/v1/admin/*` and from `DELETE /v1/users/me` regardless of the owner's role.",
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

	@ApiBearerAuth("JWT-auth")
	@ApiBearerAuth("PAT-auth")
	@UseGuards(UnifiedAuthGuard, ScopeGuard)
	@ApiOperation({
		summary: "List personal access tokens",
		description:
			"Lists the authenticated user's active (non-revoked) PATs. Plaintext is never returned; only metadata. PAT callers need `read` scope.",
	})
	@ApiResponse({ status: 200, description: "Tokens retrieved", type: PersonalAccessTokenResponseDto, isArray: true })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ThrottleStrict()
	@RequireScope("read")
	@Get()
	list(@CurrentUser() user: AuthenticatedUser): Promise<PersonalAccessTokenResponseDto[]> {
		return this.tokensService.list(user.id);
	}

	@ApiBearerAuth("JWT-auth")
	@ApiBearerAuth("PAT-auth")
	@UseGuards(UnifiedAuthGuard, ScopeGuard, ConfirmationGuard)
	@ApiOperation({
		summary: "Revoke a personal access token",
		description:
			"Revokes the token with the given ID. Idempotent: revoking an already-revoked token succeeds. PAT callers need `write` scope; revoking the token that authenticates the request itself additionally requires X-Routess-Confirm: true, since it locks the caller out.",
	})
	@ApiParam({ name: "id", description: "Token ID", type: "number" })
	@ApiResponse({ status: 200, description: "Token revoked", type: RevokePersonalAccessTokenResponseDto })
	@ApiResponse({ status: 401, description: "Unauthorized" })
	@ApiResponse({ status: 404, description: "Token not found" })
	@ApiResponse({
		status: 428,
		description:
			"PAT-authenticated self-revocation without `X-Routess-Confirm: true`. Surface the `impact` field to the user and retry with the header set.",
	})
	@ApiHeader({
		name: "X-Routess-Confirm",
		required: false,
		description: "Required as `true` when a PAT revokes itself. Cookie sessions ignore this header.",
	})
	@ThrottleStrict()
	@RequireScope("write")
	@RequireConfirmation((req) =>
		req.user?.authMethod === "pat" && req.user.jti === req.params.id
			? `Revoke personal access token ${req.params.id}, the token authenticating this request. Subsequent calls with it will fail with UNAUTHORIZED.`
			: null,
	)
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
