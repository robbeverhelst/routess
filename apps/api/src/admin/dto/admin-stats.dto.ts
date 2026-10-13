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

export class AdminSignupMetricsDto {
	@ApiProperty({ example: 1342, description: "Non-deleted users" })
	total!: number;

	@ApiProperty({ example: 8 })
	today!: number;

	@ApiProperty({ example: 61 })
	last7Days!: number;

	@ApiProperty({ example: 240 })
	last30Days!: number;

	@ApiProperty({ type: [AdminTimeseriesPointDto] })
	daily!: AdminTimeseriesPointDto[];
}

export class AdminActiveUserMetricsDto {
	@ApiProperty({ example: 42, description: "Users with session activity in the last 24 hours" })
	last24Hours!: number;

	@ApiProperty({ example: 87, description: "Users with session activity in the last 7 days" })
	last7Days!: number;

	@ApiProperty({ example: 260, description: "Users with session activity in the last 30 days" })
	last30Days!: number;
}

export class AdminGenerationPointDto {
	@ApiProperty({ example: "2026-05-01" })
	date!: string;

	@ApiProperty({ example: 40, description: "route_generation_started ProductEvents" })
	started!: number;

	@ApiProperty({ example: 36, description: "route_generation_succeeded ProductEvents" })
	succeeded!: number;

	@ApiProperty({ example: 4, description: "route_generation_failed ProductEvents" })
	failed!: number;
}

export class AdminGenerationMetricsDto {
	@ApiProperty({
		example: true,
		description: "False when Umami is not configured or could not be read; `daily` is then empty",
	})
	productEventsAvailable!: boolean;

	@ApiProperty({ type: [AdminGenerationPointDto], description: "Generation attempts per day, from Umami" })
	daily!: AdminGenerationPointDto[];

	@ApiProperty({
		type: [AdminTimeseriesPointDto],
		description: "Routes saved from a GenerationCandidate per day, from Postgres",
	})
	savedDaily!: AdminTimeseriesPointDto[];
}

export class AdminPayingUserMetricsDto {
	@ApiProperty({ example: true })
	billingEnabled!: boolean;

	@ApiProperty({ example: 18, description: "Users holding an unexpired paid Pro pass" })
	active!: number;

	@ApiProperty({ example: 25, description: "Users who have ever completed a Payment" })
	everPaid!: number;

	@ApiProperty({ example: 140, description: "Users on Pro right now from any source (paid, OG grant, manual)" })
	proUsers!: number;

	@ApiProperty({
		type: [AdminTimeseriesPointDto],
		description: "Payments per day, including from since-deleted accounts",
	})
	paymentsDaily!: AdminTimeseriesPointDto[];
}

export class AdminMetricsDto {
	@ApiProperty({ example: 30 })
	days!: number;

	@ApiProperty({ type: AdminSignupMetricsDto })
	signups!: AdminSignupMetricsDto;

	@ApiProperty({ type: AdminActiveUserMetricsDto })
	activeUsers!: AdminActiveUserMetricsDto;

	@ApiProperty({ type: AdminGenerationMetricsDto })
	generations!: AdminGenerationMetricsDto;

	@ApiProperty({ type: AdminPayingUserMetricsDto })
	payingUsers!: AdminPayingUserMetricsDto;
}
