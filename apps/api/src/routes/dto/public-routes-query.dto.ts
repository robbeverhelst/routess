import { raw } from "@mikro-orm/core";
import { BadRequestException } from "@nestjs/common";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { INDEXABLE_MIN_DISTANCE_METERS, ROUTE_ACTIVITIES, type RouteActivity } from "@routess/core";
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

export interface PublicListingFilters {
	activity?: RouteActivity;
	placeCity?: string;
	minDistance?: number;
	maxDistance?: number;
	bbox?: ParsedBbox;
}

// The non-distance half of isRouteIndexable, expressed in SQL so the listing
// can page with a real LIMIT instead of scanning the table and filtering in
// memory. isRouteIndexable stays the authority (see findPublicListing); this
// predicate must never be *tighter* than it, or routes would silently drop out
// of the sitemap. SQL btrim() strips spaces where JS trim() also strips tabs and
// newlines, so a name padded with those stays in here and is rejected by the
// canonical gate afterwards: looser, which is the safe direction.
function indexableGateSql(alias: string): string {
	const name = `btrim(${alias}.name)`;
	const tags = `coalesce(${alias}.tags, '[]'::jsonb)`;
	return `(length(${name}) >= 3
		and ${name} not ilike 'untitled%'
		and ${name} not ilike 'naamloos%'
		and (
			length(btrim(coalesce(${alias}.description, ''))) >= 20
			or (jsonb_typeof(${tags}) = 'array' and jsonb_array_length(${tags}) > 0)
		))`;
}

// Shared where-clause for the public listing surfaces, applied identically to
// Route and ExternalRoute so the read-time union (ADR 0035) can never drift.
// The indexable gate folds in the quality-floor distance prefilter and the
// quality gate itself; bbox is viewport overlap on the persisted columns
// (ADR 0030).
export function publicListingWhere(
	filters: PublicListingFilters,
	gate: PublicRouteGate,
): Record<string | symbol, unknown> {
	const where: Record<string | symbol, unknown> = {};
	if (filters.activity) where.activity = filters.activity;
	// Case-insensitive exact match: geocoder casing should not leak into URLs.
	if (filters.placeCity) where.placeCity = { $ilike: filters.placeCity.replace(/[%_\\]/g, (c) => `\\${c}`) };
	if (filters.minDistance !== undefined || filters.maxDistance !== undefined) {
		where.distance = {
			...(filters.minDistance !== undefined ? { $gte: filters.minDistance } : {}),
			...(filters.maxDistance !== undefined ? { $lte: filters.maxDistance } : {}),
		};
	}
	if (gate === "indexable") {
		where.distance = {
			...(where.distance as object | undefined),
			$gte: Math.max(filters.minDistance ?? 0, INDEXABLE_MIN_DISTANCE_METERS),
		};
		where[raw((alias) => indexableGateSql(alias))] = true;
	}
	if (filters.bbox) {
		where.bboxMinLat = { $lte: filters.bbox.maxLat };
		where.bboxMaxLat = { $gte: filters.bbox.minLat };
		where.bboxMinLng = { $lte: filters.bbox.maxLng };
		where.bboxMaxLng = { $gte: filters.bbox.minLng };
	}
	return where;
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
