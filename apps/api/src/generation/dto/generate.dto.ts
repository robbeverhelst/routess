import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	GENERATION_FAILURE_CODES,
	type GenerationFailureCode,
	HEADINGS,
	type Heading,
	ROUTE_ACTIVITIES,
	ROUTE_GENERATION_TYPES,
	type RouteActivity,
	type RouteGenerationType,
	SURFACE_BUCKETS,
} from "@routess/core";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	IsArray,
	IsBoolean,
	IsIn,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from "class-validator";
import { RoutingPreferencesDto } from "../../common/routing-preferences.dto";
import { RouteLocationDto } from "../../routing/dto/route.dto";

const MAX_EXCLUDED_BEARINGS = 16;
const MAX_ANCHORS = 200;

export class GenerationAnchorDto {
	@ApiProperty({ description: "Latitude in WGS84 degrees", example: 50.8467 })
	@IsNumber()
	@Min(-90)
	@Max(90)
	lat!: number;

	@ApiProperty({ description: "Longitude in WGS84 degrees", example: 4.3525 })
	@IsNumber()
	@Min(-180)
	@Max(180)
	lon!: number;

	@ApiPropertyOptional({ description: "NodeNetwork Node number when the anchor is a Node.", example: "45" })
	@IsOptional()
	@IsString()
	@MaxLength(16)
	ref?: string;

	@ApiPropertyOptional({ description: "Display name (a POI landmark, a geocoded place)." })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	name?: string;

	@ApiPropertyOptional({
		description:
			"true = must-pass: injected as a via into every candidate. false/absent = snap pool: nearby candidate vias move onto it. Anchors are hints; the server still validates and scores everything.",
	})
	@IsOptional()
	@IsBoolean()
	required?: boolean;
}

export class GenerateRequestDto {
	@ApiProperty({ description: "Loop start point; the generated route begins and ends here.", type: RouteLocationDto })
	@ValidateNested()
	@Type(() => RouteLocationDto)
	start!: RouteLocationDto;

	@ApiPropertyOptional({
		description: "Generated RouteType. `loop` (default) returns to the start; `a-to-b` requires `end`.",
		enum: ROUTE_GENERATION_TYPES,
		default: "loop",
	})
	@IsOptional()
	@IsIn(ROUTE_GENERATION_TYPES)
	routeType?: RouteGenerationType;

	@ApiPropertyOptional({
		description: "Destination for a-to-b generation; the route is stretched toward targetDistanceKm.",
		type: RouteLocationDto,
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => RouteLocationDto)
	end?: RouteLocationDto;

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

	@ApiPropertyOptional({
		description:
			"Explicit Anchors (POI landmarks, agent hints). Pool anchors attract nearby vias; must-pass anchors are injected as vias. Validated server-side: garbage anchors cannot produce off-network or out-of-area routes.",
		type: [GenerationAnchorDto],
		maxItems: MAX_ANCHORS,
	})
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(MAX_ANCHORS)
	@ValidateNested({ each: true })
	@Type(() => GenerationAnchorDto)
	anchors?: GenerationAnchorDto[];

	@ApiPropertyOptional({
		description:
			"Soft knooppunt mode (ADR-0037): the server derives a NodeNetwork anchor pool around the start, snaps vias onto Nodes, and scores NetworkFit. Out of coverage it degrades silently to plain generation.",
	})
	@IsOptional()
	@IsBoolean()
	preferNodeNetworks?: boolean;
}

export class GenerationViaPointDto extends RouteLocationDto {
	@ApiPropertyOptional({ description: "NodeNetwork Node number when this via sits on a Node.", example: "45" })
	ref?: string;

	@ApiPropertyOptional({ description: "Anchor display name (POI landmark)." })
	name?: string;
}

export class GenerationCandidateDto {
	@ApiProperty({ description: "Fan bearing that produced this candidate, in degrees." })
	bearingDeg!: number;

	@ApiProperty({
		description:
			"Snapped via points in loop order (excluding the start). Confirming the candidate turns start + vias + start into the draft's Waypoints. Vias on a NodeNetwork Node carry its ref.",
		type: [GenerationViaPointDto],
	})
	viaPoints!: GenerationViaPointDto[];

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

	@ApiPropertyOptional({
		description:
			"NetworkFit: % of the candidate riding the NodeNetwork (0..100). Only present when knooppunt mode was active and a Node pool was found.",
	})
	networkFitPct?: number;

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
