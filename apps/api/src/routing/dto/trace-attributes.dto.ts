import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNumber, Max, Min, ValidateNested } from "class-validator";

const MAX_SHAPE_POINTS = 1500;

export const VALHALLA_COSTINGS = ["pedestrian", "bicycle", "auto"] as const;
export type ValhallaCosting = (typeof VALHALLA_COSTINGS)[number];

export class TraceShapePointDto {
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
}

export class TraceAttributesRequestDto {
	@ApiProperty({
		description: "Costing model used by Valhalla to match the shape to edges.",
		enum: VALHALLA_COSTINGS,
		example: "pedestrian",
	})
	@IsIn(VALHALLA_COSTINGS)
	costing!: ValhallaCosting;

	@ApiProperty({
		description: `Recorded shape points to match against the road network. Capped at ${MAX_SHAPE_POINTS} points.`,
		type: [TraceShapePointDto],
		minItems: 2,
		maxItems: MAX_SHAPE_POINTS,
	})
	@IsArray()
	@ArrayMinSize(2)
	@ArrayMaxSize(MAX_SHAPE_POINTS)
	@ValidateNested({ each: true })
	@Type(() => TraceShapePointDto)
	shape!: TraceShapePointDto[];
}

export class TraceAttributesEdgeDto {
	@ApiProperty({ required: false, description: "OSM surface classification for the edge." })
	surface?: string;

	@ApiProperty({ required: false, description: "Edge length in kilometers." })
	length?: number;

	@ApiProperty({ required: false, description: "Index of the first shape point covered by this edge." })
	begin_shape_index?: number;

	@ApiProperty({ required: false, description: "Index of the last shape point covered by this edge." })
	end_shape_index?: number;
}

export class TraceAttributesResponseDto {
	@ApiProperty({ type: [TraceAttributesEdgeDto] })
	edges!: TraceAttributesEdgeDto[];

	@ApiProperty({
		required: false,
		description: "Polyline6-encoded matched shape returned by Valhalla.",
	})
	shape?: string;
}
