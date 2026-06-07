import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from "class-validator";
import { TraceShapePointDto } from "./trace-attributes.dto";

const MAX_HEIGHT_POINTS = 512;

export class HeightRequestDto {
	@ApiProperty({
		description: `Coordinates to sample elevation for, in order. Capped at ${MAX_HEIGHT_POINTS} points; callers densify/downsample client-side.`,
		type: [TraceShapePointDto],
		minItems: 1,
		maxItems: MAX_HEIGHT_POINTS,
	})
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(MAX_HEIGHT_POINTS)
	@ValidateNested({ each: true })
	@Type(() => TraceShapePointDto)
	shape!: TraceShapePointDto[];
}

export class HeightResponseDto {
	@ApiProperty({
		description: "Elevation in meters per input point, in order. Null where the DEM has no data (e.g. open water).",
		type: "array",
		items: { type: "number", nullable: true },
	})
	heights!: (number | null)[];
}
