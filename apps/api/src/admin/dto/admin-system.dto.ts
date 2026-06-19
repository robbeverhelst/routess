import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AdminSystemHealthDto {
	@ApiProperty({ example: "ok" })
	status!: "ok" | "degraded" | "down";

	@ApiProperty({ example: "1.111.2" })
	version!: string;

	@ApiProperty({ example: "production" })
	nodeEnv!: string;

	@ApiProperty({ example: 142 })
	uptimeSeconds!: number;

	@ApiProperty({ example: true })
	databaseReachable!: boolean;
}

export class AdminConfigSummaryDto {
	@ApiProperty({ example: true })
	telemetryEnabled!: boolean;

	@ApiProperty({ example: true })
	metricsEnabled!: boolean;

	@ApiProperty({ example: false })
	otlpExportConfigured!: boolean;

	@ApiProperty({ example: 1, description: "Number of admin emails configured (the emails themselves are not exposed)" })
	adminEmailsCount!: number;

	@ApiProperty({ example: { apiOverview: "https://grafana.example.com/d/routess-api" } })
	grafanaUrls!: Record<string, string>;

	@ApiPropertyOptional({
		nullable: true,
		example: "https://umami.example.com/dashboard",
		description: "Umami dashboard for behavioural funnels/retention (ProductEvents)",
	})
	umamiUrl!: string | null;

	@ApiPropertyOptional({
		nullable: true,
		example: "https://glitchtip.example.com/routess",
		description: "GlitchTip project for browser error reports",
	})
	glitchtipUrl!: string | null;
}
