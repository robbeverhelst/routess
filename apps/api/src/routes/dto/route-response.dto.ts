import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	PROVENANCES,
	type Provenance,
	ROUTE_ACTIVITIES,
	ROUTE_VISIBILITIES,
	type RouteActivity,
	type RouteVisibility,
} from "@routess/core";
import { RoutingPreferencesDto } from "../../common/routing-preferences.dto";
import { UserResponseDto } from "../../users/dto/user-response.dto";

class WaypointResponseDto {
	@ApiProperty({
		description: "Waypoint coordinate as a [lng, lat] pair",
		example: [-74.006, 40.7128],
		type: "array",
		items: { type: "number" },
		minItems: 2,
		maxItems: 2,
	})
	coord!: [number, number];

	@ApiProperty({
		enum: ["routed", "direct"],
	})
	type!: "routed" | "direct";

	@ApiPropertyOptional({ description: "Optional user-assigned name for the waypoint" })
	name?: string;

	@ApiPropertyOptional({ description: "Timestamp when the waypoint was recorded" })
	timestamp?: string;
}

export class RouteResponseDto {
	@ApiProperty()
	id!: number;

	@ApiProperty()
	name!: string;

	@ApiPropertyOptional()
	description?: string;

	@ApiPropertyOptional({ enum: ROUTE_ACTIVITIES })
	activity?: RouteActivity;

	@ApiProperty({ enum: ROUTE_VISIBILITIES })
	visibility!: RouteVisibility;

	@ApiProperty({ type: [String] })
	tags!: string[];

	@ApiProperty({ description: "Whether the owner marked this route as a favourite" })
	favourite!: boolean;

	@ApiProperty({
		type: [WaypointResponseDto],
	})
	waypoints!: WaypointResponseDto[];

	@ApiPropertyOptional({
		description: "Routed polyline as an array of [lng, lat] coordinate pairs",
	})
	geometry?: [number, number][];

	@ApiPropertyOptional({
		description: "Distance in meters",
	})
	distance?: number;

	@ApiPropertyOptional({
		description: "Duration in seconds",
	})
	duration?: number;

	@ApiPropertyOptional({
		description: "Elevation gain in meters",
	})
	elevationGain?: number;

	@ApiPropertyOptional()
	startAddress?: string;

	@ApiPropertyOptional()
	endAddress?: string;

	@ApiPropertyOptional({
		description: "Inputs that produced this route's geometry. Null for legacy / GPX-imported routes.",
		type: RoutingPreferencesDto,
	})
	routingPreferences?: RoutingPreferencesDto | null;

	@ApiProperty({
		description: "How this route was produced.",
		enum: PROVENANCES,
	})
	provenance!: Provenance;

	@ApiProperty({
		type: UserResponseDto,
	})
	user!: UserResponseDto;

	@ApiProperty()
	createdAt!: string;

	@ApiProperty()
	updatedAt!: string;
}
