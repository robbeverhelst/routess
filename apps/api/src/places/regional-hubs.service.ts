import type { EntityRepository, FilterQuery } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Injectable } from "@nestjs/common";
import {
	INDEXABLE_MIN_DISTANCE_METERS,
	isRouteIndexable,
	REGIONAL_HUB_MIN_INDEXABLE_ROUTES,
	type RouteActivity,
	toRouteSlug,
} from "@routess/core";
import { ExternalRoute } from "../entities/external-route.entity";
import { Route } from "../entities/route.entity";
import type { RegionalHubDto } from "./dto/regional-hub.dto";

interface HubCandidate {
	name: string;
	distance?: number;
	description?: string;
	tags: string[];
	placeCity?: string;
	placeRegion?: string;
	placeCountryCode?: string;
	updatedAt: Date;
}

interface HubAccumulator {
	city: string;
	region?: string;
	countryCode?: string;
	count: number;
	lastModified: Date;
}

// RegionalHub aggregation (CONTEXT.md "RegionalHub"): groups Indexable routes
// by their Place's city slug for one activity and keeps only places clearing
// the 5-route threshold. Routes and ExternalRoutes are unioned at read time
// only (ADR 0035); the canonical gate (isRouteIndexable) decides in memory
// over SQL-prefiltered candidates, same as the public listing.
@Injectable()
export class RegionalHubsService {
	constructor(
		@InjectRepository(Route)
		private readonly routeRepository: EntityRepository<Route>,
		@InjectRepository(ExternalRoute)
		private readonly externalRouteRepository: EntityRepository<ExternalRoute>,
	) {}

	async findHubs(activity: RouteActivity): Promise<RegionalHubDto[]> {
		const prefilter = {
			activity,
			placeCity: { $ne: null },
			distance: { $gte: INDEXABLE_MIN_DISTANCE_METERS },
		};
		const fields = [
			"name",
			"distance",
			"description",
			"tags",
			"placeCity",
			"placeRegion",
			"placeCountryCode",
			"updatedAt",
		] as const;
		// The in-memory window is acceptable while the indexable corpus is
		// small, matching findPublicListing's gate=indexable path.
		const [routes, externals] = await Promise.all([
			this.routeRepository.find({ ...prefilter, visibility: "public" } as FilterQuery<Route>, {
				fields: [...fields, "visibility"],
				limit: 5000,
			}),
			this.externalRouteRepository.find(prefilter as FilterQuery<ExternalRoute>, { fields, limit: 5000 }),
		]);

		const hubs = new Map<string, HubAccumulator>();
		const accumulate = (candidate: HubCandidate) => {
			if (!candidate.placeCity) return;
			if (!isRouteIndexable({ visibility: "public", ...candidate })) return;
			const slug = toRouteSlug(candidate.placeCity);
			if (!slug) return;
			const entry = hubs.get(slug);
			if (!entry) {
				hubs.set(slug, {
					city: candidate.placeCity,
					region: candidate.placeRegion,
					countryCode: candidate.placeCountryCode,
					count: 1,
					lastModified: candidate.updatedAt,
				});
				return;
			}
			entry.count += 1;
			entry.region ??= candidate.placeRegion;
			entry.countryCode ??= candidate.placeCountryCode;
			if (candidate.updatedAt > entry.lastModified) entry.lastModified = candidate.updatedAt;
		};

		for (const route of routes) accumulate(route as HubCandidate);
		for (const external of externals) accumulate(external as HubCandidate);

		return [...hubs.entries()]
			.filter(([, hub]) => hub.count >= REGIONAL_HUB_MIN_INDEXABLE_ROUTES)
			.sort(([, a], [, b]) => b.count - a.count || a.city.localeCompare(b.city))
			.map(([slug, hub]) => ({
				slug,
				city: hub.city,
				region: hub.region,
				countryCode: hub.countryCode,
				activity,
				indexableCount: hub.count,
				lastModified: hub.lastModified.toISOString(),
			}));
	}
}
