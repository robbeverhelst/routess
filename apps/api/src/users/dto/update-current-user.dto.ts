import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from "class-validator";
import { UpdateUserPreferencesDto } from "./user-preferences.dto";

export class UpdateCurrentUserDto {
	@ApiPropertyOptional({
		example: "Jane Doe",
	})
	@IsOptional()
	@IsString()
	@MaxLength(200)
	name?: string;

	@ApiPropertyOptional({
		example: "jane-doe",
		description:
			"New Handle for the user's Profile. Lowercase alphanumeric plus hyphen, 3-30 chars. Old profile URLs 404 after a change; the freed handle returns to the pool.",
	})
	@IsOptional()
	@IsString()
	handle?: string;

	@ApiPropertyOptional({
		example: "https://example.com/avatar.jpg",
		description: "Avatar image URL. Must be https: clients render it, so no other schemes are accepted.",
	})
	@IsOptional()
	@IsString()
	@MaxLength(2048)
	@IsUrl({ protocols: ["https"], require_protocol: true })
	avatar?: string;

	@ApiPropertyOptional({
		type: UpdateUserPreferencesDto,
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => UpdateUserPreferencesDto)
	preferences?: UpdateUserPreferencesDto;
}
