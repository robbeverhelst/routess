import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// One row per SeedSource for the admin seeding panel (ADR 0035).
export class AdminSeedSourceDto {
	@ApiProperty({ example: "eurovelo" })
	key!: string;

	@ApiProperty({ example: "EuroVelo (European Cyclists' Federation)" })
	displayName!: string;

	@ApiProperty({ example: "ODbL-1.0" })
	license!: string;

	@ApiProperty({ example: "green", enum: ["green", "yellow", "red"] })
	status!: string;

	@ApiProperty({ description: "Live ExternalRoutes from this source.", example: 17 })
	routeCount!: number;

	@ApiProperty({ description: "Soft-deleted (vanished from the source feed).", example: 2 })
	removedCount!: number;

	@ApiProperty({ example: 30 })
	refreshIntervalDays!: number;

	@ApiPropertyOptional({ nullable: true, description: "Null = never synced." })
	lastRefreshedAt!: string | null;

	@ApiPropertyOptional({ nullable: true, description: "Projected next automatic sync; null for manual sources." })
	nextRefreshAt!: string | null;

	@ApiProperty({ description: "True when a green source has a stable feedUrl the CronJob can pull." })
	automatic!: boolean;

	@ApiPropertyOptional({ nullable: true, description: "Error of the latest refresh attempt; null = succeeded." })
	lastRefreshError!: string | null;

	@ApiPropertyOptional({ nullable: true, description: "Counts from the latest successful refresh." })
	lastRefreshStats!: { inserted: number; updated: number; unchanged: number; removed: number } | null;
}

export class AdminSeedSourcesDto {
	@ApiProperty({ type: [AdminSeedSourceDto] })
	items!: AdminSeedSourceDto[];
}

// Outcome of a manual "re-sync now" for one SeedSource.
export class AdminSeedRefreshResultDto {
	@ApiProperty({ example: "eurovelo" })
	source!: string;

	@ApiPropertyOptional({
		nullable: true,
		enum: ["not-due", "manual", "blocked"],
		description: "Set when the source was skipped rather than fetched. Forced re-sync never returns 'not-due'.",
	})
	skipped!: "not-due" | "manual" | "blocked" | null;

	@ApiPropertyOptional({ nullable: true, description: "Counts from the refresh; present on success." })
	result!: { inserted: number; updated: number; unchanged: number; removed: number } | null;

	@ApiPropertyOptional({ nullable: true, description: "Error message; present on failure." })
	error!: string | null;
}
