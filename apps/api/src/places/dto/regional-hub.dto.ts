import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ROUTE_ACTIVITIES, type RouteActivity } from "@routess/core";
import { IsIn } from "class-validator";

export class RegionalHubsQueryDto {
	@ApiProperty({
		enum: ROUTE_ACTIVITIES,
		description: "Activity the hubs cover; one hub exists per (activity, place).",
	})
	@IsIn(ROUTE_ACTIVITIES)
	activity!: RouteActivity;
}

export class RegionalHubDto {
	@ApiProperty({ description: "URL slug derived from the place city (kebab-cased ASCII)." })
	slug!: string;

	@ApiProperty({ description: "Place city as the geocoder returned it (local language)." })
	city!: string;

	@ApiPropertyOptional({ description: "Place region, e.g. 'Oost-Vlaanderen'." })
	region?: string;

	@ApiPropertyOptional({ description: "ISO 3166-1 alpha-2 country code." })
	countryCode?: string;

	@ApiProperty({ enum: ROUTE_ACTIVITIES })
	activity!: RouteActivity;

	@ApiProperty({ description: "Indexable routes in this place (Route + ExternalRoute, read-time union)." })
	indexableCount!: number;

	@ApiProperty({ description: "Most recent updatedAt across the hub's indexable routes (ISO 8601)." })
	lastModified!: string;
}
