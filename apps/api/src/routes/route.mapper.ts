import { wrap } from "@mikro-orm/core";
import type { Route } from "../entities/route.entity";
import type { User } from "../entities/user.entity";
import { toUserResponseDto } from "../users/user.mapper";
import type { RouteResponseDto } from "./dto/route-response.dto";

type SerializableUser = Pick<
	User,
	| "id"
	| "email"
	| "name"
	| "avatar"
	| "isEmailVerified"
	| "role"
	| "preferences"
	| "deletionStatus"
	| "deletionRequestedAt"
>;

export function toRouteResponseDto(route: Route, analyticsSalt: string): RouteResponseDto {
	const serializedUser = wrap(route.user).toJSON() as SerializableUser;
	return {
		id: route.id,
		name: route.name,
		description: route.description,
		activity: route.activity,
		visibility: route.visibility,
		tags: route.tags,
		favourite: route.favourite,
		waypoints: route.waypoints,
		geometry: route.geometry,
		distance: route.distance,
		duration: route.duration,
		elevationGain: route.elevationGain,
		startAddress: route.startAddress,
		endAddress: route.endAddress,
		routingPreferences: route.routingPreferences ?? null,
		provenance: route.provenance,
		user: toUserResponseDto(serializedUser, analyticsSalt),
		createdAt: route.createdAt.toISOString(),
		updatedAt: route.updatedAt.toISOString(),
	};
}
