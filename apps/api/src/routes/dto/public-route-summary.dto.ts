import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ROUTE_ACTIVITIES, type RouteActivity } from "@routess/core";
import { PublicUserDto } from "../../users/dto/user-response.dto";

// Cards and map previews don't need the full RoutePath; this keeps a 50-item
// Discover page at a sane payload size.
export const PUBLIC_SUMMARY_GEOMETRY_MAX_POINTS = 80;

// Attribution block for an ExternalRoute (ADR 0033). Present only on seeded
// open-data routes; user Routes leave it undefined. The creator-on-the-map.
export class PublicRouteSourceDto {
	@ApiProperty({ description: "SeedSource key, e.g. 'eurovelo'." })
	key!: string;

	@ApiProperty({ description: "Human-readable source name." })
	name!: string;

	@ApiProperty({ description: "SPDX-ish license id, e.g. 'ODbL-1.0'." })
	license!: string;

	@ApiProperty({ description: "Required attribution string." })
	attribution!: string;

	@ApiProperty({ description: "Dataset / homepage URL the attribution links to." })
	url!: string;
}

// One summary shape for both gates of GET /routes/public. The original
// sitemap consumer reads id/name/distance/updatedAt; everything added since
// is optional and additive. Geometry is only present for gate=public (the
// Discover surface needs it for map previews; the sitemap does not).
export class PublicRouteSummaryDto {
	@ApiProperty()
	id!: number;

	@ApiProperty()
	name!: string;

	@ApiPropertyOptional({ description: "Distance in meters" })
	distance?: number;

	@ApiProperty()
	updatedAt!: string;

	@ApiPropertyOptional({ description: "Slug-id path segment of the public route page, e.g. 'sunday-loop-42'." })
	slugId?: string;

	@ApiPropertyOptional({ enum: ROUTE_ACTIVITIES })
	activity?: RouteActivity;

	@ApiPropertyOptional({ description: "Elevation gain in meters" })
	elevationGain?: number;

	@ApiPropertyOptional({ type: [String] })
	tags?: string[];

	@ApiPropertyOptional({ description: "First transition to public (CONTEXT.md 'PublishedAt')." })
	publishedAt?: string;

	@ApiPropertyOptional({ description: "Derived Place city (CONTEXT.md 'Place')." })
	placeCity?: string;

	@ApiPropertyOptional({ description: "Derived Place region." })
	placeRegion?: string;

	@ApiPropertyOptional({ description: "Derived Place ISO 3166-1 alpha-2 country code." })
	placeCountryCode?: string;

	@ApiPropertyOptional({
		description: "Downsampled RoutePath as [lng, lat] pairs, suitable for thumbnails and map previews.",
	})
	geometry?: [number, number][];

	@ApiPropertyOptional({ type: PublicUserDto })
	user?: PublicUserDto;

	@ApiPropertyOptional({
		type: PublicRouteSourceDto,
		description: "Attribution for a seeded ExternalRoute; absent on user routes (ADR 0033).",
	})
	source?: PublicRouteSourceDto;
}
