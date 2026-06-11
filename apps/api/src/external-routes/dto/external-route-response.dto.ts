import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ROUTE_ACTIVITIES, type RouteActivity } from "@routess/core";
import { PublicRouteSourceDto } from "../../routes/dto/public-route-summary.dto";

// Detail shape for a single ExternalRoute page (/r/{slug}-x{id}). Deliberately
// separate from RouteResponseDto: an ExternalRoute has no owner, Waypoints,
// visibility, or share token (ADR 0035). It carries source attribution instead.
export class ExternalRouteResponseDto {
	@ApiProperty()
	id!: number;

	@ApiProperty({ description: "Public route page slug-id, '-x{id}' form." })
	slugId!: string;

	@ApiProperty()
	name!: string;

	@ApiPropertyOptional()
	description?: string;

	@ApiPropertyOptional({ enum: ROUTE_ACTIVITIES })
	activity?: RouteActivity;

	@ApiProperty({ type: [String] })
	tags!: string[];

	@ApiProperty({ description: "Full RoutePath as [lng, lat] pairs." })
	geometry!: [number, number][];

	@ApiPropertyOptional({ description: "Distance in meters" })
	distance?: number;

	@ApiPropertyOptional({ description: "Duration in seconds" })
	duration?: number;

	@ApiPropertyOptional({ description: "Elevation gain in meters" })
	elevationGain?: number;

	@ApiPropertyOptional()
	placeCity?: string;

	@ApiPropertyOptional()
	placeRegion?: string;

	@ApiPropertyOptional()
	placeCountryCode?: string;

	@ApiProperty({ type: PublicRouteSourceDto })
	source!: PublicRouteSourceDto;

	@ApiProperty({ description: "Always 'external' so clients can branch on the route kind." })
	kind!: "external";

	@ApiProperty()
	updatedAt!: string;
}
