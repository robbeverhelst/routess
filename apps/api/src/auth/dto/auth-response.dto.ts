import { ApiProperty } from "@nestjs/swagger";

export class UserData {
	@ApiProperty({
		description: "User's unique identifier",
		example: 1,
	})
	id!: number;

	@ApiProperty({
		description: "User's email address",
		example: "user@example.com",
	})
	email!: string;

	@ApiProperty({
		description: "User's display name",
		example: "John Doe",
	})
	name!: string;

	@ApiProperty({
		description: "User's avatar image URL",
		example: "https://example.com/avatar.jpg",
		required: false,
	})
	avatar?: string;

	@ApiProperty({
		description: "Whether the user's email is verified",
		example: true,
	})
	isEmailVerified!: boolean;
}

export class AuthResponseDto {
	@ApiProperty({
		description: "JWT access token for authentication",
		example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
	})
	accessToken!: string;

	@ApiProperty({
		description: "User information",
		type: UserData,
	})
	user!: UserData;
}
