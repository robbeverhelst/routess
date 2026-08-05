import { buildExternalRouteSlugId, downsampleCoordinates } from "@routess/core";
import type { ExternalRoute } from "../entities/external-route.entity";
import type { SeedSource } from "../entities/seed-source.entity";
import {
	PUBLIC_SUMMARY_GEOMETRY_MAX_POINTS,
	type PublicRouteSourceDto,
	type PublicRouteSummaryDto,
} from "../routes/dto/public-route-summary.dto";
import type { ExternalRouteResponseDto } from "./dto/external-route-response.dto";

// The listing surfaces load a column projection rather than the whole entity
// (#354); geometry is only selected for Discover. A full ExternalRoute still
// satisfies this.
export type ExternalRouteSummarySource = Pick<
	ExternalRoute,
	| "id"
	| "name"
	| "distance"
	| "updatedAt"
	| "activity"
	| "elevationGain"
	| "tags"
	| "placeCity"
	| "placeRegion"
	| "placeCountryCode"
	| "source"
> & { geometry?: [number, number][] };

// `route.source` must be populated by the caller before mapping.
function sourceDto(route: Pick<ExternalRoute, "source">): PublicRouteSourceDto {
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
// the render-time combination, ADR 0035). Distinguished only by `source` being
// set and `user` absent. publishedAt is left undefined; external routes sort by
// updatedAt (import/refresh time) in the merge.
export function toExternalRouteSummaryDto(
	route: ExternalRouteSummarySource,
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
