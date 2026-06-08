import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, Max, Min } from "class-validator";

export class NodeNetworkQueryDto {
	@ApiProperty({ description: "Southern bbox edge in WGS84 degrees", example: 51.0 })
	@Type(() => Number)
	@IsNumber()
	@Min(-90)
	@Max(90)
	south!: number;

	@ApiProperty({ description: "Western bbox edge in WGS84 degrees", example: 3.5 })
	@Type(() => Number)
	@IsNumber()
	@Min(-180)
	@Max(180)
	west!: number;

	@ApiProperty({ description: "Northern bbox edge in WGS84 degrees", example: 51.2 })
	@Type(() => Number)
	@IsNumber()
	@Min(-90)
	@Max(90)
	north!: number;

	@ApiProperty({ description: "Eastern bbox edge in WGS84 degrees", example: 4.0 })
	@Type(() => Number)
	@IsNumber()
	@Min(-180)
	@Max(180)
	east!: number;
}
