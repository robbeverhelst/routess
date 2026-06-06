import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ROUTE_VISIBILITIES, type RouteVisibility } from "@routess/core";
import { RouteResponseDto } from "../../routes/dto/route-response.dto";
import { PublicUserDto } from "../../users/dto/user-response.dto";

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

	@ApiProperty({
		description:
			"Unguessable 32-hex handle for share links. Unlisted collections are only reachable anonymously via this token.",
		example: "9f86d081884c7d659a2feaa0c55ad015",
	})
	shareToken!: string;

	@ApiProperty({ type: PublicUserDto })
	user!: PublicUserDto;

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
