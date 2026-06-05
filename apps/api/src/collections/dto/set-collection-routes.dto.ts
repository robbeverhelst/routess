import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsInt } from "class-validator";

export const MAX_COLLECTION_ROUTES = 200;

export class SetCollectionRoutesDto {
	@ApiProperty({
		description:
			"Full ordered membership of the collection. Replaces the existing membership; order defines the position of each route.",
		type: [Number],
		example: [12, 7, 31],
	})
	@IsArray()
	@IsInt({ each: true })
	@ArrayMaxSize(MAX_COLLECTION_ROUTES)
	routeIds!: number[];
}
