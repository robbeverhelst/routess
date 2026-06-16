import { ApiProperty } from "@nestjs/swagger";
import { NAV_CUE_KINDS, type NavCueKind, ROUTE_ACTIVITIES, type RouteActivity } from "@routess/core";
import { IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";

export const CUE_LOCALES = ["en", "nl", "fr", "de"] as const;
export type CueLocale = (typeof CUE_LOCALES)[number];

// A 10k-point polyline6 encodes to roughly 60k chars; this cap allows long
// external routes while bounding the request body.
const MAX_GEOMETRY_CHARS = 250_000;

export class CuesRequestDto {
	@ApiProperty({
		required: false,
		description:
			"Id of a saved Route to navigate. Only public and unlisted routes resolve on this anonymous endpoint; clients holding a private route send its geometry instead.",
	})
	@IsOptional()
	@IsInt()
	@IsPositive()
	routeId?: number;

	@ApiProperty({ required: false, description: "Id of an ExternalRoute to navigate." })
	@IsOptional()
	@IsInt()
	@IsPositive()
	externalRouteId?: number;

	@ApiProperty({
		required: false,
		description:
			"Polyline6-encoded RoutePath to navigate, for unsaved drafts and private routes. Exactly one of routeId, externalRouteId, or geometry must be provided.",
		maxLength: MAX_GEOMETRY_CHARS,
	})
	@IsOptional()
	@IsString()
	@MaxLength(MAX_GEOMETRY_CHARS)
	geometry?: string;

	@ApiProperty({ enum: ROUTE_ACTIVITIES, description: "Drives the costing model and narrative phrasing." })
	@IsIn(ROUTE_ACTIVITIES)
	activity!: RouteActivity;

	@ApiProperty({ enum: CUE_LOCALES, required: false, default: "en", description: "Language of the cue texts." })
	@IsOptional()
	@IsIn(CUE_LOCALES)
	locale?: CueLocale;
}

export class CueDto {
	@ApiProperty({ enum: NAV_CUE_KINDS })
	kind!: NavCueKind;

	@ApiProperty({ description: "Index into the stored RoutePath the cue is anchored to." })
	shapeIndex!: number;

	@ApiProperty({ description: "Distance from the route start to the cue, in meters along the RoutePath." })
	distanceAlongMeters!: number;

	@ApiProperty({ description: "Localized cue text; banner and voice present it verbatim." })
	text!: string;

	@ApiProperty({ required: false, type: [String] })
	streetNames?: string[];

	@ApiProperty({ required: false, description: "Valhalla maneuver type, when kind is maneuver." })
	maneuverType?: number;

	@ApiProperty({ required: false, description: "NodeNetwork ref, when kind is node." })
	nodeRef?: string;

	@ApiProperty({ required: false, description: "The next NodeNetwork ref along the route, when kind is node." })
	nodeNextRef?: string;
}

export class CuesResponseDto {
	@ApiProperty({ type: [CueDto] })
	cues!: CueDto[];

	@ApiProperty({
		description:
			"True when map-matching failed and the cues degrade to a single follow-the-path cue. Degraded responses are never cached.",
	})
	degraded!: boolean;
}
