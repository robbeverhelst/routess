import { ApiProperty } from "@nestjs/swagger";
import { UserResponseDto } from "../../users/dto/user-response.dto";

export class AuthResponseDto {
	@ApiProperty({
		description: "JWT access token for authentication",
		example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
	})
	accessToken!: string;

	@ApiProperty({
		description: "Authenticated user",
		type: UserResponseDto,
	})
	user!: UserResponseDto;

	// Lets the web client fire `user_registered` exactly once, on the login that
	// created the account. Registration is server truth; the client cannot infer
	// it from the user payload alone.
	@ApiProperty({
		description: "True when this response created the account rather than signing in to an existing one",
		example: false,
	})
	isNewUser!: boolean;
}
