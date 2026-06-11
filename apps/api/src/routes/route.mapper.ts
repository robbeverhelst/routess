import { wrap } from "@mikro-orm/core";
import { buildRouteSlugId, downsampleCoordinates } from "@routess/core";
import type { Route } from "../entities/route.entity";
import type { User } from "../entities/user.entity";
import { toPublicUserDto } from "../users/user.mapper";
import { PUBLIC_SUMMARY_GEOMETRY_MAX_POINTS, type PublicRouteSummaryDto } from "./dto/public-route-summary.dto";
import type { RouteResponseDto } from "./dto/route-response.dto";

// Routes can be served to non-owners (public/unlisted), so the embedded
// owner is the PII-free public shape. The Handle is part of that shape by
// design: it is the Profile's public address (CONTEXT.md "Handle").
type SerializableUser = Pick<User, "id" | "name" | "handle" | "avatar">;

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
		placeCity: route.placeCity,
		placeRegion: route.placeRegion,
		placeCountryCode: route.placeCountryCode,
		routingPreferences: route.routingPreferences ?? null,
		surfaceComposition: route.surfaceComposition ?? null,
		provenance: route.provenance,
		shareToken: route.shareToken,
		user: toPublicUserDto(serializedUser, analyticsSalt),
		createdAt: route.createdAt.toISOString(),
		updatedAt: route.updatedAt.toISOString(),
	};
}

export function toPublicRouteSummaryDto(
	route: Route,
	analyticsSalt: string,
	options: { includeGeometry: boolean },
): PublicRouteSummaryDto {
	const serializedUser = wrap(route.user).toJSON() as SerializableUser;
	return {
		id: route.id,
		name: route.name,
		distance: route.distance,
		updatedAt: route.updatedAt.toISOString(),
		// Listing only ever serves public routes, so the id form is correct.
		slugId: buildRouteSlugId(route.name, route.id),
		activity: route.activity,
		elevationGain: route.elevationGain,
		tags: route.tags,
		publishedAt: route.publishedAt?.toISOString(),
		placeCity: route.placeCity,
		placeRegion: route.placeRegion,
		placeCountryCode: route.placeCountryCode,
		geometry:
			options.includeGeometry && route.geometry?.length
				? downsampleCoordinates(route.geometry, PUBLIC_SUMMARY_GEOMETRY_MAX_POINTS)
				: undefined,
		user: toPublicUserDto(serializedUser, analyticsSalt),
	};
}
