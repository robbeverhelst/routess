import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { USER_DELETION_STATUSES, USER_ROLES, type UserDeletionStatus, type UserRole } from "../../entities/user.entity";
import { UserPreferencesDto } from "./user-preferences.dto";

export class UserStatisticsDto {
	@ApiProperty({
		example: 12,
	})
	totalRoutes!: number;

	@ApiProperty({
		example: 42350,
		description: "Total distance in meters",
	})
	totalDistance!: number;
}

export class UserResponseDto {
	@ApiProperty({
		example: 1,
	})
	id!: number;

	@ApiProperty({
		example: "user@example.com",
	})
	email!: string;

	@ApiProperty({
		example: "Jane Doe",
	})
	name!: string;

	@ApiProperty({
		example: "jane-doe",
		description: "Public address of the user's Profile (see CONTEXT.md 'Handle').",
	})
	handle!: string;

	@ApiPropertyOptional({
		example: "https://example.com/avatar.jpg",
	})
	avatar?: string;

	@ApiProperty({
		example: true,
	})
	isEmailVerified!: boolean;

	@ApiProperty({
		example: "user",
		enum: USER_ROLES,
	})
	role!: UserRole;

	@ApiPropertyOptional({
		type: UserPreferencesDto,
		nullable: true,
	})
	preferences?: UserPreferencesDto | null;

	@ApiProperty({
		example: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
		description: "Pseudonymous user identifier for client-side ProductEvent tracking. See ADR-0020.",
	})
	idHash!: string;

	@ApiProperty({
		example: "active",
		enum: USER_DELETION_STATUSES,
		description:
			"Deletion lifecycle. 'pending_hard_delete' means the user has requested self-deletion and is in the 30-day grace window before permanent erasure. The web app should redirect such users to a cancel screen.",
	})
	deletionStatus!: UserDeletionStatus;

	@ApiPropertyOptional({
		example: "2026-05-09T08:00:00.000Z",
		nullable: true,
		description: "When self-deletion was requested. Hard-delete fires 30 days after this timestamp.",
	})
	deletionRequestedAt?: string | null;

	@ApiProperty({
		example: true,
		description: "Whether the user has an active email/password credential. Drives password-change UI affordances.",
	})
	hasPassword!: boolean;
}

export class UserProfileDto extends UserResponseDto {
	@ApiProperty({
		type: UserStatisticsDto,
	})
	statistics!: UserStatisticsDto;
}

// Owner info embedded in route/collection responses, which are visible to
// other (possibly anonymous) users. Deliberately excludes email, role,
// preferences, and deletion state: never add PII here.
export class PublicUserDto {
	@ApiProperty({
		example: 1,
	})
	id!: number;

	@ApiProperty({
		example: "Jane Doe",
	})
	name!: string;

	@ApiProperty({
		example: "jane-doe",
		description: "Public address of the owner's Profile (CONTEXT.md 'Handle'). Deliberately public, not PII.",
	})
	handle!: string;

	@ApiPropertyOptional({
		example: "https://example.com/avatar.jpg",
	})
	avatar?: string;

	@ApiProperty({
		example: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
		description: "Pseudonymous user identifier for client-side ProductEvent tracking. See ADR-0020.",
	})
	idHash!: string;
}
