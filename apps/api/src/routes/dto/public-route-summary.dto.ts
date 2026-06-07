import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ROUTE_ACTIVITIES, type RouteActivity } from "@routess/core";
import { PublicUserDto } from "../../users/dto/user-response.dto";

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
}
