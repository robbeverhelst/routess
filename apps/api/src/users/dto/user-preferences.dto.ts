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
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

const ACTIVITIES = ["run", "cycle", "walk"] as const;
const UNITS = ["km", "mi"] as const;
const MAP_STYLES = ["streets", "outdoors", "satellite"] as const;
const LOCATION_PERMISSIONS = ["unknown", "granted", "denied", "skipped"] as const;

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

	@ApiProperty({ example: false })
	@IsBoolean()
	publicProfile!: boolean;

	@ApiProperty({ example: true })
	@IsBoolean()
	hidePrivacy!: boolean;

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

	@ApiProperty({ enum: LOCATION_PERMISSIONS, example: "unknown" })
	@IsIn(LOCATION_PERMISSIONS)
	locationPermission!: (typeof LOCATION_PERMISSIONS)[number];
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

	@ApiPropertyOptional({ example: false })
	@IsOptional()
	@IsBoolean()
	publicProfile?: boolean;

	@ApiPropertyOptional({ example: true })
	@IsOptional()
	@IsBoolean()
	hidePrivacy?: boolean;

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

	@ApiPropertyOptional({ enum: LOCATION_PERMISSIONS, example: "unknown" })
	@IsOptional()
	@IsIn(LOCATION_PERMISSIONS)
	locationPermission?: (typeof LOCATION_PERMISSIONS)[number];
}
