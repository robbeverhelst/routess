import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { RouteActivity } from "@routess/core";

// The public projection of a User (CONTEXT.md "Profile"). Stats are computed
// over public Routes only: nothing a stranger couldn't derive from the
// visible list. No email, no id, no preferences.
export class ProfileSummaryDto {
	@ApiProperty({ example: "jane-doe" })
	handle!: string;

	@ApiProperty({ example: "Jane Doe" })
	name!: string;

	@ApiPropertyOptional({ example: "https://example.com/avatar.jpg", nullable: true })
	avatar?: string | null;
}

export class ProfileStatsDto {
	@ApiProperty({ example: 12 })
	publicRoutes!: number;

	@ApiProperty({ example: 423500, description: "Total distance of public routes in meters" })
	totalDistance!: number;

	@ApiProperty({ example: 5210, description: "Total elevation gain of public routes in meters" })
	totalElevationGain!: number;

	@ApiProperty({ example: 3 })
	followers!: number;

	@ApiProperty({ example: 8 })
	following!: number;
}

export class ProfileRouteDto {
	@ApiProperty({ example: 42 })
	id!: number;

	@ApiProperty({
		example: "gravel-loop-around-ghent-42",
		description:
			"Canonical /r/{slugId} path segment. Public routes use the id form; unlisted ones the share-token form (ids are not served to non-owners).",
	})
	slugId!: string;

	@ApiProperty({ example: "Gravel loop around Ghent" })
	name!: string;

	@ApiPropertyOptional({ example: "Cycling", nullable: true })
	activity?: RouteActivity | null;

	@ApiPropertyOptional({ example: 42350, nullable: true })
	distance?: number | null;

	@ApiPropertyOptional({ example: 5400, nullable: true })
	duration?: number | null;

	@ApiPropertyOptional({ example: 320, nullable: true })
	elevationGain?: number | null;

	@ApiPropertyOptional({ example: "2026-06-01T10:00:00.000Z", nullable: true })
	publishedAt?: string | null;

	@ApiProperty({ example: ["gravel", "ardennes"] })
	tags!: string[];
}

export class ProfileResponseDto extends ProfileSummaryDto {
	@ApiProperty({ type: ProfileStatsDto })
	stats!: ProfileStatsDto;

	@ApiProperty({
		nullable: true,
		example: true,
		description: "Whether the authenticated viewer follows this profile; null for anonymous viewers.",
	})
	isFollowing!: boolean | null;

	@ApiProperty({
		example: true,
		description:
			"Whether this profile clears the Indexable gate (>= 3 Indexable routes). Drives noindex on the landing page.",
	})
	isIndexable!: boolean;

	@ApiProperty({ type: ProfileRouteDto, isArray: true })
	routes!: ProfileRouteDto[];
}
