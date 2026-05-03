import { wrap } from "@mikro-orm/core";
import type { Route } from "../entities/route.entity";
import { toUserResponseDto } from "../users/user.mapper";
import type { RouteResponseDto } from "./dto/route-response.dto";

export function toRouteResponseDto(route: Route): RouteResponseDto {
	const serializedUser = wrap(route.user).toJSON() as {
		id: number;
		email: string;
		name: string;
		avatar?: string;
		isEmailVerified: boolean;
	};

	return {
		id: route.id,
		name: route.name,
		description: route.description,
		waypoints: route.waypoints,
		geometry: route.geometry,
		distance: route.distance,
		duration: route.duration,
		elevationGain: route.elevationGain,
		startAddress: route.startAddress,
		endAddress: route.endAddress,
		user: toUserResponseDto(serializedUser),
		createdAt: route.createdAt.toISOString(),
		updatedAt: route.updatedAt.toISOString(),
	};
}
