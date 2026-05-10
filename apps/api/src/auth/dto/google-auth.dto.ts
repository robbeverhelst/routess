import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class GoogleAuthDto {
	@ApiProperty({
		description: "Google OAuth2 authorization code from the popup auth-code flow",
		example: "4/0AX4XfWj...",
		required: true,
	})
	@IsString()
	@IsNotEmpty()
	code!: string;
}
