import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	PROVENANCES,
	type Provenance,
	ROUTE_ACTIVITIES,
	ROUTE_VISIBILITIES,
	type RouteActivity,
	type RouteVisibility,
	type SurfaceComposition,
} from "@routess/core";
import { RoutingPreferencesDto } from "../../common/routing-preferences.dto";
import { PublicUserDto } from "../../users/dto/user-response.dto";

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

	@ApiPropertyOptional({ description: "Derived Place city (CONTEXT.md 'Place'). Server-derived, never user-edited." })
	placeCity?: string;

	@ApiPropertyOptional({ description: "Derived Place region." })
	placeRegion?: string;

	@ApiPropertyOptional({ description: "Derived Place ISO 3166-1 alpha-2 country code." })
	placeCountryCode?: string;

	@ApiPropertyOptional({
		description: "Inputs that produced this route's geometry. Null for legacy / GPX-imported routes.",
		type: RoutingPreferencesDto,
	})
	routingPreferences?: RoutingPreferencesDto | null;

	@ApiPropertyOptional({
		description:
			"SurfaceBuckets along the RoutePath, derived server-side at save (ADR 0031). Null while derivation is pending or for routes without snapped geometry.",
		type: "object",
		additionalProperties: true,
	})
	surfaceComposition?: SurfaceComposition | null;

	@ApiProperty({
		description: "How this route was produced.",
		enum: PROVENANCES,
	})
	provenance!: Provenance;

	@ApiProperty({
		description:
			"Unguessable 32-hex handle for share links. Unlisted routes are only reachable anonymously via this token.",
		example: "9f86d081884c7d659a2feaa0c55ad015",
	})
	shareToken!: string;

	@ApiProperty({
		type: PublicUserDto,
	})
	user!: PublicUserDto;

	@ApiProperty()
	createdAt!: string;

	@ApiProperty()
	updatedAt!: string;
}
