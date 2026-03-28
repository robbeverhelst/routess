import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

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
}
