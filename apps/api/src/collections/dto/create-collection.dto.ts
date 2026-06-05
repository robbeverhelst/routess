import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ROUTE_VISIBILITIES, type RouteVisibility } from "@routess/core";
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCollectionDto {
	@ApiProperty({ description: "Name of the collection", example: "Alps 2026", minLength: 1, maxLength: 100 })
	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	name!: string;

	@ApiPropertyOptional({ description: "Optional description", maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	description?: string;

	@ApiPropertyOptional({
		description: "Visibility of the collection. Same semantics as route visibility.",
		enum: ROUTE_VISIBILITIES,
		default: "private",
	})
	@IsOptional()
	@IsString()
	@IsIn(ROUTE_VISIBILITIES)
	visibility?: RouteVisibility;
}
