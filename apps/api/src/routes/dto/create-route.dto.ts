import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	PROVENANCES,
	type Provenance,
	ROUTE_ACTIVITIES,
	ROUTE_VISIBILITIES,
	type RouteActivity,
	type RouteVisibility,
} from "@routess/core";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsIn,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Validate,
	ValidateNested,
	ValidatorConstraint,
	type ValidatorConstraintInterface,
} from "class-validator";
import { RoutingPreferencesDto } from "../../common/routing-preferences.dto";

const MAX_WAYPOINTS = 100;
const MAX_GEOMETRY_POINTS = 20_000;

const isValidCoord = (value: unknown): value is [number, number] => {
	if (!Array.isArray(value) || value.length !== 2) return false;
	const [lng, lat] = value;
	return (
		typeof lng === "number" &&
		Number.isFinite(lng) &&
		lng >= -180 &&
		lng <= 180 &&
		typeof lat === "number" &&
		Number.isFinite(lat) &&
		lat >= -90 &&
		lat <= 90
	);
};

@ValidatorConstraint({ name: "Coordinate", async: false })
class CoordinateConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return isValidCoord(value);
	}
	defaultMessage(): string {
		return "coord must be a [lng, lat] pair with lng in [-180,180] and lat in [-90,90]";
	}
}

@ValidatorConstraint({ name: "CoordinatePairs", async: false })
class CoordinatePairsConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		if (value === undefined || value === null) return true;
		if (!Array.isArray(value) || value.length > MAX_GEOMETRY_POINTS) return false;
		return value.every(isValidCoord);
	}
	defaultMessage(): string {
		return `geometry must contain at most ${MAX_GEOMETRY_POINTS} [lng, lat] coordinate pairs`;
	}
}

class WaypointDto {
	@ApiProperty({
		description: "Waypoint coordinate as a [lng, lat] pair",
		example: [-74.006, 40.7128],
		type: "array",
		items: { type: "number" },
		minItems: 2,
		maxItems: 2,
	})
	@Validate(CoordinateConstraint)
	coord!: [number, number];

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

	@ApiProperty({
		description: "Timestamp when the waypoint was recorded",
		example: "2024-01-15T10:30:00Z",
		required: false,
	})
	@IsOptional()
	@IsString()
	timestamp?: string;
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
		description: "Activity associated with the route",
		enum: ROUTE_ACTIVITIES,
		required: false,
	})
	@IsOptional()
	@IsString()
	@IsIn(ROUTE_ACTIVITIES)
	activity?: RouteActivity;

	@ApiProperty({
		description: "Visibility of the route",
		enum: ROUTE_VISIBILITIES,
		required: false,
		default: "private",
	})
	@IsOptional()
	@IsString()
	@IsIn(ROUTE_VISIBILITIES)
	visibility?: RouteVisibility;

	@ApiProperty({
		description: "Free-form tags for the route",
		type: [String],
		required: false,
		example: ["hilly", "scenic"],
	})
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	@ArrayMaxSize(20)
	tags?: string[];

	@ApiProperty({
		description: "Array of waypoints that define the route",
		type: [WaypointDto],
		minItems: 1,
		example: [
			{ coord: [-74.006, 40.7128], type: "routed", timestamp: "2024-01-15T10:00:00Z" },
			{ coord: [-73.9851, 40.7589], type: "direct", timestamp: "2024-01-15T10:30:00Z" },
		],
	})
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(MAX_WAYPOINTS)
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
	@Validate(CoordinatePairsConstraint)
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

	@ApiPropertyOptional({
		description:
			"Inputs that produced this route's geometry. Optional: routes saved from clients without this metadata (e.g. legacy clients, GPX imports, agents that didn't capture the prefs) are persisted with `routingPreferences = null` and remain usable but cannot be recalculated against their original inputs.",
		type: RoutingPreferencesDto,
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => RoutingPreferencesDto)
	routingPreferences?: RoutingPreferencesDto;

	@ApiPropertyOptional({
		description: "How this route was produced. Defaults to 'valhalla' for new routes.",
		enum: PROVENANCES,
	})
	@IsOptional()
	@IsIn(PROVENANCES)
	provenance?: Provenance;
}
