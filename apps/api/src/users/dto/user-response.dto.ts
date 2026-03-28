import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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
}

export class UserProfileDto extends UserResponseDto {
	@ApiProperty({
		type: UserStatisticsDto,
	})
	statistics!: UserStatisticsDto;
}
