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
