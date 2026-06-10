import { EntityManager, EntityRepository, type FilterQuery, QueryOrder } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { isRouteIndexable, pathIntersectsBbox, routeBoundingBox } from "@routess/core";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import { ExternalRoutesService } from "../external-routes/external-routes.service";
import { PlacesService } from "../places/places.service";
import {
	ROUTE_CREATED,
	ROUTE_DELETED,
	type RouteCreatedEvent,
	type RouteDeletedEvent,
} from "../telemetry/domain-events";
import type { CreateRouteDto } from "./dto/create-route.dto";
import type { PublicRouteSummaryDto } from "./dto/public-route-summary.dto";
import {
	type PublicListingFilters,
	type PublicRoutesQueryDto,
	parseBbox,
	publicListingWhere,
} from "./dto/public-routes-query.dto";
import type { RouteResponseDto } from "./dto/route-response.dto";
import type { UpdateRouteDto } from "./dto/update-route.dto";
import { toPublicRouteSummaryDto, toRouteResponseDto } from "./route.mapper";
import { SurfaceCompositionService } from "./surface-composition.service";

@Injectable()
export class RoutesService {
	constructor(
		@InjectRepository(Route)
		private readonly routeRepository: EntityRepository<Route>,
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
		private readonly em: EntityManager,
		private readonly events: EventEmitter2,
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
		private readonly places: PlacesService,
		private readonly surfaces: SurfaceCompositionService,
		private readonly externalRoutes: ExternalRoutesService,
	) {}

	private toResponseDto(route: Route): RouteResponseDto {
		return toRouteResponseDto(route, this.config.analytics.salt);
	}

	// Recomputes the persisted bbox (ADR 0030) from the route's geometry,
	// falling back to waypoint coords for direct-only routes.
	private applyBbox(route: Route): void {
		const coords = route.geometry?.length ? route.geometry : route.waypoints.map((w) => w.coord);
		const box = routeBoundingBox(coords);
		route.bboxMinLat = box?.minLat;
		route.bboxMaxLat = box?.maxLat;
		route.bboxMinLng = box?.minLng;
		route.bboxMaxLng = box?.maxLng;
	}

	async create(createRouteDto: CreateRouteDto, userId: number): Promise<RouteResponseDto> {
		const owner = await this.userRepository.findOneOrFail({ id: userId });
		const ownerDefault = owner.preferences?.defaultRouteVisibility ?? "private";
		const route = this.routeRepository.create({
			...createRouteDto,
			visibility: createRouteDto.visibility ?? ownerDefault,
			tags: createRouteDto.tags ?? [],
			favourite: createRouteDto.favourite ?? false,
			provenance: createRouteDto.provenance ?? "valhalla",
			user: userId,
		});
		if (route.visibility === "public") {
			route.publishedAt = new Date();
		}
		this.applyBbox(route);
		await this.em.persist(route).flush();
		await this.em.populate(route, ["user"]);
		this.events.emit(ROUTE_CREATED, { userId } satisfies RouteCreatedEvent);
		// Fire-and-forget: Place is async and fail-open (CONTEXT.md "Place").
		void this.places.derivePlaceForRoute(route.id);
		// Same pattern for the persisted surface composition (ADR 0032).
		void this.surfaces.deriveForRoute(route.id);
		return this.toResponseDto(route);
	}

	async findAll(userId: number, limit: number, offset: number): Promise<{ items: RouteResponseDto[]; total: number }> {
		const [routes, total] = await this.routeRepository.findAndCount(
			{ user: userId },
			{ populate: ["user"], orderBy: { createdAt: "DESC" }, limit, offset },
		);
		return { items: routes.map((route) => this.toResponseDto(route)), total };
	}

	// findOne (by numeric id): owners see their route regardless of visibility;
	// non-owners only see 'public'. Unlisted routes are NOT served by id — ids
	// are sequential and enumerable, which would defeat the "only people with
	// the link" tier; unlisted access goes through findOneByShareToken instead.
	// Everything else 404s (never 403, to avoid leaking existence).
	async findOne(id: number, viewerId: number | null): Promise<RouteResponseDto> {
		const route = await this.routeRepository.findOne({ id }, { populate: ["user"] });
		if (!route) {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		const ownerId = (route.user as unknown as User).id;
		const isOwner = viewerId !== null && ownerId === viewerId;
		if (!isOwner && route.visibility !== "public") {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		return this.toResponseDto(route);
	}

	// Share-link lookup: serves public and unlisted routes to anyone holding
	// the unguessable token. Private routes 404 even with the token (revoking
	// a share is as simple as flipping the route back to private).
	async findOneByShareToken(shareToken: string): Promise<RouteResponseDto> {
		const route = await this.routeRepository.findOne({ shareToken }, { populate: ["user"] });
		if (!route || route.visibility === "private") {
			throw new NotFoundException("Route not found");
		}
		return this.toResponseDto(route);
	}

	// Public route listing behind two gates (CONTEXT.md "Discover"):
	// - indexable: the SEO surface (landing sitemap, future RegionalHubs).
	//   SQL prefilters the cheap conditions; the canonical gate
	//   (isRouteIndexable in @routess/core) decides, so landing and API can
	//   never disagree. The in-memory window is acceptable while the
	//   indexable corpus is small.
	// - public: the in-app Discover surface. Every public Route qualifies;
	//   ordered by PublishedAt (the domain's discovery ordering), with
	//   downsampled geometry for map previews.
	async findPublicListing(
		query: PublicRoutesQueryDto,
		limit: number,
		offset: number,
	): Promise<{ items: PublicRouteSummaryDto[]; total: number }> {
		const gate = query.gate ?? "indexable";
		const filters: PublicListingFilters = {
			activity: query.activity,
			placeCity: query.placeCity,
			minDistance: query.minDistance,
			maxDistance: query.maxDistance,
			bbox: query.bbox ? parseBbox(query.bbox) : undefined,
		};
		const where = { visibility: "public", ...publicListingWhere(filters, gate) } as FilterQuery<Route>;

		// The seeded ExternalRoute layer is unioned in at read time (the ODbL
		// "Produced Work", ADR 0033). We fetch a window of `offset + limit` from
		// each source, merge, sort, and slice, since the two tables are wholly
		// independent and cannot be joined in SQL. Fine at our volumes.
		const take = offset + limit;

		if (gate === "public") {
			// Fetch beyond the page so the exact path-in-viewport filter below
			// can drop bbox false positives without under-filling the page.
			const window = take * 2;
			const [routes, routeTotal] = await this.routeRepository.findAndCount(where, {
				populate: ["user"],
				orderBy: { publishedAt: QueryOrder.DESC_NULLS_LAST, id: "DESC" },
				limit: window,
			});
			const routeItems = routes.map((route) =>
				toPublicRouteSummaryDto(route, this.config.analytics.salt, { includeGeometry: true }),
			);
			const external = await this.externalRoutes.findPublicMatches(filters, "public", window);
			// The bbox columns over-match long routes whose box overlaps the
			// viewport while the path runs elsewhere (ADR 0030); Discover renders
			// the result, so apply the exact check on the downsampled geometry.
			const view = filters.bbox;
			const inView = (item: PublicRouteSummaryDto) =>
				!view || !item.geometry || item.geometry.length < 2 || pathIntersectsBbox(item.geometry, view);
			const merged = mergeSummariesDesc(routeItems.filter(inView), external.items.filter(inView), publicSortKey).slice(
				offset,
				offset + limit,
			);
			return { items: merged, total: routeTotal + external.total };
		}

		const candidates = await this.routeRepository.find(where, {
			populate: ["user"],
			orderBy: { updatedAt: "DESC" },
			limit: 5000,
		});
		const indexableRoutes = candidates.filter((route) => isRouteIndexable(route));
		const routeItems = indexableRoutes
			.slice(0, take)
			.map((route) => toPublicRouteSummaryDto(route, this.config.analytics.salt, { includeGeometry: false }));
		const external = await this.externalRoutes.findPublicMatches(filters, "indexable", take);
		const merged = mergeSummariesDesc(routeItems, external.items, indexableSortKey).slice(offset, offset + limit);
		return { items: merged, total: indexableRoutes.length + external.total };
	}

	// Public-only listing for someone else's library. Excludes 'private' and
	// 'unlisted' so that "browse Alice's routes" only surfaces Routes she has
	// explicitly marked discoverable.
	async findPublicByOwner(ownerId: number): Promise<RouteResponseDto[]> {
		const routes = await this.routeRepository.find(
			{ user: ownerId, visibility: "public" },
			{ populate: ["user"], orderBy: { createdAt: "DESC" }, limit: 100 },
		);
		return routes.map((r) => this.toResponseDto(r));
	}

	async update(id: number, updateRouteDto: UpdateRouteDto, userId: number): Promise<RouteResponseDto> {
		const route = await this.findOwnedRouteOrFail(id, userId);
		const previousStart = (route.geometry?.[0] ?? route.waypoints[0]?.coord)?.join(",");
		this.routeRepository.assign(route, updateRouteDto);
		// PublishedAt: stamped on the first transition to public, never bumped
		// afterward — re-publishing restores feed position (CONTEXT.md).
		if (route.visibility === "public" && !route.publishedAt) {
			route.publishedAt = new Date();
		}
		const geometryChanged = updateRouteDto.geometry !== undefined || updateRouteDto.waypoints !== undefined;
		if (geometryChanged) {
			this.applyBbox(route);
			// Stale composition must never render against new geometry; the
			// async derivation below repopulates it.
			route.surfaceComposition = null;
		}
		await this.em.persist(route).flush();
		await this.em.populate(route, ["user"]);
		const newStart = (route.geometry?.[0] ?? route.waypoints[0]?.coord)?.join(",");
		if (!route.placeCity || newStart !== previousStart) {
			void this.places.derivePlaceForRoute(route.id);
		}
		if (geometryChanged || !route.surfaceComposition) {
			void this.surfaces.deriveForRoute(route.id);
		}
		return this.toResponseDto(route);
	}

	async remove(id: number, userId: number): Promise<void> {
		const route = await this.findOwnedRouteOrFail(id, userId);
		route.deletedAt = new Date();
		await this.em.persist(route).flush();
		this.events.emit(ROUTE_DELETED, { userId } satisfies RouteDeletedEvent);
	}

	// Same visibility semantics as findOne: ids serve owners and public routes;
	// unlisted GPX downloads go through the share token.
	async findForGpx(id: number, viewerId: number | null): Promise<Route> {
		const route = await this.routeRepository.findOne({ id });
		if (!route) {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		const ownerId = (route.user as unknown as { id: number }).id;
		const isOwner = viewerId !== null && ownerId === viewerId;
		if (!isOwner && route.visibility !== "public") {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		return route;
	}

	async findForGpxByShareToken(shareToken: string): Promise<Route> {
		const route = await this.routeRepository.findOne({ shareToken });
		if (!route || route.visibility === "private") {
			throw new NotFoundException("Route not found");
		}
		return route;
	}

	async hardDelete(id: number, userId: number): Promise<void> {
		const route = await this.routeRepository.findOne({ id, user: userId }, { filters: { softDelete: false } });
		if (!route) {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		await this.em.remove(route).flush();
	}

	private async findOwnedRouteOrFail(id: number, userId: number): Promise<Route> {
		const route = await this.routeRepository.findOne({ id, user: userId }, { populate: ["user"] });
		if (!route) {
			throw new NotFoundException(`Route with ID ${id} not found`);
		}
		return route;
	}
}

// Discover orders by PublishedAt; ExternalRoutes have none, so they fall back
// to updatedAt (their import/refresh time). The merge of the two pre-sorted
// windows is stable for the union (ADR 0033).
function publicSortKey(summary: PublicRouteSummaryDto): number {
	const stamp = summary.publishedAt ?? summary.updatedAt;
	return stamp ? Date.parse(stamp) : 0;
}

// The indexable (SEO) surface orders by most-recently-updated for both kinds.
function indexableSortKey(summary: PublicRouteSummaryDto): number {
	return summary.updatedAt ? Date.parse(summary.updatedAt) : 0;
}

function mergeSummariesDesc(
	a: PublicRouteSummaryDto[],
	b: PublicRouteSummaryDto[],
	keyFn: (s: PublicRouteSummaryDto) => number,
): PublicRouteSummaryDto[] {
	return [...a, ...b].sort((x, y) => keyFn(y) - keyFn(x));
}
