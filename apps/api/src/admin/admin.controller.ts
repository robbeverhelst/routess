import {
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseIntPipe,
	Query,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ExternalRoutesService } from "../external-routes/external-routes.service";
import { AdminService } from "./admin.service";
import { AuditInterceptor } from "./audit.interceptor";
import { AdminRouteDetailDto, AdminRouteListDto } from "./dto/admin-route.dto";
import { AdminSeedSourcesDto } from "./dto/admin-seeding.dto";
import { AdminOverviewDto, AdminRouteStatsDto, AdminUserStatsDto } from "./dto/admin-stats.dto";
import { AdminConfigSummaryDto, AdminSystemHealthDto } from "./dto/admin-system.dto";
import { AdminUserDetailDto, AdminUserListDto } from "./dto/admin-user.dto";

@ApiTags("admin")
@ApiBearerAuth("JWT-auth")
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
@Roles("admin")
export class AdminController {
	constructor(
		private readonly admin: AdminService,
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

	@Get("stats/seed-sources")
	@ApiOperation({
		summary: "Seeded route inventory per SeedSource",
		description:
			"Per-source ExternalRoute counts, last sync, and projected next automatic sync (ADR 0033). Backs the admin seeding panel.",
	})
	async getSeedSources(): Promise<AdminSeedSourcesDto> {
		return { items: await this.externalRoutes.sourceStats() };
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
		summary: "Paginated, searchable route list",
		description:
			"Lists routes across all users with `page`/`pageSize` pagination, free-text `search`, and an optional `userId` filter.",
	})
	listRoutes(
		@Query("page") page = "1",
		@Query("pageSize") pageSize = "20",
		@Query("search") search?: string,
		@Query("userId") userId?: string,
	): Promise<AdminRouteListDto> {
		return this.admin.listRoutes({
			page: Number.parseInt(page, 10) || 1,
			pageSize: Number.parseInt(pageSize, 10) || 20,
			search,
			userId: userId ? Number.parseInt(userId, 10) : undefined,
		});
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

	@Get("users")
	@ApiOperation({
		summary: "Paginated, searchable user list",
		description: "Lists users with `page`/`pageSize` pagination and free-text `search` over name and email.",
	})
	listUsers(
		@Query("page") page = "1",
		@Query("pageSize") pageSize = "20",
		@Query("search") search?: string,
	): Promise<AdminUserListDto> {
		return this.admin.listUsers({
			page: Number.parseInt(page, 10) || 1,
			pageSize: Number.parseInt(pageSize, 10) || 20,
			search,
		});
	}

	@Get("users/:id")
	@ApiOperation({
		summary: "User detail: profile, sessions, recent routes",
		description: "Full admin view of one user: profile fields, active sessions, and their most recent routes.",
	})
	getUserDetail(@Param("id", ParseIntPipe) id: number): Promise<AdminUserDetailDto> {
		return this.admin.getUserDetail(id);
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
