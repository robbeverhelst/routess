import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Injectable, NotFoundException } from "@nestjs/common";
import { buildRouteSlugId, INDEXABLE_MIN_DISTANCE_METERS, isRouteIndexable } from "@routess/core";
import { Follow } from "../entities/follow.entity";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import type { ProfileResponseDto, ProfileRouteDto } from "./dto/profile-response.dto";

const PROFILE_ROUTE_LIMIT = 50;
// A Profile is Indexable when it has at least this many Indexable Routes
// (CONTEXT.md "Indexable"; thin-content rule).
export const PROFILE_INDEXABLE_MIN_ROUTES = 3;

@Injectable()
export class ProfilesService {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
		@InjectRepository(Route)
		private readonly routeRepository: EntityRepository<Route>,
		@InjectRepository(Follow)
		private readonly followRepository: EntityRepository<Follow>,
		private readonly em: EntityManager,
	) {}

	async findByHandle(handle: string, viewerId: number | null): Promise<ProfileResponseDto> {
		const user = await this.userRepository.findOne({ handle });
		if (!user) {
			throw new NotFoundException(`Profile @${handle} not found`);
		}

		const publicRoutes = await this.routeRepository.find(
			{ user: user.id, visibility: "public" },
			// id tiebreaker: publishedAt ties (backfill, bulk publishes) would
			// otherwise make paging skip or repeat routes.
			{ orderBy: { publishedAt: "desc nulls last", id: "DESC" }, limit: PROFILE_ROUTE_LIMIT },
		);
		// Stats over public Routes only (CONTEXT.md "Profile"): aggregated in
		// SQL so they stay correct beyond the listing window.
		const [statsRows, followers, following] = await Promise.all([
			this.em.getConnection().execute(
				`select count(*)::int as count,
					coalesce(sum("distance"), 0)::float as distance,
					coalesce(sum("elevation_gain"), 0)::float as elevation
				from "route"
				where "user_id" = ? and "visibility" = 'public' and "deleted_at" is null`,
				[user.id],
			) as Promise<Array<{ count: number; distance: number; elevation: number }>>,
			this.followRepository.count({ followee: user.id }),
			this.followRepository.count({ follower: user.id }),
		]);
		const stats = statsRows[0] ?? { count: 0, distance: 0, elevation: 0 };
		// null for anonymous viewers and for the owner (no self-follow).
		const isFollowing =
			viewerId === null || viewerId === user.id
				? null
				: (await this.followRepository.count({ follower: viewerId, followee: user.id })) > 0;

		// Indexable Profile gate (CONTEXT.md): >= 3 Indexable Routes. Counted
		// over all public routes, not the listing window, so the page's
		// noindex decision matches the sitemap gate (findIndexable).
		const indexableCandidates = await this.routeRepository.find(
			{ user: user.id, visibility: "public", distance: { $gte: INDEXABLE_MIN_DISTANCE_METERS } },
			{ fields: ["id", "name", "distance", "description", "tags", "visibility"] },
		);
		const indexableCount = indexableCandidates.filter((r) => isRouteIndexable(r)).length;

		return {
			handle: user.handle,
			name: user.name,
			avatar: user.avatar ?? null,
			stats: {
				publicRoutes: stats.count,
				totalDistance: Math.round(stats.distance),
				totalElevationGain: Math.round(stats.elevation),
				followers,
				following,
			},
			isFollowing,
			isIndexable: indexableCount >= PROFILE_INDEXABLE_MIN_ROUTES,
			routes: publicRoutes.map((r) => toProfileRouteDto(r)),
		};
	}

	// Indexable Profiles for the landing sitemap: same in-memory gate strategy
	// as RoutesService.findIndexablePublic, grouped per owner.
	async findIndexable(): Promise<Array<{ handle: string; updatedAt: string }>> {
		const candidates = await this.routeRepository.find(
			{ visibility: "public", distance: { $gte: INDEXABLE_MIN_DISTANCE_METERS } },
			{
				fields: ["id", "name", "distance", "description", "tags", "visibility", "updatedAt", "user"],
				orderBy: { updatedAt: "DESC" },
				limit: 5000,
			},
		);
		const byOwner = new Map<number, { count: number; updatedAt: Date }>();
		for (const route of candidates) {
			if (!isRouteIndexable(route)) continue;
			const ownerId = route.user.id;
			const entry = byOwner.get(ownerId);
			if (entry) {
				entry.count += 1;
			} else {
				byOwner.set(ownerId, { count: 1, updatedAt: route.updatedAt });
			}
		}
		const ownerIds = [...byOwner.entries()]
			.filter(([, v]) => v.count >= PROFILE_INDEXABLE_MIN_ROUTES)
			.map(([id]) => id);
		if (ownerIds.length === 0) return [];
		const users = await this.userRepository.find({ id: { $in: ownerIds } }, { fields: ["id", "handle"] });
		return users.map((u) => {
			const entry = byOwner.get(u.id);
			const updatedAt = entry?.updatedAt instanceof Date ? entry.updatedAt.toISOString() : new Date().toISOString();
			return { handle: u.handle, updatedAt };
		});
	}
}

export function toProfileRouteDto(route: Route): ProfileRouteDto {
	return {
		id: route.id,
		// Canonical share path segment: public routes use the SEO-friendly id
		// form; unlisted ones the unguessable token (ids 404 for non-owners).
		slugId: buildRouteSlugId(route.name, route.visibility === "public" ? route.id : route.shareToken),
		name: route.name,
		activity: route.activity ?? null,
		distance: route.distance ?? null,
		duration: route.duration ?? null,
		elevationGain: route.elevationGain ?? null,
		publishedAt: route.publishedAt ? route.publishedAt.toISOString() : null,
		tags: route.tags,
	};
}
