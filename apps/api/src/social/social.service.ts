import { EntityManager, EntityRepository, UniqueConstraintViolationException } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { buildRouteSlugId, normalizeUserPreferences } from "@routess/core";
import { DomainException } from "../common/exceptions/domain.exception";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { EmailService } from "../email/email.service";
import { Follow } from "../entities/follow.entity";
import { Route } from "../entities/route.entity";
import { RouteShare } from "../entities/route-share.entity";
import { User } from "../entities/user.entity";
import type { ProfileSummaryDto } from "../profiles/dto/profile-response.dto";
import { toProfileRouteDto } from "../profiles/profiles.service";
import type { RouteResponseDto } from "../routes/dto/route-response.dto";
import { toRouteResponseDto } from "../routes/route.mapper";
import type { FeedItemDto } from "./dto/feed-item.dto";
import type { FollowsResponseDto } from "./dto/follows-response.dto";
import type { NotificationItemDto, NotificationsResponseDto } from "./dto/notification-response.dto";
import type { RouteShareResponseDto } from "./dto/route-share-response.dto";

const INBOX_LIMIT = 100;
const SEARCH_LIMIT = 10;
const NOTIFICATIONS_LIMIT = 50;
// One share email per sender→recipient pair per hour; further shares land
// silently in the inbox (CONTEXT.md "RouteShare").
const SHARE_EMAIL_RATE_WINDOW_MS = 60 * 60 * 1000;

function toProfileSummary(user: User): ProfileSummaryDto {
	return { handle: user.handle, name: user.name, avatar: user.avatar ?? null };
}

@Injectable()
export class SocialService {
	private readonly logger = new Logger(SocialService.name);

	constructor(
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
		@InjectRepository(Route)
		private readonly routeRepository: EntityRepository<Route>,
		@InjectRepository(Follow)
		private readonly followRepository: EntityRepository<Follow>,
		@InjectRepository(RouteShare)
		private readonly shareRepository: EntityRepository<RouteShare>,
		private readonly em: EntityManager,
		private readonly emailService: EmailService,
		@Inject(APP_CONFIG)
		private readonly config: AppConfig,
	) {}

	private async findUserByHandle(handle: string): Promise<User> {
		const user = await this.userRepository.findOne({ handle });
		if (!user) {
			throw new NotFoundException(`Profile @${handle} not found`);
		}
		return user;
	}

	// Asymmetric, no approval, grants nothing (CONTEXT.md "Follow", ADR 0027).
	// Idempotent: following an already-followed profile is a no-op.
	async follow(followerId: number, handle: string): Promise<void> {
		const target = await this.findUserByHandle(handle);
		if (target.id === followerId) {
			throw new BadRequestException("You cannot follow yourself");
		}
		const existing = await this.followRepository.findOne({ follower: followerId, followee: target.id });
		if (existing) return;
		try {
			const follow = this.followRepository.create({ follower: followerId, followee: target.id });
			await this.em.persist(follow).flush();
		} catch (error) {
			if (error instanceof UniqueConstraintViolationException) return;
			throw error;
		}
	}

	async unfollow(followerId: number, handle: string): Promise<void> {
		const target = await this.findUserByHandle(handle);
		const existing = await this.followRepository.findOne({ follower: followerId, followee: target.id });
		if (!existing) return;
		await this.em.remove(existing).flush();
	}

	// Owner-only lists; the public only ever sees counts on the Profile.
	async listFollows(userId: number): Promise<FollowsResponseDto> {
		const [following, followers] = await Promise.all([
			this.followRepository.find({ follower: userId }, { populate: ["followee"], orderBy: { createdAt: "DESC" } }),
			this.followRepository.find({ followee: userId }, { populate: ["follower"], orderBy: { createdAt: "DESC" } }),
		]);
		return {
			following: following.map((f) => toProfileSummary(f.followee)),
			followers: followers.map((f) => toProfileSummary(f.follower)),
		};
	}

	// The Feed is a derived view (CONTEXT.md "Feed"): public Routes of followed
	// Profiles ordered by publishedAt desc. Nothing is stored per follower, so
	// a Route flipped back to private vanishes from every feed instantly.
	async feed(userId: number, limit: number, offset: number): Promise<{ items: FeedItemDto[]; total: number }> {
		const follows = await this.followRepository.find({ follower: userId }, { fields: ["followee"] });
		const followeeIds = follows.map((f) => f.followee.id);
		if (followeeIds.length === 0) {
			return { items: [], total: 0 };
		}
		const [routes, total] = await this.routeRepository.findAndCount(
			{ user: { $in: followeeIds }, visibility: "public", publishedAt: { $ne: null } },
			// id tiebreaker: backfilled/bulk publishedAt values collide, and
			// offset paging over an unstable order skips or repeats routes.
			{ populate: ["user"], orderBy: { publishedAt: "desc nulls last", id: "DESC" }, limit, offset },
		);
		return {
			items: routes.map((route) => ({
				...toProfileRouteDto(route),
				author: toProfileSummary(route.user),
			})),
			total,
		};
	}

	// RouteShare (CONTEXT.md, ADR 0027): only unlisted/public Routes are
	// shareable. A private Route is rejected — for the owner with a coded 409
	// so the client can offer "make it unlisted", for anyone else with a 404
	// so existence doesn't leak.
	async createShare(
		senderId: number,
		routeId: number,
		recipientHandle: string,
		message?: string,
	): Promise<RouteShareResponseDto> {
		const route = await this.routeRepository.findOne({ id: routeId }, { populate: ["user"] });
		if (!route) {
			throw new NotFoundException(`Route with ID ${routeId} not found`);
		}
		const isOwner = route.user.id === senderId;
		if (route.visibility === "private") {
			if (!isOwner) {
				throw new NotFoundException(`Route with ID ${routeId} not found`);
			}
			throw new DomainException(409, "CONFLICT", "This route is private. Make it unlisted to share it.", {
				reason: "route_private",
			});
		}
		const recipient = await this.findUserByHandle(recipientHandle);
		if (recipient.id === senderId) {
			throw new BadRequestException("You cannot share a route with yourself");
		}
		const sender = await this.userRepository.findOneOrFail({ id: senderId });

		const share = this.shareRepository.create({
			sender: senderId,
			recipient: recipient.id,
			route: route.id,
			message: message || undefined,
		});
		await this.em.persist(share).flush();
		await this.maybeSendShareEmail(share, sender, recipient, route);

		return this.toShareDto(share, sender, route);
	}

	async inbox(userId: number): Promise<RouteShareResponseDto[]> {
		const shares = await this.shareRepository.find(
			{ recipient: userId },
			{ populate: ["sender"], orderBy: { createdAt: "DESC" }, limit: INBOX_LIMIT },
		);
		// Load routes through the repository (not relation populate) so the
		// soft-delete filter applies and visibility is re-checked per read:
		// the inbox entry is a live reference, never a stored copy.
		const routeIds = [...new Set(shares.map((s) => s.route.id))];
		const routes = routeIds.length
			? await this.routeRepository.find({ id: { $in: routeIds }, visibility: { $ne: "private" } })
			: [];
		const routeById = new Map(routes.map((r) => [r.id, r]));
		return shares.map((share) => this.toShareDto(share, share.sender, routeById.get(share.route.id) ?? null));
	}

	async unreadCount(userId: number): Promise<number> {
		return this.shareRepository.count({ recipient: userId, readAt: null });
	}

	async markRead(shareId: number, userId: number): Promise<void> {
		const share = await this.shareRepository.findOne({ id: shareId, recipient: userId });
		if (!share) {
			throw new NotFoundException(`Share with ID ${shareId} not found`);
		}
		if (!share.readAt) {
			share.readAt = new Date();
			await this.em.persist(share).flush();
		}
	}

	// Dismiss: the recipient removes the inbox entry. The share row goes away
	// entirely; the Route itself is untouched.
	async dismissShare(shareId: number, userId: number): Promise<void> {
		const share = await this.shareRepository.findOne({ id: shareId, recipient: userId });
		if (!share) {
			throw new NotFoundException(`Share with ID ${shareId} not found`);
		}
		await this.em.remove(share).flush();
	}

	// "Save a copy": clones the shared Route into the recipient's library. The
	// copy keeps the original's Provenance (it describes how the geometry was
	// made, not how it arrived) and records lineage via copiedFrom*.
	async copyShare(shareId: number, userId: number): Promise<RouteResponseDto> {
		const share = await this.shareRepository.findOne({ id: shareId, recipient: userId });
		if (!share) {
			throw new NotFoundException(`Share with ID ${shareId} not found`);
		}
		const source = await this.routeRepository.findOne({ id: share.route.id, visibility: { $ne: "private" } });
		if (!source) {
			throw new DomainException(409, "CONFLICT", "This route is no longer available", {
				reason: "route_unavailable",
			});
		}
		const copy = this.routeRepository.create({
			name: source.name,
			description: source.description,
			activity: source.activity,
			visibility: "private",
			tags: [...source.tags],
			favourite: false,
			waypoints: structuredClone(source.waypoints),
			geometry: source.geometry ? structuredClone(source.geometry) : undefined,
			distance: source.distance,
			duration: source.duration,
			elevationGain: source.elevationGain,
			bboxMinLat: source.bboxMinLat,
			bboxMaxLat: source.bboxMaxLat,
			bboxMinLng: source.bboxMinLng,
			bboxMaxLng: source.bboxMaxLng,
			placeCity: source.placeCity,
			placeRegion: source.placeRegion,
			placeCountryCode: source.placeCountryCode,
			startAddress: source.startAddress,
			endAddress: source.endAddress,
			routingPreferences: source.routingPreferences ?? null,
			provenance: source.provenance,
			copiedFromRouteId: source.id,
			copiedFromUserId: source.user.id,
			user: userId,
		});
		await this.em.persist(copy).flush();
		await this.em.populate(copy, ["user"]);
		return toRouteResponseDto(copy, this.config.analytics.salt);
	}

	// The Notification list is a derived view (CONTEXT.md "Notification"):
	// follows of you and shares to you, merged newest-first. Route names are
	// live references, re-checked per read like the inbox.
	async notifications(userId: number): Promise<NotificationsResponseDto> {
		const user = await this.userRepository.findOneOrFail({ id: userId });
		const [follows, shares] = await Promise.all([
			this.followRepository.find(
				{ followee: userId },
				{ populate: ["follower"], orderBy: { createdAt: "DESC" }, limit: NOTIFICATIONS_LIMIT },
			),
			this.shareRepository.find(
				{ recipient: userId },
				{ populate: ["sender"], orderBy: { createdAt: "DESC" }, limit: NOTIFICATIONS_LIMIT },
			),
		]);
		const routeIds = [...new Set(shares.map((s) => s.route.id))];
		const routes = routeIds.length
			? await this.routeRepository.find({ id: { $in: routeIds }, visibility: { $ne: "private" } })
			: [];
		const nameById = new Map(routes.map((r) => [r.id, r.name]));
		const items: NotificationItemDto[] = [
			...follows.map((f) => ({
				type: "follow" as const,
				actor: toProfileSummary(f.follower),
				createdAt: f.createdAt.toISOString(),
			})),
			...shares.map((s) => ({
				type: "route_share" as const,
				actor: toProfileSummary(s.sender),
				shareId: s.id,
				routeName: nameById.get(s.route.id) ?? null,
				createdAt: s.createdAt.toISOString(),
			})),
		]
			.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
			.slice(0, NOTIFICATIONS_LIMIT);
		return {
			items,
			seenAt: user.notificationsSeenAt ? user.notificationsSeenAt.toISOString() : null,
		};
	}

	async unseenNotificationCount(userId: number): Promise<number> {
		const user = await this.userRepository.findOneOrFail({ id: userId });
		const since = user.notificationsSeenAt;
		const [follows, shares] = await Promise.all([
			this.followRepository.count({ followee: userId, ...(since ? { createdAt: { $gt: since } } : {}) }),
			this.shareRepository.count({ recipient: userId, ...(since ? { createdAt: { $gt: since } } : {}) }),
		]);
		return follows + shares;
	}

	// Bumps the watermark; never touches RouteShare.readAt (seen is bell-level,
	// read is inbox-level).
	async markNotificationsSeen(userId: number): Promise<void> {
		const user = await this.userRepository.findOneOrFail({ id: userId });
		user.notificationsSeenAt = new Date();
		await this.em.persist(user).flush();
	}

	// Minimal discovery surface: prefix match on handle and name.
	async searchUsers(query: string, viewerId: number): Promise<ProfileSummaryDto[]> {
		const q = query.trim().toLowerCase();
		if (q.length < 2) return [];
		const escaped = q.replace(/[%_\\]/g, (c) => `\\${c}`);
		const users = await this.userRepository.find(
			{
				$and: [
					{ id: { $ne: viewerId } },
					{ $or: [{ handle: { $like: `${escaped}%` } }, { name: { $ilike: `${escaped}%` } }] },
				],
			},
			{ orderBy: { handle: "ASC" }, limit: SEARCH_LIMIT },
		);
		return users.map((u) => toProfileSummary(u));
	}

	private toShareDto(share: RouteShare, sender: User, route: Route | null): RouteShareResponseDto {
		return {
			id: share.id,
			sender: toProfileSummary(sender),
			message: share.message ?? null,
			route: route ? toProfileRouteDto(route) : null,
			unavailable: route === null,
			readAt: share.readAt ? share.readAt.toISOString() : null,
			createdAt: share.createdAt.toISOString(),
		};
	}

	// One email per sender→recipient per hour, honouring the recipient's
	// emailOnRouteShare preference. Email failure never fails the share.
	private async maybeSendShareEmail(share: RouteShare, sender: User, recipient: User, route: Route): Promise<void> {
		const prefs = normalizeUserPreferences(recipient.preferences);
		if (!prefs.emailOnRouteShare) return;
		const windowStart = new Date(Date.now() - SHARE_EMAIL_RATE_WINDOW_MS);
		const recentlyEmailed = await this.shareRepository.count({
			sender: sender.id,
			recipient: recipient.id,
			emailedAt: { $gte: windowStart },
		});
		if (recentlyEmailed > 0) return;
		try {
			// Unlisted routes are only reachable via the share token; public ones
			// keep the canonical id URL (#247).
			const ref = route.visibility === "public" ? route.id : route.shareToken;
			const slugId = buildRouteSlugId(route.name, ref);
			const url = `${this.config.app.frontendUrl}/r/${slugId}`;
			// Map preview served by the landing host's og.png proxy (it injects
			// the Referer the URL-restricted Mapbox token needs; email clients
			// fetch through proxies that send none).
			const imageUrl = `${this.config.app.publicSiteUrl}/r/${slugId}/og.png`;
			await this.emailService.sendRouteShareEmail(recipient.email, {
				senderName: sender.name,
				routeName: route.name,
				message: share.message,
				url,
				imageUrl,
			});
			share.emailedAt = new Date();
			await this.em.persist(share).flush();
		} catch (error) {
			this.logger.error("Failed to send route share email", error);
		}
	}
}
