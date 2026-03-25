import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class GoogleAuthDto {
	@ApiProperty({
		description: "Google OAuth2 credential token",
		example: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjdkYzAyYjg5...",
		required: true,
	})
	@IsString()
	@IsNotEmpty()
	credential!: string;
}
