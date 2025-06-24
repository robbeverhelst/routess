import { IsOptional, IsEmail, IsString, IsNotEmpty, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateUserDto {
  @ApiProperty({
    description: "User's email address",
    example: "user@example.com",
    format: "email",
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: "User's display name",
    example: "John Doe",
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: "User's password",
    example: "securePassword123",
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}

export class UpdateUserDto {
  @ApiProperty({
    description: "User's email address",
    example: "user@example.com",
    format: "email",
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: "User's display name",
    example: "John Doe",
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: "User's password",
    example: "newSecurePassword123",
    minLength: 6,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiProperty({
    description: "User's avatar image URL",
    example: "https://example.com/avatar.jpg",
    required: false,
  })
  @IsOptional()
  @IsString()
  avatar?: string;
}
