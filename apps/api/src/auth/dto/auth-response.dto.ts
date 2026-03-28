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
}
