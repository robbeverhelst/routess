import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class EmailSignupDto {
	@ApiProperty({ example: "alice@example.com" })
	@IsEmail()
	email!: string;

	@ApiProperty({ example: "Alice", required: false })
	@IsOptional()
	@IsString()
	@MaxLength(80)
	name?: string;

	@ApiProperty({ example: "correct horse battery staple", minLength: 12, maxLength: 128 })
	@IsString()
	@MinLength(12)
	@MaxLength(128)
	password!: string;
}

export class EmailLoginDto {
	@ApiProperty({ example: "alice@example.com" })
	@IsEmail()
	email!: string;

	@ApiProperty({ example: "correct horse battery staple" })
	@IsString()
	@IsNotEmpty()
	password!: string;
}

export class VerifyEmailDto {
	@ApiProperty({ example: "0a1b2c3d…" })
	@IsString()
	@IsNotEmpty()
	token!: string;
}

export class RequestPasswordResetDto {
	@ApiProperty({ example: "alice@example.com" })
	@IsEmail()
	email!: string;
}

export class ResetPasswordDto {
	@ApiProperty({ example: "0a1b2c3d…" })
	@IsString()
	@IsNotEmpty()
	token!: string;

	@ApiProperty({ example: "new correct horse battery staple", minLength: 12, maxLength: 128 })
	@IsString()
	@MinLength(12)
	@MaxLength(128)
	password!: string;
}

export class SetPasswordDto {
	@ApiProperty({ example: "current pass", required: false, description: "Required if changing an existing password." })
	@IsOptional()
	@IsString()
	currentPassword?: string;

	@ApiProperty({ example: "new correct horse battery staple", minLength: 12, maxLength: 128 })
	@IsString()
	@MinLength(12)
	@MaxLength(128)
	newPassword!: string;
}
