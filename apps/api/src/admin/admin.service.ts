import { EntityManager, EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { SessionService } from "../auth/session.service";
import type { AppConfig } from "../config/app-config";
import { APP_CONFIG } from "../config/config.module";
import { Route } from "../entities/route.entity";
import { Session } from "../entities/session.entity";
import { User } from "../entities/user.entity";
import { TtlCache } from "./admin-cache";
import type { AdminRouteDetailDto, AdminRouteListDto, AdminRouteListItemDto } from "./dto/admin-route.dto";
import type {
	AdminConversionDto,
	AdminEngagementDto,
	AdminOverviewDto,
	AdminRouteStatsDto,
	AdminTimeseriesPointDto,
	AdminTopCreatorDto,
	AdminUserStatsDto,
} from "./dto/admin-stats.dto";
import type { AdminConfigSummaryDto, AdminSystemHealthDto } from "./dto/admin-system.dto";
import type { AdminUserDetailDto, AdminUserListDto, AdminUserListItemDto } from "./dto/admin-user.dto";

const CACHE_TTL_MS = 60_000;

export type SortDir = "asc" | "desc";

// Allowlists: the request only ever picks a key, never supplies SQL.
const USER_SORT_COLUMNS: Record<string, string> = {
	createdAt: `u."created_at"`,
	email: `u."email"`,
	name: `u."name"`,
	role: `u."role"`,
	routeCount: `"routeCount"`,
	lastActiveAt: `"lastActiveAt"`,
};

const ROUTE_SORT_COLUMNS: Record<string, string> = {
	createdAt: `r."created_at"`,
	name: `r."name"`,
	activity: `r."activity"`,
	visibility: `r."visibility"`,
	distance: `r."distance"`,
	duration: `r."duration"`,
	elevationGain: `r."elevation_gain"`,
	owner: `u."email"`,
};

export const ADMIN_USER_SORTS = Object.keys(USER_SORT_COLUMNS);
export const ADMIN_ROUTE_SORTS = Object.keys(ROUTE_SORT_COLUMNS);

function orderBySql(columns: Record<string, string>, sort: string | undefined, dir: SortDir, tiebreak: string): string {
	const column = (sort && columns[sort]) || columns.createdAt;
	const direction = dir === "asc" ? "asc" : "desc";
	return `order by ${column} ${direction} nulls last, ${tiebreak} desc`;
}

interface RawCount {
	count: number | string;
}

interface RawDateCount {
	d: string | Date;
	count: number | string;
}

@Injectable()
export class AdminService {
	private readonly statsCache = new TtlCache<string, unknown>(CACHE_TTL_MS);

	constructor(
		@InjectRepository(User) private readonly users: EntityRepository<User>,
		@InjectRepository(Route) private readonly routes: EntityRepository<Route>,
		@InjectRepository(Session) private readonly sessions: EntityRepository<Session>,
		private readonly em: EntityManager,
		private readonly sessionService: SessionService,
		@Inject(APP_CONFIG) private readonly config: AppConfig,
	) {}

	async getOverview(): Promise<AdminOverviewDto> {
		return this.statsCache.get("overview", async () => {
			const [totalUsers, totalRoutes, activeSessions, signupsToday, signupsLast30, routesLast30] = await Promise.all([
				this.users.count({}),
				this.routes.count({}),
				this.sessionService.getActiveSessionsCount(),
				this.countSignupsToday(),
				this.timeseries("user", 30),
				this.timeseries("route", 30),
			]);
			return {
				totalUsers,
				totalRoutes,
				activeSessions,
				signupsToday,
				signupsLast30Days: signupsLast30,
				routesCreatedLast30Days: routesLast30,
			};
		}) as Promise<AdminOverviewDto>;
	}

	async getUserStats(): Promise<AdminUserStatsDto> {
		return this.statsCache.get("user-stats", async () => {
			const [totalUsers, verifiedUsers, deletedUsers, activeLast7Days, signupsLast30] = await Promise.all([
				this.users.count({}),
				this.users.count({ isEmailVerified: true }),
				this.users.count({ deletedAt: { $ne: null } }, { filters: { softDelete: false } }),
				this.countActiveLast7Days(),
				this.timeseries("user", 30),
			]);
			return { totalUsers, verifiedUsers, deletedUsers, activeLast7Days, signupsLast30Days: signupsLast30 };
		}) as Promise<AdminUserStatsDto>;
	}

	async getRouteStats(): Promise<AdminRouteStatsDto> {
		return this.statsCache.get("route-stats", async () => {
			const [totalRoutes, byActivity, createdLast30Days, topCreators] = await Promise.all([
				this.routes.count({}),
				this.routesByActivity(),
				this.timeseries("route", 30),
				this.topCreators(20),
			]);
			return { totalRoutes, byActivity, createdLast30Days, topCreators };
		}) as Promise<AdminRouteStatsDto>;
	}

	async listUsers(params: {
		page: number;
		pageSize: number;
		search?: string;
		deletedOnly?: boolean;
		role?: string;
		verified?: boolean;
		sort?: string;
		dir?: SortDir;
	}): Promise<AdminUserListDto> {
		const page = Math.max(1, params.page);
		const pageSize = Math.min(100, Math.max(1, params.pageSize));
		const search = params.search?.trim();

		const whereClauses: string[] = [params.deletedOnly ? `u."deleted_at" is not null` : `u."deleted_at" is null`];
		const args: Array<string | number | boolean> = [];
		if (search) {
			whereClauses.push(`(u."email" ilike ? or u."name" ilike ?)`);
			args.push(`%${search}%`, `%${search}%`);
		}
		if (params.role) {
			whereClauses.push(`u."role" = ?`);
			args.push(params.role);
		}
		if (params.verified !== undefined) {
			whereClauses.push(`u."is_email_verified" = ?`);
			args.push(params.verified);
		}
		const whereSql = whereClauses.join(" and ");
		const orderSql = orderBySql(USER_SORT_COLUMNS, params.sort, params.dir ?? "desc", `u."id"`);

		const totalRows = (await this.em
			.getConnection()
			.execute(`select count(*)::int as count from "user" u where ${whereSql}`, args)) as RawCount[];
		const total = Number(totalRows[0]?.count ?? 0);

		const offset = (page - 1) * pageSize;
		const rows = (await this.em.getConnection().execute(
			`select u."id", u."email", u."name", u."role", u."is_email_verified" as "isEmailVerified",
			        u."created_at" as "createdAt", u."deleted_at" as "deletedAt",
			        (select max(s."last_activity") from "session" s where s."user_id" = u."id") as "lastActiveAt",
			        (select count(*)::int from "route" r where r."user_id" = u."id" and r."deleted_at" is null) as "routeCount"
			 from "user" u
			 where ${whereSql}
			 ${orderSql}
			 limit ? offset ?`,
			[...args, pageSize, offset],
		)) as Array<{
			id: number;
			email: string;
			name: string;
			role: "user" | "admin";
			isEmailVerified: boolean;
			createdAt: Date | string;
			deletedAt: Date | string | null;
			lastActiveAt: Date | string | null;
			routeCount: number | string;
		}>;

		const items: AdminUserListItemDto[] = rows.map((row) => ({
			id: row.id,
			email: row.email,
			name: row.name,
			role: row.role,
			isEmailVerified: row.isEmailVerified,
			routeCount: Number(row.routeCount ?? 0),
			createdAt: new Date(row.createdAt).toISOString(),
			lastActiveAt: row.lastActiveAt ? new Date(row.lastActiveAt).toISOString() : null,
			deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
		}));

		return { items, total, page, pageSize };
	}

	async getUserDetail(id: number): Promise<AdminUserDetailDto> {
		const user = await this.users.findOne({ id }, { filters: { softDelete: false } });
		if (!user) throw new NotFoundException(`User ${id} not found`);

		const [activeSessions, recentRoutes, routeCount, lastActivity] = await Promise.all([
			this.sessionService.getUserActiveSessions(id),
			this.routes.find({ user: id }, { orderBy: { createdAt: "DESC" }, limit: 20 }),
			this.routes.count({ user: id }),
			this.em
				.getConnection()
				.execute(`select max("last_activity") as "lastActivity" from "session" where "user_id" = ?`, [id])
				.then((rows) => {
					const r = (rows as Array<{ lastActivity: Date | string | null }>)[0];
					return r?.lastActivity ? new Date(r.lastActivity).toISOString() : null;
				}),
		]);

		return {
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			isEmailVerified: user.isEmailVerified,
			routeCount,
			createdAt: user.createdAt.toISOString(),
			lastActiveAt: lastActivity,
			deletedAt: user.deletedAt ? user.deletedAt.toISOString() : null,
			activeSessions: activeSessions.map((s) => ({
				id: s.jti,
				userAgent: s.userAgent ?? null,
				ipAddress: s.ipAddress ?? null,
				createdAt: s.createdAt.toISOString(),
				expiresAt: s.expiresAt.toISOString(),
				lastActivity: s.lastActivity ? s.lastActivity.toISOString() : null,
			})),
			recentRoutes: recentRoutes.map((r) => ({
				id: r.id,
				name: r.name,
				activity: r.activity ?? null,
				createdAt: r.createdAt.toISOString(),
			})),
		};
	}

	async revokeSession(userId: number, sessionJti: string): Promise<void> {
		const session = await this.sessions.findOne({ jti: sessionJti, user: userId });
		if (!session) throw new NotFoundException("Session not found");
		await this.sessionService.invalidateSession(sessionJti, "admin_revoked");
		this.statsCache.invalidate();
	}

	async listRoutes(params: {
		page: number;
		pageSize: number;
		search?: string;
		userId?: number;
		visibility?: string[];
		activity?: string[];
		problemsOnly?: boolean;
		deletedOnly?: boolean;
		sort?: string;
		dir?: SortDir;
	}): Promise<AdminRouteListDto> {
		const page = Math.max(1, params.page);
		const pageSize = Math.min(100, Math.max(1, params.pageSize));
		const search = params.search?.trim();

		const whereClauses: string[] = [params.deletedOnly ? `r."deleted_at" is not null` : `r."deleted_at" is null`];
		const args: Array<string | number> = [];
		if (search) {
			whereClauses.push(`r."name" ilike ?`);
			args.push(`%${search}%`);
		}
		if (params.userId !== undefined) {
			whereClauses.push(`r."user_id" = ?`);
			args.push(params.userId);
		}
		if (params.visibility?.length) {
			const placeholders = params.visibility.map(() => "?").join(", ");
			whereClauses.push(`r."visibility" in (${placeholders})`);
			args.push(...params.visibility);
		}
		if (params.activity?.length) {
			const placeholders = params.activity.map(() => "?").join(", ");
			whereClauses.push(`r."activity" in (${placeholders})`);
			args.push(...params.activity);
		}
		if (params.problemsOnly) {
			// "Saved-while-broken": geometry never landed even though provenance
			// implies a computed RoutePath should exist. ::text compare works for
			// both json and jsonb columns and treats null + empty array alike.
			whereClauses.push(
				`(r."geometry" is null or r."geometry"::text = '[]') and r."provenance" in ('valhalla', 'generation')`,
			);
		}
		const whereSql = whereClauses.join(" and ");
		const orderSql = orderBySql(ROUTE_SORT_COLUMNS, params.sort, params.dir ?? "desc", `r."id"`);

		const totalRows = (await this.em
			.getConnection()
			.execute(`select count(*)::int as count from "route" r where ${whereSql}`, args)) as RawCount[];
		const total = Number(totalRows[0]?.count ?? 0);

		const offset = (page - 1) * pageSize;
		const rows = (await this.em.getConnection().execute(
			`select r."id", r."name", r."activity", r."visibility",
			        r."distance", r."duration", r."elevation_gain" as "elevationGain",
			        r."created_at" as "createdAt", r."deleted_at" as "deletedAt",
			        u."id" as "ownerId", u."email" as "ownerEmail", u."name" as "ownerName"
			 from "route" r
			 join "user" u on u."id" = r."user_id"
			 where ${whereSql}
			 ${orderSql}
			 limit ? offset ?`,
			[...args, pageSize, offset],
		)) as Array<{
			id: number;
			name: string;
			activity: string | null;
			visibility: string;
			distance: number | string | null;
			duration: number | string | null;
			elevationGain: number | string | null;
			createdAt: Date | string;
			deletedAt: Date | string | null;
			ownerId: number;
			ownerEmail: string;
			ownerName: string;
		}>;

		const items: AdminRouteListItemDto[] = rows.map((row) => ({
			id: row.id,
			name: row.name,
			activity: row.activity,
			visibility: row.visibility,
			distance: row.distance == null ? null : Number(row.distance),
			duration: row.duration == null ? null : Number(row.duration),
			elevationGain: row.elevationGain == null ? null : Number(row.elevationGain),
			owner: { id: row.ownerId, email: row.ownerEmail, name: row.ownerName },
			createdAt: new Date(row.createdAt).toISOString(),
			deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
		}));

		return { items, total, page, pageSize };
	}

	async getRouteDetail(id: number): Promise<AdminRouteDetailDto> {
		const route = await this.routes.findOne({ id }, { populate: ["user"], filters: { softDelete: false } });
		if (!route) throw new NotFoundException(`Route ${id} not found`);
		const owner = route.user;
		const geometry = Array.isArray(route.geometry) && route.geometry.length > 0 ? route.geometry : null;
		const bbox =
			route.bboxMinLng != null && route.bboxMinLat != null && route.bboxMaxLng != null && route.bboxMaxLat != null
				? ([route.bboxMinLng, route.bboxMinLat, route.bboxMaxLng, route.bboxMaxLat] as [number, number, number, number])
				: null;
		return {
			id: route.id,
			name: route.name,
			activity: route.activity ?? null,
			visibility: route.visibility,
			distance: route.distance ?? null,
			duration: route.duration ?? null,
			elevationGain: route.elevationGain ?? null,
			owner: { id: owner.id, email: owner.email, name: owner.name },
			createdAt: route.createdAt.toISOString(),
			description: route.description ?? null,
			tags: route.tags ?? [],
			waypointCount: Array.isArray(route.waypoints) ? route.waypoints.length : 0,
			hasGeometry: geometry !== null,
			waypoints: Array.isArray(route.waypoints) ? route.waypoints : [],
			geometry,
			bbox,
			provenance: route.provenance,
			favourite: route.favourite,
			routingPreferences: route.routingPreferences ?? null,
			surfaceComposition: route.surfaceComposition ?? null,
			shareToken: route.shareToken,
			placeCity: route.placeCity ?? null,
			placeRegion: route.placeRegion ?? null,
			placeCountryCode: route.placeCountryCode ?? null,
			publishedAt: route.publishedAt ? route.publishedAt.toISOString() : null,
			copiedFromRouteId: route.copiedFromRouteId ?? null,
			copiedFromUserId: route.copiedFromUserId ?? null,
			startAddress: route.startAddress ?? null,
			endAddress: route.endAddress ?? null,
			updatedAt: route.updatedAt.toISOString(),
			deletedAt: route.deletedAt ? route.deletedAt.toISOString() : null,
		};
	}

	async restoreRoute(id: number): Promise<void> {
		const route = await this.routes.findOne({ id }, { filters: { softDelete: false } });
		if (!route) throw new NotFoundException(`Route ${id} not found`);
		route.deletedAt = undefined;
		await this.em.persist(route).flush();
		this.statsCache.invalidate();
	}

	async restoreUser(userId: number): Promise<void> {
		const user = await this.users.findOne({ id: userId }, { filters: { softDelete: false } });
		if (!user) throw new NotFoundException(`User ${userId} not found`);
		user.deletedAt = undefined;
		if (user.deletionStatus === "pending_hard_delete") {
			user.deletionStatus = "active";
			user.deletionRequestedAt = undefined;
		}
		await this.em.getConnection().execute(`update "route" set "deleted_at" = null where "user_id" = ?`, [userId]);
		await this.em.persist(user).flush();
		this.statsCache.invalidate();
	}

	async softDeleteRoute(id: number): Promise<void> {
		const route = await this.routes.findOne({ id });
		if (!route) throw new NotFoundException(`Route ${id} not found`);
		route.deletedAt = new Date();
		await this.em.persist(route).flush();
		this.statsCache.invalidate();
	}

	async softDeleteUser(userId: number): Promise<void> {
		const user = await this.users.findOne({ id: userId });
		if (!user) throw new NotFoundException(`User ${userId} not found`);

		const now = new Date();
		user.deletedAt = now;
		await this.em
			.getConnection()
			.execute(`update "route" set "deleted_at" = ? where "user_id" = ? and "deleted_at" is null`, [now, userId]);
		await this.em.persist(user).flush();
		await this.sessionService.invalidateUserSessions(userId, "admin_revoked");
		this.statsCache.invalidate();
	}

	async getSystemHealth(): Promise<AdminSystemHealthDto> {
		let databaseReachable = true;
		try {
			await this.em.getConnection().execute("select 1");
		} catch {
			databaseReachable = false;
		}
		return {
			status: databaseReachable ? "ok" : "degraded",
			version: this.config.app.version,
			nodeEnv: this.config.app.nodeEnv,
			uptimeSeconds: Math.floor(process.uptime()),
			databaseReachable,
		};
	}

	getConfigSummary(): AdminConfigSummaryDto {
		return {
			telemetryEnabled: this.config.telemetry.enabled,
			metricsEnabled: this.config.telemetry.metricsEnabled,
			otlpExportConfigured: Boolean(this.config.telemetry.otlpEndpoint),
			adminEmailsCount: this.config.auth.adminEmails.length,
			grafanaUrls: this.config.monitoring.grafanaUrls,
			umamiUrl: this.config.monitoring.umamiUrl ?? null,
			glitchtipUrl: this.config.monitoring.glitchtipUrl ?? null,
		};
	}

	async getEngagement(): Promise<AdminEngagementDto> {
		return this.statsCache.get("engagement", async () => {
			const [signupToFirstRoute, distanceDistribution, topRegions] = await Promise.all([
				this.signupToFirstRoute(),
				this.distanceDistribution(),
				this.topRegions(10),
			]);
			return { signupToFirstRoute, distanceDistribution, topRegions };
		}) as Promise<AdminEngagementDto>;
	}

	private async signupToFirstRoute(): Promise<AdminConversionDto> {
		const [totalUsers, withRouteRows] = await Promise.all([
			this.users.count({}),
			this.em
				.getConnection()
				.execute(`select count(distinct "user_id")::int as count from "route" where "deleted_at" is null`) as Promise<
				RawCount[]
			>,
		]);
		const usersWithRoute = Number(withRouteRows[0]?.count ?? 0);
		const conversionPct = totalUsers > 0 ? Math.round((usersWithRoute / totalUsers) * 1000) / 10 : 0;
		return { totalUsers, usersWithRoute, conversionPct };
	}

	private async distanceDistribution(): Promise<Array<{ label: string; count: number }>> {
		const rows = (await this.em.getConnection().execute(
			`select case
				when "distance" is null then 'unknown'
				when "distance" < 5000 then '<5km'
				when "distance" < 15000 then '5-15km'
				when "distance" < 30000 then '15-30km'
				when "distance" < 60000 then '30-60km'
				when "distance" < 100000 then '60-100km'
				else '100km+'
			end as bucket, count(*)::int as count
			from "route"
			where "deleted_at" is null
			group by bucket`,
		)) as Array<{ bucket: string; count: number | string }>;
		const order = ["<5km", "5-15km", "15-30km", "30-60km", "60-100km", "100km+", "unknown"];
		const byLabel = new Map(rows.map((r) => [r.bucket, Number(r.count)]));
		return order.filter((label) => byLabel.has(label)).map((label) => ({ label, count: byLabel.get(label) ?? 0 }));
	}

	private async topRegions(limit: number): Promise<
		Array<{
			city: string | null;
			region: string | null;
			countryCode: string | null;
			count: number;
		}>
	> {
		const rows = (await this.em.getConnection().execute(
			`select "place_city" as city, "place_region" as region, "place_country_code" as country, count(*)::int as count
			 from "route"
			 where "deleted_at" is null and "place_city" is not null
			 group by "place_city", "place_region", "place_country_code"
			 order by count desc
			 limit ?`,
			[limit],
		)) as Array<{ city: string | null; region: string | null; country: string | null; count: number | string }>;
		return rows.map((r) => ({
			city: r.city ?? null,
			region: r.region ?? null,
			countryCode: r.country ?? null,
			count: Number(r.count),
		}));
	}

	private async countSignupsToday(): Promise<number> {
		const rows = (await this.em
			.getConnection()
			.execute(
				`select count(*)::int as count from "user" where "created_at" >= date_trunc('day', now())`,
			)) as RawCount[];
		return Number(rows[0]?.count ?? 0);
	}

	private async countActiveLast7Days(): Promise<number> {
		const rows = (await this.em.getConnection().execute(
			`select count(distinct "user_id")::int as count
			 from "session"
			 where "last_activity" >= now() - interval '7 days' and "deleted_at" is null`,
		)) as RawCount[];
		return Number(rows[0]?.count ?? 0);
	}

	private async timeseries(table: "user" | "route", days: number): Promise<AdminTimeseriesPointDto[]> {
		const rows = (await this.em.getConnection().execute(
			`with days as (
				select generate_series(
					date_trunc('day', now()) - (?::int - 1) * interval '1 day',
					date_trunc('day', now()),
					interval '1 day'
				)::date as d
			)
			select d::text as d,
			       (select count(*)::int from "${table}" t
			        where t."created_at" >= days.d
			          and t."created_at" < days.d + interval '1 day'
			          and t."deleted_at" is null) as count
			from days
			order by d`,
			[days],
		)) as RawDateCount[];
		return rows.map((row) => ({ date: String(row.d), count: Number(row.count ?? 0) }));
	}

	private async routesByActivity(): Promise<Array<{ activity: string | null; count: number }>> {
		const rows = (await this.em.getConnection().execute(
			`select "activity", count(*)::int as count
			 from "route"
			 where "deleted_at" is null
			 group by "activity"
			 order by count desc`,
		)) as Array<{ activity: string | null; count: number | string }>;
		return rows.map((r) => ({ activity: r.activity ?? null, count: Number(r.count) }));
	}

	private async topCreators(limit: number): Promise<AdminTopCreatorDto[]> {
		const rows = (await this.em.getConnection().execute(
			`select u."id" as "userId", u."email", u."name", count(r."id")::int as "routeCount"
			 from "user" u
			 join "route" r on r."user_id" = u."id" and r."deleted_at" is null
			 where u."deleted_at" is null
			 group by u."id"
			 order by "routeCount" desc
			 limit ?`,
			[limit],
		)) as Array<{ userId: number; email: string; name: string; routeCount: number | string }>;
		return rows.map((r) => ({
			userId: r.userId,
			email: r.email,
			name: r.name,
			routeCount: Number(r.routeCount),
		}));
	}
}
