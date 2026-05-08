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
import { AdminService } from "./admin.service";
import { AuditInterceptor } from "./audit.interceptor";
import { AdminRouteDetailDto, AdminRouteListDto } from "./dto/admin-route.dto";
import { AdminOverviewDto, AdminRouteStatsDto, AdminUserStatsDto } from "./dto/admin-stats.dto";
import { AdminConfigSummaryDto, AdminSystemHealthDto } from "./dto/admin-system.dto";
import { AdminUserDetailDto, AdminUserListDto } from "./dto/admin-user.dto";

@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
@Roles("admin")
export class AdminController {
	constructor(private readonly admin: AdminService) {}

	@Get("stats/overview")
	@ApiOperation({ summary: "Aggregate top-level metrics for the admin dashboard" })
	getOverview(): Promise<AdminOverviewDto> {
		return this.admin.getOverview();
	}

	@Get("stats/users")
	@ApiOperation({ summary: "User-level KPIs (signups, churn, active count)" })
	getUserStats(): Promise<AdminUserStatsDto> {
		return this.admin.getUserStats();
	}

	@Get("stats/routes")
	@ApiOperation({ summary: "Route counts by activity, top creators, recent trend" })
	getRouteStats(): Promise<AdminRouteStatsDto> {
		return this.admin.getRouteStats();
	}

	@Get("routes")
	@ApiOperation({ summary: "Paginated, searchable route list" })
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
	@ApiOperation({ summary: "Route detail: metadata, waypoints summary, owner" })
	getRouteDetail(@Param("id", ParseIntPipe) id: number): Promise<AdminRouteDetailDto> {
		return this.admin.getRouteDetail(id);
	}

	@Delete("routes/:id")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Soft-delete a route" })
	softDeleteRoute(@Param("id", ParseIntPipe) id: number): Promise<void> {
		return this.admin.softDeleteRoute(id);
	}

	@Get("users")
	@ApiOperation({ summary: "Paginated, searchable user list" })
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
	@ApiOperation({ summary: "User detail: profile, sessions, recent routes" })
	getUserDetail(@Param("id", ParseIntPipe) id: number): Promise<AdminUserDetailDto> {
		return this.admin.getUserDetail(id);
	}

	@Delete("users/:id/sessions/:sessionId")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Revoke a single session for a user" })
	revokeSession(@Param("id", ParseIntPipe) userId: number, @Param("sessionId") sessionId: string): Promise<void> {
		return this.admin.revokeSession(userId, sessionId);
	}

	@Delete("users/:id")
	@HttpCode(HttpStatus.NO_CONTENT)
	@ApiOperation({ summary: "Soft-delete a user; cascades to routes and sessions" })
	softDeleteUser(@Param("id", ParseIntPipe) id: number): Promise<void> {
		return this.admin.softDeleteUser(id);
	}

	@Get("system/health")
	@ApiOperation({ summary: "API health, version, uptime, DB reachability" })
	getSystemHealth(): Promise<AdminSystemHealthDto> {
		return this.admin.getSystemHealth();
	}

	@Get("system/config-summary")
	@ApiOperation({ summary: "Sanitised view of runtime config (no secrets)" })
	getConfigSummary(): AdminConfigSummaryDto {
		return this.admin.getConfigSummary();
	}
}
