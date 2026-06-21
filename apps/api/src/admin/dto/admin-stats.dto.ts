import { ApiProperty } from "@nestjs/swagger";

export class AdminTimeseriesPointDto {
	@ApiProperty({ example: "2026-05-01" })
	date!: string;

	@ApiProperty({ example: 12 })
	count!: number;
}

export class AdminOverviewDto {
	@ApiProperty({ example: 1342 })
	totalUsers!: number;

	@ApiProperty({ example: 5821 })
	totalRoutes!: number;

	@ApiProperty({ example: 73 })
	activeSessions!: number;

	@ApiProperty({ example: 8 })
	signupsToday!: number;

	@ApiProperty({ type: [AdminTimeseriesPointDto] })
	signupsLast30Days!: AdminTimeseriesPointDto[];

	@ApiProperty({ type: [AdminTimeseriesPointDto] })
	routesCreatedLast30Days!: AdminTimeseriesPointDto[];
}

export class AdminUserStatsDto {
	@ApiProperty({ example: 1342 })
	totalUsers!: number;

	@ApiProperty({ example: 1230 })
	verifiedUsers!: number;

	@ApiProperty({ example: 14 })
	deletedUsers!: number;

	@ApiProperty({ example: 87 })
	activeLast7Days!: number;

	@ApiProperty({ type: [AdminTimeseriesPointDto] })
	signupsLast30Days!: AdminTimeseriesPointDto[];
}

export class AdminRouteCountByActivityDto {
	@ApiProperty({ example: "cycle", nullable: true })
	activity!: string | null;

	@ApiProperty({ example: 2341 })
	count!: number;
}

export class AdminTopCreatorDto {
	@ApiProperty({ example: 42 })
	userId!: number;

	@ApiProperty({ example: "creator@example.com" })
	email!: string;

	@ApiProperty({ example: "Jane Doe" })
	name!: string;

	@ApiProperty({ example: 87 })
	routeCount!: number;
}

export class AdminRouteStatsDto {
	@ApiProperty({ example: 5821 })
	totalRoutes!: number;

	@ApiProperty({ type: [AdminRouteCountByActivityDto] })
	byActivity!: AdminRouteCountByActivityDto[];

	@ApiProperty({ type: [AdminTimeseriesPointDto] })
	createdLast30Days!: AdminTimeseriesPointDto[];

	@ApiProperty({ type: [AdminTopCreatorDto] })
	topCreators!: AdminTopCreatorDto[];
}

export class AdminConversionDto {
	@ApiProperty({ example: 1342, description: "Non-deleted users" })
	totalUsers!: number;

	@ApiProperty({ example: 612, description: "Users who own at least one route" })
	usersWithRoute!: number;

	@ApiProperty({ example: 45.6, description: "usersWithRoute / totalUsers, as a percentage" })
	conversionPct!: number;
}

export class AdminDistributionBucketDto {
	@ApiProperty({ example: "5-15km" })
	label!: string;

	@ApiProperty({ example: 1204 })
	count!: number;
}

export class AdminRegionDto {
	@ApiProperty({ example: "Gent", nullable: true })
	city!: string | null;

	@ApiProperty({ example: "Oost-Vlaanderen", nullable: true })
	region!: string | null;

	@ApiProperty({ example: "BE", nullable: true })
	countryCode!: string | null;

	@ApiProperty({ example: 87 })
	count!: number;
}

export class AdminEngagementDto {
	@ApiProperty({ type: AdminConversionDto })
	signupToFirstRoute!: AdminConversionDto;

	@ApiProperty({ type: [AdminDistributionBucketDto], description: "Route counts by distance band" })
	distanceDistribution!: AdminDistributionBucketDto[];

	@ApiProperty({ type: [AdminRegionDto], description: "Top regions by route count (from derived Place)" })
	topRegions!: AdminRegionDto[];
}
