import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PublicRouteSummaryDto {
	@ApiProperty()
	id!: number;

	@ApiProperty()
	name!: string;

	@ApiPropertyOptional({ description: "Distance in meters" })
	distance?: number;

	@ApiProperty()
	updatedAt!: string;
}
