import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMinSize,
	IsArray,
	IsIn,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	ValidateNested,
} from "class-validator";

class WaypointDto {
	@ApiProperty({
		description: "Latitude coordinate of the waypoint",
		example: 40.7128,
		type: "number",
	})
	@IsNumber()
	lat!: number;

	@ApiProperty({
		description: "Longitude coordinate of the waypoint",
		example: -74.006,
		type: "number",
	})
	@IsNumber()
	lng!: number;

	@ApiProperty({
		description: "Timestamp when the waypoint was recorded",
		example: "2024-01-15T10:30:00Z",
		required: false,
	})
	@IsOptional()
	@IsString()
	timestamp?: string;

	@ApiProperty({
		description: "Type of waypoint routing",
		enum: ["routed", "direct"],
		example: "routed",
	})
	@IsString()
	@IsIn(["routed", "direct"])
	type!: "routed" | "direct";

	@ApiProperty({
		description: "Optional user-assigned name for the waypoint",
		example: "Coffee stop",
		required: false,
	})
	@IsOptional()
	@IsString()
	name?: string;
}

export class CreateRouteDto {
	@ApiProperty({
		description: "Name of the route",
		example: "Morning Jog Route",
		minLength: 1,
	})
	@IsString()
	@IsNotEmpty()
	name!: string;

	@ApiProperty({
		description: "Optional description of the route",
		example: "A scenic route through Central Park",
		required: false,
	})
	@IsOptional()
	@IsString()
	description?: string;

	@ApiProperty({
		description: "Array of waypoints that define the route",
		type: [WaypointDto],
		minItems: 1,
		example: [
			{
				lat: 40.7128,
				lng: -74.006,
				timestamp: "2024-01-15T10:00:00Z",
				type: "routed",
			},
			{
				lat: 40.7589,
				lng: -73.9851,
				timestamp: "2024-01-15T10:30:00Z",
				type: "direct",
			},
		],
	})
	@IsArray()
	@ArrayMinSize(1)
	@ValidateNested({ each: true })
	@Type(() => WaypointDto)
	waypoints!: WaypointDto[];

	@ApiProperty({
		description: "Routed polyline as an array of [lng, lat] coordinate pairs",
		example: [
			[-74.006, 40.7128],
			[-74.0055, 40.7135],
		],
		required: false,
	})
	@IsOptional()
	@IsArray()
	geometry?: [number, number][];

	@ApiProperty({
		description: "Total distance of the route in meters",
		example: 5280,
		required: false,
	})
	@IsOptional()
	@IsNumber()
	distance?: number;

	@ApiProperty({
		description: "Estimated duration of the route in seconds",
		example: 1200,
		required: false,
	})
	@IsOptional()
	@IsNumber()
	duration?: number;

	@ApiProperty({
		description: "Total elevation gain of the route in meters",
		example: 150,
		required: false,
	})
	@IsOptional()
	@IsNumber()
	elevationGain?: number;

	@ApiProperty({
		description: "Human-readable starting address",
		example: "Central Park, New York, NY",
		required: false,
	})
	@IsOptional()
	@IsString()
	startAddress?: string;

	@ApiProperty({
		description: "Human-readable ending address",
		example: "Times Square, New York, NY",
		required: false,
	})
	@IsOptional()
	@IsString()
	endAddress?: string;
}
