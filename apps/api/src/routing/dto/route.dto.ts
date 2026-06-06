import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ROUTE_ACTIVITIES, type RouteActivity } from "@routess/core";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsIn,
	IsNumber,
	IsOptional,
	Max,
	Min,
	ValidateNested,
} from "class-validator";
import { RoutingPreferencesDto } from "../../common/routing-preferences.dto";

const MAX_ROUTE_LOCATIONS = 25;

export class RouteLocationDto {
	@ApiProperty({ description: "Latitude in WGS84 degrees", example: 50.8467 })
	@IsNumber()
	@Min(-90)
	@Max(90)
	lat!: number;

	@ApiProperty({ description: "Longitude in WGS84 degrees", example: 4.3525 })
	@IsNumber()
	@Min(-180)
	@Max(180)
	lon!: number;
}

// Web -> API request. The browser speaks the Routess vocabulary
// (Activity + RoutingPreferences); the API translates to the Valhalla
// costing JSON via @routess/core's pure translator (see ADR-0022) and
// forwards to the cluster-internal Valhalla service.
export class RouteRequestDto {
	@ApiProperty({
		description: "Activity that determines the Valhalla costing model (bicycle vs pedestrian).",
		enum: ROUTE_ACTIVITIES,
		example: "cycle",
	})
	@IsIn(ROUTE_ACTIVITIES)
	activity!: RouteActivity;

	@ApiProperty({
		description: "Routes preferences inputs that shape the route. Translated to Valhalla costing server-side.",
		type: RoutingPreferencesDto,
	})
	@ValidateNested()
	@Type(() => RoutingPreferencesDto)
	preferences!: RoutingPreferencesDto;

	@ApiProperty({
		description: "Locations to route through, in order. Capped at 25.",
		type: [RouteLocationDto],
		minItems: 2,
		maxItems: MAX_ROUTE_LOCATIONS,
	})
	@IsArray()
	@ArrayMinSize(2)
	@ArrayMaxSize(MAX_ROUTE_LOCATIONS)
	@ValidateNested({ each: true })
	@Type(() => RouteLocationDto)
	locations!: RouteLocationDto[];

	@ApiPropertyOptional({
		description: "Walking speed in kilometers per hour. Only applied to pedestrian routing.",
		minimum: 0.5,
		maximum: 25,
	})
	@IsOptional()
	@IsNumber()
	@Min(0.5)
	@Max(25)
	walkingSpeedKmh?: number;
}

export class RouteLegSummaryDto {
	@ApiProperty({ description: "Leg length in kilometers." })
	length!: number;

	@ApiProperty({ description: "Leg duration in seconds." })
	time!: number;
}

export class RouteLegDto {
	@ApiProperty({ description: "Polyline6-encoded shape of the leg." })
	shape!: string;

	@ApiProperty({ type: RouteLegSummaryDto })
	summary!: RouteLegSummaryDto;
}

export class RouteSnappedLocationDto {
	@ApiProperty({ description: "Snapped latitude (may differ from input)." })
	lat!: number;

	@ApiProperty({ description: "Snapped longitude (may differ from input)." })
	lon!: number;

	@ApiPropertyOptional({ description: "Index of the originally-supplied location, when Valhalla returns it." })
	original_index?: number;
}

export class RoutingRouteResponseDto {
	@ApiProperty({ type: [RouteLegDto] })
	legs!: RouteLegDto[];

	@ApiProperty({ type: [RouteSnappedLocationDto] })
	locations!: RouteSnappedLocationDto[];
}
