import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { RoutingPreferences, SurfaceComposition, Waypoint } from "@routess/core";

export class AdminRouteOwnerDto {
	@ApiProperty({ example: 42 })
	id!: number;

	@ApiProperty({ example: "owner@example.com" })
	email!: string;

	@ApiProperty({ example: "Jane Doe" })
	name!: string;
}

export class AdminRouteListItemDto {
	@ApiProperty({ example: 1234 })
	id!: number;

	@ApiProperty({ example: "Sunday morning loop" })
	name!: string;

	@ApiPropertyOptional({ example: "cycle", nullable: true })
	activity!: string | null;

	@ApiProperty({ example: "private" })
	visibility!: string;

	@ApiPropertyOptional({ example: 24300, nullable: true, description: "Distance in meters" })
	distance!: number | null;

	@ApiPropertyOptional({ example: 4500, nullable: true, description: "Duration in seconds" })
	duration!: number | null;

	@ApiPropertyOptional({ example: 320, nullable: true, description: "Elevation gain in meters" })
	elevationGain!: number | null;

	@ApiProperty({ type: AdminRouteOwnerDto })
	owner!: AdminRouteOwnerDto;

	@ApiProperty({ example: "2026-05-08T08:59:00.000Z" })
	createdAt!: string;

	@ApiPropertyOptional({ nullable: true, description: "When soft-deleted, if applicable" })
	deletedAt!: string | null;
}

export class AdminRouteListDto {
	@ApiProperty({ type: [AdminRouteListItemDto] })
	items!: AdminRouteListItemDto[];

	@ApiProperty({ example: 5821 })
	total!: number;

	@ApiProperty({ example: 1 })
	page!: number;

	@ApiProperty({ example: 20 })
	pageSize!: number;
}

export class AdminRouteDetailDto extends AdminRouteListItemDto {
	@ApiPropertyOptional({ nullable: true })
	description!: string | null;

	@ApiProperty({ type: [String], example: ["hilly", "scenic"] })
	tags!: string[];

	@ApiProperty({ example: 8, description: "Number of waypoints" })
	waypointCount!: number;

	@ApiProperty({ example: true, description: "Whether the route has a computed RoutePath geometry" })
	hasGeometry!: boolean;

	@ApiProperty({ description: "Ordered Waypoints (coord, type, optional name/timestamp)" })
	waypoints!: Waypoint[];

	@ApiPropertyOptional({
		nullable: true,
		description: "Computed RoutePath coordinate pairs for map rendering; null for routes with no geometry",
	})
	geometry!: [number, number][] | null;

	@ApiPropertyOptional({
		nullable: true,
		description: "RoutePath bounding box as [minLng, minLat, maxLng, maxLat]; null when no geometry",
	})
	bbox!: [number, number, number, number] | null;

	@ApiProperty({ example: "valhalla", description: "How the route was made (Provenance)" })
	provenance!: string;

	@ApiProperty({ example: false })
	favourite!: boolean;

	@ApiPropertyOptional({
		nullable: true,
		description: "RoutingPreferences that produced the geometry; null for legacy/GPX routes",
	})
	routingPreferences!: RoutingPreferences | null;

	@ApiPropertyOptional({ nullable: true, description: "SurfaceBucket composition along the RoutePath" })
	surfaceComposition!: SurfaceComposition | null;

	@ApiProperty({ description: "Share token backing unlisted/public links" })
	shareToken!: string;

	@ApiPropertyOptional({ nullable: true })
	placeCity!: string | null;

	@ApiPropertyOptional({ nullable: true })
	placeRegion!: string | null;

	@ApiPropertyOptional({ nullable: true })
	placeCountryCode!: string | null;

	@ApiPropertyOptional({ nullable: true, description: "First public transition timestamp" })
	publishedAt!: string | null;

	@ApiPropertyOptional({ nullable: true, description: "Source route id when copied from a shared route" })
	copiedFromRouteId!: number | null;

	@ApiPropertyOptional({ nullable: true, description: "Source user id when copied from a shared route" })
	copiedFromUserId!: number | null;

	@ApiPropertyOptional({ nullable: true })
	startAddress!: string | null;

	@ApiPropertyOptional({ nullable: true })
	endAddress!: string | null;

	@ApiProperty({ example: "2026-05-08T08:59:00.000Z" })
	updatedAt!: string;
}
