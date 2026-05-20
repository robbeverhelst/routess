import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import type { PatScope } from "../../entities/personal-access-token.entity";

const PAT_SCOPES: PatScope[] = ["read", "write"];

export class CreatePersonalAccessTokenDto {
	@ApiProperty({
		description:
			"Human-readable label so the user can identify the token later in the Settings list. Not displayed to anyone but the owning user.",
		example: "Backup script (laptop)",
		minLength: 1,
		maxLength: 80,
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(80)
	label!: string;

	@ApiProperty({
		description:
			"Scope of the token. `read` covers list/get/export and reading the profile. `write` adds metadata-only mutations on owned routes and on user preferences.",
		enum: PAT_SCOPES,
		example: "read",
	})
	@IsString()
	@IsIn(PAT_SCOPES)
	scope!: PatScope;

	@ApiProperty({
		description:
			"Optional ISO-8601 expiry. When omitted the token does not expire and lives until the user revokes it.",
		example: "2027-01-01T00:00:00Z",
		required: false,
	})
	@IsOptional()
	@IsISO8601()
	expiresAt?: string;
}

export class PersonalAccessTokenResponseDto {
	@ApiProperty({ description: "Stable identifier used to revoke the token.", example: 42 })
	id!: number;

	@ApiProperty({ description: "User-supplied label.", example: "Backup script (laptop)" })
	label!: string;

	@ApiProperty({ description: "Scope of the token.", enum: PAT_SCOPES, example: "read" })
	scope!: PatScope;

	@ApiProperty({
		description: "Most recent time the token was used to authenticate a request, or null if never used since creation.",
		nullable: true,
		example: "2026-05-14T10:23:00Z",
	})
	lastUsedAt!: string | null;

	@ApiProperty({
		description: "Expiry timestamp, or null if the token has no expiry.",
		nullable: true,
		example: "2027-01-01T00:00:00Z",
	})
	expiresAt!: string | null;

	@ApiProperty({ description: "Creation timestamp.", example: "2026-05-10T08:00:00Z" })
	createdAt!: string;
}

export class CreatePersonalAccessTokenResponseDto extends PersonalAccessTokenResponseDto {
	@ApiProperty({
		description:
			"The plaintext bearer token. Returned exactly once at creation time; the API does not store it and there is no way to retrieve it later. If you lose it, revoke the token and mint a new one.",
		example: "routess_pat_uK0wXY8Q1nN3pZqV-7gE2tHaB4cMdL5JfRvO6sI",
	})
	token!: string;
}

export class RevokePersonalAccessTokenResponseDto {
	@ApiProperty({ example: true })
	success!: boolean;
}
