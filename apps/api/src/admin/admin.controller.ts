import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseIntPipe,
	Post,
	Query,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ROUTE_ACTIVITIES } from "@routess/core";

import type { AuthenticatedUser } from "../auth/authenticated-user";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PLAN_KINDS, type PlanKind } from "../entitlements/plan-status";
import { ExternalRoutesService } from "../external-routes/external-routes.service";
import { AdminProService } from "./admin-pro.service";
import { ADMIN_ROUTE_SORTS, ADMIN_USER_SORTS, AdminService, type SortDir } from "./admin.service";
import { AuditInterceptor } from "./audit.interceptor";
import { AdminGrantProDto, AdminProReasonDto, AdminUserProDto } from "./dto/admin-pro.dto";
import { AdminRouteDetailDto, AdminRouteListDto } from "./dto/admin-route.dto";
import { AdminSeedRefreshResultDto, AdminSeedSourcesDto } from "./dto/admin-seeding.dto";
import {
	AdminEngagementDto,
	AdminMetricsDto,
	AdminOverviewDto,
	AdminRouteStatsDto,
	AdminUserStatsDto,
} from "./dto/admin-stats.dto";
import { AdminConfigSummaryDto, AdminSystemHealthDto } from "./dto/admin-system.dto";
import { AdminUserDetailDto, AdminUserListDto } from "./dto/admin-user.dto";

const ROUTE_VISIBILITIES = new Set(["private", "unlisted", "public"]);
const ROUTE_ACTIVITY_VALUES: ReadonlySet<string> = new Set(ROUTE_ACTIVITIES);
const USER_ROLES = new Set(["user", "admin"]);
const PLAN_KIND_VALUES: ReadonlySet<string> = new Set(PLAN_KINDS);

function parseCsv(value: string | undefined, allowed: ReadonlySet<string>): string[] | undefined {
	const values = value
		?.split(",")
		.map((v) => v.trim())
		.filter((v) => allowed.has(v));
	return values?.length ? values : undefined;
}

// An unrecognised column drops the requested direction too, so a bad `sort`
// always lands on the documented default of newest first.
function parseSort(
	sort: string | undefined,
	dir: string | undefined,
	allowed: string[],
): { sort?: string; dir: SortDir } {
	if (!sort || !allowed.includes(sort)) return { dir: "desc" };
	return { sort, dir: dir === "asc" ? "asc" : "desc" };
}

function parseBool(value: string | undefined): boolean | undefined {
	if (value === "true" || value === "1") return true;
	if (value === "false" || value === "0") return false;
	return undefined;
}

@ApiTags("admin")
@ApiBearerAuth("JWT-auth")
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
@Roles("admin")
export class AdminController {
	constructor(
		private readonly admin: AdminService,
		private readonly adminPro: AdminProService,
		private readonly externalRoutes: ExternalRoutesService,
	) {}

	@Get("stats/overview")
	@ApiOperation({
		summary: "Aggregate top-level metrics for the admin dashboard",
		description:
			"Returns headline counts (users, routes, signups) computed from Postgres aggregates. Backs the admin overview page.",
	})
	getOverview(): Promise<AdminOverviewDto> {
		return this.admin.getOverview();
	}

	@Get("stats/users")
	@ApiOperation({
		summary: "User-level KPIs (signups, churn, active count)",
		description: "Signup trend, churn, and active-user counts computed from Postgres aggregates.",
	})
	getUserStats(): Promise<AdminUserStatsDto> {
		return this.admin.getUserStats();
	}

	@Get("stats/metrics")
	@ApiOperation({
		summary: "Launch metrics: signups, active users, generations per day, paying users",
		description:
			"Backs the admin metrics page. Signups, active users, saved generated routes, and paying users come from Postgres; generation attempts per day come from route_generation_* ProductEvents in Umami and are reported unavailable when Umami is not configured.",
	})
	getMetrics(): Promise<AdminMetricsDto> {
		return this.admin.getMetrics();
	}

	@Get("stats/seed-sources")
	@ApiOperation({
		summary: "Seeded route inventory per SeedSource",
		description:
			"Per-source ExternalRoute counts, last sync, and projected next automatic sync (ADR 0035). Backs the admin seeding panel.",
	})
	async getSeedSources(): Promise<AdminSeedSourcesDto> {
		return { items: await this.externalRoutes.sourceStats() };
	}

	@Post("seed-sources/:key/refresh")
	@ApiOperation({
		summary: "Force a re-sync of one SeedSource now",
		description:
			"Re-fetches, re-parses, and upserts a single source immediately, bypassing the not-due check the scheduled CronJob honours.",
	})
	async refreshSeedSource(@Param("key") key: string): Promise<AdminSeedRefreshResultDto> {
		const r = await this.externalRoutes.refreshSource(key);
		return {
			source: r.source,
			skipped: r.skipped ?? null,
			result: r.result ?? null,
			error: r.error ?? null,
		};
	}

	@Get("stats/routes")
	@ApiOperation({
		summary: "Route counts by activity, top creators, recent trend",
		description: "Route KPIs grouped by activity, the most active creators, and the recent creation trend.",
	})
	getRouteStats(): Promise<AdminRouteStatsDto> {
		return this.admin.getRouteStats();
	}

	@Get("routes")
	@ApiOperation({
		summary: "Paginated, searchable, sortable route list",
		description:
			"Lists routes across all users with `page`/`pageSize` pagination, free-text `search`, and optional `userId`, `visibility` (comma-separated), `activity` (comma-separated), and `problems` (geometry-less routes that should have a RoutePath) filters. Sort with `sort` (createdAt, name, activity, visibility, distance, duration, elevationGain, owner) and `dir` (asc, desc); unknown values fall back to newest first.",
	})
	listRoutes(
		@Query("page") page = "1",
		@Query("pageSize") pageSize = "20",
		@Query("search") search?: string,
		@Query("userId") userId?: string,
		@Query("visibility") visibility?: string,
		@Query("activity") activity?: string,
		@Query("problems") problems?: string,
		@Query("deleted") deleted?: string,
		@Query("sort") sort?: string,
		@Query("dir") dir?: string,
	): Promise<AdminRouteListDto> {
		return this.admin.listRoutes({
			page: Number.parseInt(page, 10) || 1,
			pageSize: Number.parseInt(pageSize, 10) || 20,
			search,
			userId: userId ? Number.parseInt(userId, 10) : undefined,
			visibility: parseCsv(visibility, ROUTE_VISIBILITIES),
			activity: parseCsv(activity, ROUTE_ACTIVITY_VALUES),
			problemsOnly: problems === "true" || problems === "1",
			deletedOnly: deleted === "true" || deleted === "1",
			...parseSort(sort, dir, ADMIN_ROUTE_SORTS),
		});
	}

	@Get("stats/engagement")
	@ApiOperation({
		summary: "Signup-to-route conversion, distance distribution, top regions",
		description:
			"Postgres-derived business analytics for the admin engagement view. Behavioural funnels/retention live in Umami (ADR 0014).",
	})
	getEngagement(): Promise<AdminEngagementDto> {
		return this.admin.getEngagement();
	}

	@Get("routes/:id")
	@ApiOperation({
		summary: "Route detail: metadata, waypoints summary, owner",
		description: "Full admin view of one route, including its owner and a summary of its waypoints.",
	})
	getRouteDetail(@Param("id", ParseIntPipe) id: number): Promise<AdminRouteDetailDto> {
		return this.admin.getRouteDetail(id);
	}

	@Delete("routes/:id")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: "Soft-delete a route",
		description: "Marks the route deleted without erasing the row. The owner no longer sees it.",
	})
	softDeleteRoute(@Param("id", ParseIntPipe) id: number): Promise<void> {
		return this.admin.softDeleteRoute(id);
	}

	@Post("routes/:id/restore")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: "Restore a soft-deleted route",
		description: "Clears the route's deletedAt so the owner sees it again. Reverses a soft-delete.",
	})
	restoreRoute(@Param("id", ParseIntPipe) id: number): Promise<void> {
		return this.admin.restoreRoute(id);
	}

	@Get("users")
	@ApiOperation({
		summary: "Paginated, searchable, sortable user list",
		description:
			"Lists users with `page`/`pageSize` pagination, free-text `search` over name and email, and optional `role`, `verified` and `plan` (comma-separated: free, pro_paid, pro_admin, pro_og, pro_expired) filters. Each item carries its Plan from the same resolution the Pro gates use. Sort with `sort` (createdAt, email, name, role, routeCount, lastActiveAt, proUntil) and `dir` (asc, desc); unknown values fall back to newest first. Sorting by proUntil puts Pro that does not expire after every date and Users without a date last.",
	})
	listUsers(
		@Query("page") page = "1",
		@Query("pageSize") pageSize = "20",
		@Query("search") search?: string,
		@Query("deleted") deleted?: string,
		@Query("role") role?: string,
		@Query("verified") verified?: string,
		@Query("plan") plan?: string,
		@Query("sort") sort?: string,
		@Query("dir") dir?: string,
	): Promise<AdminUserListDto> {
		return this.admin.listUsers({
			page: Number.parseInt(page, 10) || 1,
			pageSize: Number.parseInt(pageSize, 10) || 20,
			search,
			deletedOnly: deleted === "true" || deleted === "1",
			role: role && USER_ROLES.has(role) ? role : undefined,
			verified: parseBool(verified),
			plan: parseCsv(plan, PLAN_KIND_VALUES) as PlanKind[] | undefined,
			...parseSort(sort, dir, ADMIN_USER_SORTS),
		});
	}

	@Get("users/:id")
	@ApiOperation({
		summary: "User detail: profile, sessions, recent routes, Plan and payments",
		description:
			"Full admin view of one user: profile fields, active sessions, their most recent routes, and `billing`: the Plan in effect with its source and end date, every Pro grant, the Payments (each linking to its event in the Stripe dashboard), saved Routes against the free cap, today's generation usage against the quota, and the admin actions taken on the account.",
	})
	getUserDetail(@Param("id", ParseIntPipe) id: number): Promise<AdminUserDetailDto> {
		return this.admin.getUserDetail(id);
	}

	@Post("users/:id/pro/grant")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Grant Pro for N days from now, or permanently (a comp)",
		description:
			"Sets the User's admin Pro grant (Entitlement source 'admin') to `days` from now, or to never expire with `permanent: true`; give exactly one. It replaces an earlier admin grant; time from other sources is kept and the latest end wins. Refused with 409 when the stored Plan is already Pro. Writes an audit entry with the `reason`.",
	})
	grantPro(
		@CurrentUser() actor: AuthenticatedUser,
		@Param("id", ParseIntPipe) id: number,
		@Body() body: AdminGrantProDto,
	): Promise<AdminUserProDto> {
		return this.afterProChange(this.adminPro.grant(actor, id, body));
	}

	@Post("users/:id/pro/extend")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Extend Pro by a year",
		description:
			"Adds 365 days to the end of the User's Pro time (or to now when it already ended) through their admin grant, the way buying another pass does. Refused with 409 when Pro does not expire. Writes an audit entry with the `reason`.",
	})
	extendPro(
		@CurrentUser() actor: AuthenticatedUser,
		@Param("id", ParseIntPipe) id: number,
		@Body() body: AdminProReasonDto,
	): Promise<AdminUserProDto> {
		return this.afterProChange(this.adminPro.extend(actor, id, body.reason));
	}

	@Post("users/:id/pro/revoke")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({
		summary: "Revoke Pro now",
		description:
			"Revokes every running Pro grant (paid, OG and admin; the rows are kept, marked revoked), writes the `admin` Entitlement ending now (written revoked, so it never puts the User back on Pro) and resets a stored Pro Plan to free. Refunds are not done here: refund the payment in the Stripe dashboard. Refused with 409 when the User is not on Pro. Writes an audit entry with the `reason`.",
	})
	revokePro(
		@CurrentUser() actor: AuthenticatedUser,
		@Param("id", ParseIntPipe) id: number,
		@Body() body: AdminProReasonDto,
	): Promise<AdminUserProDto> {
		return this.afterProChange(this.adminPro.revoke(actor, id, body.reason));
	}

	private async afterProChange(change: Promise<AdminUserProDto>): Promise<AdminUserProDto> {
		const result = await change;
		this.admin.invalidateStats();
		return result;
	}

	@Delete("users/:id/sessions/:sessionId")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: "Revoke a single session for a user",
		description: "Force-signs the user out of one device by revoking that session.",
	})
	revokeSession(@Param("id", ParseIntPipe) userId: number, @Param("sessionId") sessionId: string): Promise<void> {
		return this.admin.revokeSession(userId, sessionId);
	}

	@Delete("users/:id")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: "Soft-delete a user; cascades to routes and sessions",
		description: "Marks the user deleted, soft-deletes their routes, and revokes all their sessions.",
	})
	softDeleteUser(@Param("id", ParseIntPipe) id: number): Promise<void> {
		return this.admin.softDeleteUser(id);
	}

	@Post("users/:id/restore")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({
		summary: "Restore a soft-deleted user and their routes",
		description:
			"Clears the user's deletedAt and un-soft-deletes their routes. Sessions are not restored; the user signs in again.",
	})
	restoreUser(@Param("id", ParseIntPipe) id: number): Promise<void> {
		return this.admin.restoreUser(id);
	}

	@Get("system/health")
	@ApiOperation({
		summary: "API health, version, uptime, DB reachability",
		description: "Snapshot of the running API for the admin system page: version, uptime, and database status.",
	})
	getSystemHealth(): Promise<AdminSystemHealthDto> {
		return this.admin.getSystemHealth();
	}

	@Get("system/config-summary")
	@ApiOperation({
		summary: "Sanitised view of runtime config (no secrets)",
		description:
			"Shows which optional integrations are configured (email, Valhalla, Umami, Sentry) without exposing secret values.",
	})
	getConfigSummary(): AdminConfigSummaryDto {
		return this.admin.getConfigSummary();
	}
}
