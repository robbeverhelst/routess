import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SURFACE_TYPES } from "@routess/core";
import { IsBoolean, IsIn, IsOptional } from "class-validator";

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
	cycle!: RoutingPreferencesDto;

	@ApiProperty({ type: RoutingPreferencesDto })
	run!: RoutingPreferencesDto;

	@ApiProperty({ type: RoutingPreferencesDto })
	walk!: RoutingPreferencesDto;
}

export class UpdateRoutingDefaultsDto {
	@ApiPropertyOptional({ type: UpdateRoutingPreferencesDto })
	@IsOptional()
	cycle?: UpdateRoutingPreferencesDto;

	@ApiPropertyOptional({ type: UpdateRoutingPreferencesDto })
	@IsOptional()
	run?: UpdateRoutingPreferencesDto;

	@ApiPropertyOptional({ type: UpdateRoutingPreferencesDto })
	@IsOptional()
	walk?: UpdateRoutingPreferencesDto;
}
