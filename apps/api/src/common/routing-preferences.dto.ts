import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SURFACE_TYPES } from "@routess/core";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsOptional, ValidateNested } from "class-validator";

export class RoutingPreferencesDto {
	@ApiProperty({ enum: SURFACE_TYPES, example: "mixed" })
	@IsIn(SURFACE_TYPES)
	surfacePreference!: (typeof SURFACE_TYPES)[number];

	@ApiProperty({ example: true })
	@IsBoolean()
	avoidFerries!: boolean;

	@ApiProperty({ example: true })
	@IsBoolean()
	avoidHighways!: boolean;
}

export class UpdateRoutingPreferencesDto {
	@ApiPropertyOptional({ enum: SURFACE_TYPES })
	@IsOptional()
	@IsIn(SURFACE_TYPES)
	surfacePreference?: (typeof SURFACE_TYPES)[number];

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	avoidFerries?: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	avoidHighways?: boolean;
}

export class RoutingDefaultsDto {
	@ApiProperty({ type: RoutingPreferencesDto })
	@ValidateNested()
	@Type(() => RoutingPreferencesDto)
	cycle!: RoutingPreferencesDto;

	@ApiProperty({ type: RoutingPreferencesDto })
	@ValidateNested()
	@Type(() => RoutingPreferencesDto)
	run!: RoutingPreferencesDto;

	@ApiProperty({ type: RoutingPreferencesDto })
	@ValidateNested()
	@Type(() => RoutingPreferencesDto)
	walk!: RoutingPreferencesDto;
}

export class UpdateRoutingDefaultsDto {
	@ApiPropertyOptional({ type: UpdateRoutingPreferencesDto })
	@IsOptional()
	@ValidateNested()
	@Type(() => UpdateRoutingPreferencesDto)
	cycle?: UpdateRoutingPreferencesDto;

	@ApiPropertyOptional({ type: UpdateRoutingPreferencesDto })
	@IsOptional()
	@ValidateNested()
	@Type(() => UpdateRoutingPreferencesDto)
	run?: UpdateRoutingPreferencesDto;

	@ApiPropertyOptional({ type: UpdateRoutingPreferencesDto })
	@IsOptional()
	@ValidateNested()
	@Type(() => UpdateRoutingPreferencesDto)
	walk?: UpdateRoutingPreferencesDto;
}
