import { buildExternalRouteSlugId, downsampleCoordinates } from "@routess/core";
import type { ExternalRoute } from "../entities/external-route.entity";
import type { SeedSource } from "../entities/seed-source.entity";
import type { PublicRouteSourceDto, PublicRouteSummaryDto } from "../routes/dto/public-route-summary.dto";
import { PUBLIC_SUMMARY_GEOMETRY_MAX_POINTS } from "../routes/route.mapper";
import type { ExternalRouteResponseDto } from "./dto/external-route-response.dto";

// `route.source` must be populated by the caller before mapping.
function sourceDto(route: ExternalRoute): PublicRouteSourceDto {
	const source = route.source as unknown as SeedSource;
	return {
		key: source.key,
		name: source.displayName,
		license: source.license,
		attribution: source.attribution,
		url: source.sourceUrl,
	};
}

// Maps an ExternalRoute into the SAME summary shape as a user Route, so the
// Discover/listing union is one homogeneous list (the ODbL "Produced Work" is
// the render-time combination, ADR 0033). Distinguished only by `source` being
// set and `user` absent. publishedAt is left undefined; external routes sort by
// updatedAt (import/refresh time) in the merge.
export function toExternalRouteSummaryDto(
	route: ExternalRoute,
	options: { includeGeometry: boolean },
): PublicRouteSummaryDto {
	return {
		id: route.id,
		name: route.name,
		distance: route.distance,
		updatedAt: route.updatedAt.toISOString(),
		slugId: buildExternalRouteSlugId(route.name, route.id),
		activity: route.activity,
		elevationGain: route.elevationGain,
		tags: route.tags,
		placeCity: route.placeCity,
		placeRegion: route.placeRegion,
		placeCountryCode: route.placeCountryCode,
		geometry:
			options.includeGeometry && route.geometry?.length
				? downsampleCoordinates(route.geometry, PUBLIC_SUMMARY_GEOMETRY_MAX_POINTS)
				: undefined,
		source: sourceDto(route),
	};
}

export function toExternalRouteResponseDto(route: ExternalRoute): ExternalRouteResponseDto {
	return {
		id: route.id,
		slugId: buildExternalRouteSlugId(route.name, route.id),
		name: route.name,
		description: route.description,
		activity: route.activity,
		tags: route.tags,
		geometry: route.geometry,
		distance: route.distance,
		duration: route.duration,
		elevationGain: route.elevationGain,
		placeCity: route.placeCity,
		placeRegion: route.placeRegion,
		placeCountryCode: route.placeCountryCode,
		source: sourceDto(route),
		kind: "external",
		updatedAt: route.updatedAt.toISOString(),
	};
}
