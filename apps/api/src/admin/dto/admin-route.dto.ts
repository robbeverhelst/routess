import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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
	privacy!: string;

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

	@ApiPropertyOptional({ nullable: true })
	startAddress!: string | null;

	@ApiPropertyOptional({ nullable: true })
	endAddress!: string | null;

	@ApiProperty({ example: "2026-05-08T08:59:00.000Z" })
	updatedAt!: string;

	@ApiPropertyOptional({ nullable: true, description: "When the route was soft-deleted, if applicable" })
	deletedAt!: string | null;
}
