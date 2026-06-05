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
