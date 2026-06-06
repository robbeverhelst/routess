import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateRouteShareDto {
	@ApiProperty({ example: 42 })
	@IsInt()
	routeId!: number;

	@ApiProperty({ example: "jane-doe" })
	@IsString()
	@MaxLength(30)
	recipientHandle!: string;

	@ApiPropertyOptional({ example: "Route for Sunday's ride!" })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	message?: string;
}
