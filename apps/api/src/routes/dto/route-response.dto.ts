import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserResponseDto } from "../../users/dto/user-response.dto";

class WaypointResponseDto {
	@ApiProperty()
	lat!: number;

	@ApiProperty()
	lng!: number;

	@ApiPropertyOptional({
		enum: ["routed", "direct"],
	})
	type?: "routed" | "direct";

	@ApiPropertyOptional()
	timestamp?: string;
}

export class RouteResponseDto {
	@ApiProperty()
	id!: number;

	@ApiProperty()
	name!: string;

	@ApiPropertyOptional()
	description?: string;

	@ApiProperty({
		type: [WaypointResponseDto],
	})
	waypoints!: WaypointResponseDto[];

	@ApiPropertyOptional({
		description: "Routed polyline as an array of [lng, lat] coordinate pairs",
	})
	geometry?: [number, number][];

	@ApiPropertyOptional({
		description: "Distance in meters",
	})
	distance?: number;

	@ApiPropertyOptional({
		description: "Duration in seconds",
	})
	duration?: number;

	@ApiPropertyOptional({
		description: "Elevation gain in meters",
	})
	elevationGain?: number;

	@ApiPropertyOptional()
	startAddress?: string;

	@ApiPropertyOptional()
	endAddress?: string;

	@ApiProperty({
		type: UserResponseDto,
	})
	user!: UserResponseDto;

	@ApiProperty()
	createdAt!: string;

	@ApiProperty()
	updatedAt!: string;
}
