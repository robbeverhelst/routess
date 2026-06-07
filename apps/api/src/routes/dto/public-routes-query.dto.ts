import { BadRequestException } from "@nestjs/common";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { ROUTE_ACTIVITIES, type RouteActivity } from "@routess/core";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from "class-validator";
import { ListRoutesQueryDto } from "./list-routes-query.dto";

// Which eligibility gate the listing applies (CONTEXT.md "Discover"):
// - indexable: public Routes clearing the Indexable quality gate. The SEO
//   surface (landing sitemap, future RegionalHubs).
// - public: every public Route. The in-app Discover surface.
export const PUBLIC_ROUTE_GATES = ["indexable", "public"] as const;
export type PublicRouteGate = (typeof PUBLIC_ROUTE_GATES)[number];

const BBOX_PATTERN = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;

export interface ParsedBbox {
	minLng: number;
	minLat: number;
	maxLng: number;
	maxLat: number;
}

export class PublicRoutesQueryDto extends ListRoutesQueryDto {
	@ApiPropertyOptional({
		description: "Eligibility gate: 'indexable' (SEO surfaces, default) or 'public' (in-app Discover).",
		enum: PUBLIC_ROUTE_GATES,
		default: "indexable",
	})
	@IsOptional()
	@IsIn(PUBLIC_ROUTE_GATES)
	gate?: PublicRouteGate;

	@ApiPropertyOptional({
		description:
			"Viewport filter as 'minLng,minLat,maxLng,maxLat'. Matches routes whose bounding box overlaps it (ADR 0030).",
		example: "3.6,50.9,3.8,51.1",
	})
	@IsOptional()
	@Matches(BBOX_PATTERN, { message: "bbox must be 'minLng,minLat,maxLng,maxLat'" })
	bbox?: string;

	@ApiPropertyOptional({ enum: ROUTE_ACTIVITIES })
	@IsOptional()
	@IsIn(ROUTE_ACTIVITIES)
	activity?: RouteActivity;

	@ApiPropertyOptional({ description: "Filter by derived Place city (case-insensitive exact match)." })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	placeCity?: string;

	@ApiPropertyOptional({ description: "Minimum route distance in meters." })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	minDistance?: number;

	@ApiPropertyOptional({ description: "Maximum route distance in meters." })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	maxDistance?: number;
}

export function parseBbox(bbox: string): ParsedBbox {
	const [minLng, minLat, maxLng, maxLat] = bbox.split(",").map(Number);
	const valid =
		[minLng, minLat, maxLng, maxLat].every(Number.isFinite) &&
		minLng >= -180 &&
		maxLng <= 180 &&
		minLat >= -90 &&
		maxLat <= 90 &&
		minLng <= maxLng &&
		minLat <= maxLat;
	if (!valid) {
		throw new BadRequestException("bbox must be 'minLng,minLat,maxLng,maxLat' within valid coordinate ranges");
	}
	return { minLng, minLat, maxLng, maxLat };
}
