import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ACTIVITIES, MAP_STYLES, ROUTE_VISIBILITIES, UNITS } from "@routess/core";
import { Type } from "class-transformer";
import {
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsIn,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	ValidateNested,
} from "class-validator";
import { RoutingDefaultsDto, UpdateRoutingDefaultsDto } from "../../common/routing-preferences.dto";

export class UserPreferenceSportSpeedsDto {
	@ApiPropertyOptional({ example: 10 })
	@IsOptional()
	@IsNumber()
	run?: number;

	@ApiPropertyOptional({ example: 25 })
	@IsOptional()
	@IsNumber()
	cycle?: number;

	@ApiPropertyOptional({ example: 5 })
	@IsOptional()
	@IsNumber()
	walk?: number;
}

export class UserPreferenceOverlaysDto {
	@ApiProperty({ example: true })
	@IsBoolean()
	heatmap!: boolean;

	@ApiProperty({ example: false })
	@IsBoolean()
	contour!: boolean;

	@ApiProperty({ example: true })
	@IsBoolean()
	bike!: boolean;

	@ApiProperty({ example: false })
	@IsBoolean()
	surface!: boolean;

	@ApiProperty({ example: false })
	@IsBoolean()
	wind!: boolean;

	@ApiProperty({ example: false })
	@IsBoolean()
	hikingNodes!: boolean;

	@ApiProperty({ example: false })
	@IsBoolean()
	cyclingNodes!: boolean;
}

export class UpdateUserPreferenceOverlaysDto {
	@ApiPropertyOptional({ example: true })
	@IsOptional()
	@IsBoolean()
	heatmap?: boolean;

	@ApiPropertyOptional({ example: false })
	@IsOptional()
	@IsBoolean()
	contour?: boolean;

	@ApiPropertyOptional({ example: true })
	@IsOptional()
	@IsBoolean()
	bike?: boolean;

	@ApiPropertyOptional({ example: false })
	@IsOptional()
	@IsBoolean()
	surface?: boolean;

	@ApiPropertyOptional({ example: false })
	@IsOptional()
	@IsBoolean()
	wind?: boolean;

	@ApiPropertyOptional({ example: false })
	@IsOptional()
	@IsBoolean()
	hikingNodes?: boolean;

	@ApiPropertyOptional({ example: false })
	@IsOptional()
	@IsBoolean()
	cyclingNodes?: boolean;
}

export class UserPreferencesDto {
	@ApiProperty({ enum: UNITS, example: "km" })
	@IsIn(UNITS)
	units!: (typeof UNITS)[number];

	@ApiProperty({ example: true })
	@IsBoolean()
	showPois!: boolean;

	@ApiProperty({ example: false })
	@IsBoolean()
	terrain3d!: boolean;

	@ApiProperty({ example: true })
	@IsBoolean()
	autoSnap!: boolean;

	@ApiProperty({ example: "Cycling" })
	@IsString()
	defaultActivity!: string;

	@ApiProperty({ enum: ACTIVITIES, isArray: true, example: ["cycle", "run"] })
	@IsArray()
	@ArrayUnique()
	@IsIn(ACTIVITIES, { each: true })
	selectedSports!: (typeof ACTIVITIES)[number][];

	@ApiProperty({
		type: UserPreferenceSportSpeedsDto,
		example: { run: 10, cycle: 25, walk: 5 },
	})
	@IsObject()
	@ValidateNested()
	@Type(() => UserPreferenceSportSpeedsDto)
	sportSpeeds!: UserPreferenceSportSpeedsDto;

	@ApiProperty({ enum: MAP_STYLES, example: "outdoors" })
	@IsIn(MAP_STYLES)
	mapStyle!: (typeof MAP_STYLES)[number];

	@ApiProperty({ type: UserPreferenceOverlaysDto })
	@ValidateNested()
	@Type(() => UserPreferenceOverlaysDto)
	overlays!: UserPreferenceOverlaysDto;

	@ApiProperty({ enum: ROUTE_VISIBILITIES, example: "private" })
	@IsIn(ROUTE_VISIBILITIES)
	defaultRouteVisibility!: (typeof ROUTE_VISIBILITIES)[number];

	@ApiProperty({ type: RoutingDefaultsDto })
	@ValidateNested()
	@Type(() => RoutingDefaultsDto)
	routingDefaults!: RoutingDefaultsDto;
}

export class UpdateUserPreferencesDto {
	@ApiPropertyOptional({ enum: UNITS, example: "km" })
	@IsOptional()
	@IsIn(UNITS)
	units?: (typeof UNITS)[number];

	@ApiPropertyOptional({ example: true })
	@IsOptional()
	@IsBoolean()
	showPois?: boolean;

	@ApiPropertyOptional({ example: false })
	@IsOptional()
	@IsBoolean()
	terrain3d?: boolean;

	@ApiPropertyOptional({ example: true })
	@IsOptional()
	@IsBoolean()
	autoSnap?: boolean;

	@ApiPropertyOptional({ example: "Cycling" })
	@IsOptional()
	@IsString()
	defaultActivity?: string;

	@ApiPropertyOptional({ enum: ACTIVITIES, isArray: true, example: ["cycle", "run"] })
	@IsOptional()
	@IsArray()
	@ArrayUnique()
	@IsIn(ACTIVITIES, { each: true })
	selectedSports?: (typeof ACTIVITIES)[number][];

	@ApiPropertyOptional({
		type: UserPreferenceSportSpeedsDto,
		example: { run: 10, cycle: 25, walk: 5 },
	})
	@IsOptional()
	@IsObject()
	@ValidateNested()
	@Type(() => UserPreferenceSportSpeedsDto)
	sportSpeeds?: UserPreferenceSportSpeedsDto;

	@ApiPropertyOptional({ enum: MAP_STYLES, example: "outdoors" })
	@IsOptional()
	@IsIn(MAP_STYLES)
	mapStyle?: (typeof MAP_STYLES)[number];

	@ApiPropertyOptional({ type: UpdateUserPreferenceOverlaysDto })
	@IsOptional()
	@ValidateNested()
	@Type(() => UpdateUserPreferenceOverlaysDto)
	overlays?: UpdateUserPreferenceOverlaysDto;

	@ApiPropertyOptional({ enum: ROUTE_VISIBILITIES, example: "private" })
	@IsOptional()
	@IsIn(ROUTE_VISIBILITIES)
	defaultRouteVisibility?: (typeof ROUTE_VISIBILITIES)[number];

	@ApiPropertyOptional({ type: UpdateRoutingDefaultsDto })
	@IsOptional()
	@ValidateNested()
	@Type(() => UpdateRoutingDefaultsDto)
	routingDefaults?: UpdateRoutingDefaultsDto;
}
