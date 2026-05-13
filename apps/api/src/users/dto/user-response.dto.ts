import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
		enum: ["user", "admin"],
	})
	role!: "user" | "admin";

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
}

export class UserProfileDto extends UserResponseDto {
	@ApiProperty({
		type: UserStatisticsDto,
	})
	statistics!: UserStatisticsDto;
}
