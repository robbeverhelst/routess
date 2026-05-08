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
	AdminOverviewDto,
	AdminRouteStatsDto,
	AdminTimeseriesPointDto,
	AdminTopCreatorDto,
	AdminUserStatsDto,
} from "./dto/admin-stats.dto";
import type { AdminConfigSummaryDto, AdminSystemHealthDto } from "./dto/admin-system.dto";
import type { AdminUserDetailDto, AdminUserListDto, AdminUserListItemDto } from "./dto/admin-user.dto";

const CACHE_TTL_MS = 60_000;

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

	async listUsers(params: { page: number; pageSize: number; search?: string }): Promise<AdminUserListDto> {
		const page = Math.max(1, params.page);
		const pageSize = Math.min(100, Math.max(1, params.pageSize));
		const search = params.search?.trim();

		const whereClauses: string[] = [`u."deleted_at" is null`];
		const args: Array<string | number> = [];
		if (search) {
			whereClauses.push(`(u."email" ilike ? or u."name" ilike ?)`);
			args.push(`%${search}%`, `%${search}%`);
		}
		const whereSql = whereClauses.join(" and ");

		const totalRows = (await this.em
			.getConnection()
			.execute(`select count(*)::int as count from "user" u where ${whereSql}`, args)) as RawCount[];
		const total = Number(totalRows[0]?.count ?? 0);

		const offset = (page - 1) * pageSize;
		const rows = (await this.em.getConnection().execute(
			`select u."id", u."email", u."name", u."role", u."is_email_verified" as "isEmailVerified",
			        u."created_at" as "createdAt",
			        (select max(s."last_activity") from "session" s where s."user_id" = u."id") as "lastActiveAt",
			        (select count(*)::int from "route" r where r."user_id" = u."id" and r."deleted_at" is null) as "routeCount"
			 from "user" u
			 where ${whereSql}
			 order by u."created_at" desc
			 limit ? offset ?`,
			[...args, pageSize, offset],
		)) as Array<{
			id: number;
			email: string;
			name: string;
			role: "user" | "admin";
			isEmailVerified: boolean;
			createdAt: Date | string;
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
	}): Promise<AdminRouteListDto> {
		const page = Math.max(1, params.page);
		const pageSize = Math.min(100, Math.max(1, params.pageSize));
		const search = params.search?.trim();

		const whereClauses: string[] = [`r."deleted_at" is null`];
		const args: Array<string | number> = [];
		if (search) {
			whereClauses.push(`r."name" ilike ?`);
			args.push(`%${search}%`);
		}
		if (params.userId !== undefined) {
			whereClauses.push(`r."user_id" = ?`);
			args.push(params.userId);
		}
		const whereSql = whereClauses.join(" and ");

		const totalRows = (await this.em
			.getConnection()
			.execute(`select count(*)::int as count from "route" r where ${whereSql}`, args)) as RawCount[];
		const total = Number(totalRows[0]?.count ?? 0);

		const offset = (page - 1) * pageSize;
		const rows = (await this.em.getConnection().execute(
			`select r."id", r."name", r."activity", r."privacy",
			        r."distance", r."duration", r."elevation_gain" as "elevationGain",
			        r."created_at" as "createdAt",
			        u."id" as "ownerId", u."email" as "ownerEmail", u."name" as "ownerName"
			 from "route" r
			 join "user" u on u."id" = r."user_id"
			 where ${whereSql}
			 order by r."created_at" desc
			 limit ? offset ?`,
			[...args, pageSize, offset],
		)) as Array<{
			id: number;
			name: string;
			activity: string | null;
			privacy: string;
			distance: number | string | null;
			duration: number | string | null;
			elevationGain: number | string | null;
			createdAt: Date | string;
			ownerId: number;
			ownerEmail: string;
			ownerName: string;
		}>;

		const items: AdminRouteListItemDto[] = rows.map((row) => ({
			id: row.id,
			name: row.name,
			activity: row.activity,
			privacy: row.privacy,
			distance: row.distance == null ? null : Number(row.distance),
			duration: row.duration == null ? null : Number(row.duration),
			elevationGain: row.elevationGain == null ? null : Number(row.elevationGain),
			owner: { id: row.ownerId, email: row.ownerEmail, name: row.ownerName },
			createdAt: new Date(row.createdAt).toISOString(),
		}));

		return { items, total, page, pageSize };
	}

	async getRouteDetail(id: number): Promise<AdminRouteDetailDto> {
		const route = await this.routes.findOne({ id }, { populate: ["user"], filters: { softDelete: false } });
		if (!route) throw new NotFoundException(`Route ${id} not found`);
		const owner = route.user as unknown as User;
		return {
			id: route.id,
			name: route.name,
			activity: route.activity ?? null,
			privacy: route.privacy,
			distance: route.distance ?? null,
			duration: route.duration ?? null,
			elevationGain: route.elevationGain ?? null,
			owner: { id: owner.id, email: owner.email, name: owner.name },
			createdAt: route.createdAt.toISOString(),
			description: route.description ?? null,
			tags: route.tags ?? [],
			waypointCount: Array.isArray(route.waypoints) ? route.waypoints.length : 0,
			hasGeometry: Array.isArray(route.geometry) && route.geometry.length > 0,
			startAddress: route.startAddress ?? null,
			endAddress: route.endAddress ?? null,
			updatedAt: route.updatedAt.toISOString(),
			deletedAt: route.deletedAt ? route.deletedAt.toISOString() : null,
		};
	}

	async softDeleteRoute(id: number): Promise<void> {
		const route = await this.routes.findOne({ id });
		if (!route) throw new NotFoundException(`Route ${id} not found`);
		route.deletedAt = new Date();
		await this.em.persistAndFlush(route);
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
		await this.em.persistAndFlush(user);
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
		};
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
