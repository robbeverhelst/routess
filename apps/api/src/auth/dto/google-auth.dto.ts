import { IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

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
