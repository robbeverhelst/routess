import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	GENERATION_FAILURE_CODES,
	type GenerationFailureCode,
	HEADINGS,
	type Heading,
	ROUTE_ACTIVITIES,
	type RouteActivity,
	SURFACE_BUCKETS,
} from "@routess/core";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, Max, Min, ValidateNested } from "class-validator";
import { RoutingPreferencesDto } from "../../common/routing-preferences.dto";
import { RouteLocationDto } from "../../routing/dto/route.dto";

const MAX_EXCLUDED_BEARINGS = 16;

export class GenerateRequestDto {
	@ApiProperty({ description: "Loop start point; the generated route begins and ends here.", type: RouteLocationDto })
	@ValidateNested()
	@Type(() => RouteLocationDto)
	start!: RouteLocationDto;

	@ApiProperty({ enum: ROUTE_ACTIVITIES, example: "cycle" })
	@IsIn(ROUTE_ACTIVITIES)
	activity!: RouteActivity;

	@ApiProperty({ description: "Target loop distance in kilometers.", minimum: 1, maximum: 200, example: 40 })
	@IsNumber()
	@Min(1)
	@Max(200)
	targetDistanceKm!: number;

	@ApiProperty({
		description: "Compass arc the loop should extend toward. A soft preference, never a hard guarantee.",
		enum: HEADINGS,
		example: "any",
	})
	@IsIn(HEADINGS)
	heading!: Heading;

	@ApiProperty({ type: RoutingPreferencesDto })
	@ValidateNested()
	@Type(() => RoutingPreferencesDto)
	preferences!: RoutingPreferencesDto;

	@ApiPropertyOptional({
		description: "Fan bearings already shown to the user; regenerate passes them to get fresh shapes.",
		type: [Number],
		maxItems: MAX_EXCLUDED_BEARINGS,
	})
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(MAX_EXCLUDED_BEARINGS)
	@IsNumber({}, { each: true })
	excludeBearings?: number[];
}

export class GenerationCandidateDto {
	@ApiProperty({ description: "Fan bearing that produced this candidate, in degrees." })
	bearingDeg!: number;

	@ApiProperty({
		description:
			"Snapped via points in loop order (excluding the start). Confirming the candidate turns start + vias + start into the draft's Waypoints.",
		type: [RouteLocationDto],
	})
	viaPoints!: RouteLocationDto[];

	@ApiProperty({ description: "Polyline6-encoded RoutePath of the full loop." })
	shape!: string;

	@ApiProperty({ description: "Routed distance in kilometers." })
	distanceKm!: number;

	@ApiProperty({ description: "Routed duration in seconds." })
	durationSeconds!: number;

	@ApiProperty({ description: "Overlap: % of distance traversing the same way more than once (0..100)." })
	overlapPct!: number;

	@ApiProperty({ description: "Weighted candidate score, 0..1, higher is better." })
	score!: number;

	@ApiProperty({ description: "True when the candidate is shown with a quality badge (elevated Overlap)." })
	lowQuality!: boolean;

	@ApiProperty({
		description: "Surface composition of the loop in meters per SurfaceBucket.",
		example: { paved: 32000, compacted: 4500, unpaved: 2500, path: 1000 },
	})
	surfaceMetersByBucket!: Record<(typeof SURFACE_BUCKETS)[number], number>;
}

export class GenerationFailureDto {
	@ApiProperty({ enum: GENERATION_FAILURE_CODES })
	code!: GenerationFailureCode;

	@ApiPropertyOptional({
		description: "Best Overlap % among rejected candidates; explains an all_candidates_low_quality failure.",
	})
	bestOverlapPct?: number;
}

export class GenerateResponseDto {
	@ApiProperty({
		description: "Up to 3 diverse GenerationCandidates, best score first. Empty when generation failed.",
		type: [GenerationCandidateDto],
	})
	candidates!: GenerationCandidateDto[];

	@ApiPropertyOptional({
		description: "Set when no usable candidate could be produced; the code drives retry suggestions in the UI.",
		type: GenerationFailureDto,
	})
	failure?: GenerationFailureDto;
}
