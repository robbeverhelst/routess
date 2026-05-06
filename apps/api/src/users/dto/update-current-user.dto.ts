import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsString, ValidateNested } from "class-validator";
import { UpdateUserPreferencesDto } from "./user-preferences.dto";

export class UpdateCurrentUserDto {
	@ApiPropertyOptional({
		example: "Jane Doe",
	})
	@IsOptional()
	@IsString()
	name?: string;

	@ApiPropertyOptional({
		example: "https://example.com/avatar.jpg",
	})
	@IsOptional()
	@IsString()
	avatar?: string;

	@ApiPropertyOptional({
		type: UpdateUserPreferencesDto,
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => UpdateUserPreferencesDto)
	preferences?: UpdateUserPreferencesDto;
}
