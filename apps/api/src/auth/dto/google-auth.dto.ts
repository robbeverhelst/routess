import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class GoogleAuthDto {
	@ApiProperty({
		description: "Google OAuth2 authorization code from the popup auth-code flow",
		example: "4/0AX4XfWj...",
		required: true,
	})
	@IsString()
	@IsNotEmpty()
	code!: string;

	@ApiProperty({
		example: false,
		required: false,
		description:
			'Consent to the weekly "routes near you" email from the signup checkbox. Applied only when this call creates the account.',
	})
	@IsOptional()
	@IsBoolean()
	weeklyDigest?: boolean;
}
