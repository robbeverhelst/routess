import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ROUTE_VISIBILITIES, type RouteVisibility } from "@routess/core";
import { RouteResponseDto } from "../../routes/dto/route-response.dto";
import { UserResponseDto } from "../../users/dto/user-response.dto";

export class CollectionResponseDto {
	@ApiProperty()
	id!: number;

	@ApiProperty()
	name!: string;

	@ApiPropertyOptional()
	description?: string;

	@ApiProperty({ enum: ROUTE_VISIBILITIES })
	visibility!: RouteVisibility;

	@ApiProperty({
		description: "Ordered route IDs in this collection. For non-owners, private routes are omitted.",
		type: [Number],
	})
	routeIds!: number[];

	@ApiProperty({ description: "Number of routes in the collection (after visibility filtering)" })
	routeCount!: number;

	@ApiProperty({ type: UserResponseDto })
	user!: UserResponseDto;

	@ApiProperty()
	createdAt!: string;

	@ApiProperty()
	updatedAt!: string;
}

export class CollectionDetailResponseDto extends CollectionResponseDto {
	@ApiProperty({
		description: "Ordered routes in this collection. For non-owners, private routes are omitted.",
		type: [RouteResponseDto],
	})
	routes!: RouteResponseDto[];
}
