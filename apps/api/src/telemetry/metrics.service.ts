import { EntityRepository } from "@mikro-orm/core";
import { InjectRepository } from "@mikro-orm/nestjs";
import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { Counter, Histogram, UpDownCounter } from "@opentelemetry/api";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";
import { setDbMetricsRecorder } from "./db-metrics-recorder";
import type { AuthLoginResult, AuthProvider, SessionRevocationReason } from "./domain-events";
import type { Metrics } from "./metrics.interface";
import { getMeter } from "./tracing";

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy, Metrics {
	private meter = getMeter();

	constructor(
		@InjectRepository(Route)
		private readonly routeRepository: EntityRepository<Route>,
		@InjectRepository(User)
		private readonly userRepository: EntityRepository<User>,
	) {}

	// HTTP metrics
	private httpRequestDuration!: Histogram;
	private httpRequestTotal!: Counter;
	private httpRequestErrors!: Counter;

	// Business metrics
	private userRegistrations!: Counter;
	private userUndeletes!: Counter;
	private routesCreated!: Counter;
	private routesDeleted!: Counter;
	private activeUsers!: UpDownCounter;
	private activeUsersCount = 0;

	private dbQueryDuration!: Histogram;

	// Auth metrics
	private loginAttempts!: Counter;
	private sessionsRevoked!: Counter;

	// External request metrics
	private externalRequestDuration!: Histogram;

	async onModuleInit() {
		await this.initializeMetrics();
		setDbMetricsRecorder((operation, duration) => this.recordDbQuery(operation, duration));
	}

	onModuleDestroy() {
		setDbMetricsRecorder(null);
	}

	private async initializeMetrics() {
		// HTTP metrics
		this.httpRequestDuration = this.meter.createHistogram("http_request_duration_ms", {
			description: "Duration of HTTP requests in milliseconds",
			unit: "ms",
		});

		this.httpRequestTotal = this.meter.createCounter("http_requests_total", {
			description: "Total number of HTTP requests",
		});

		this.httpRequestErrors = this.meter.createCounter("http_request_errors_total", {
			description: "Total number of HTTP request errors",
		});

		// Business metrics
		this.userRegistrations = this.meter.createCounter("user_registrations_total", {
			description: "Total number of user registrations",
		});

		this.routesCreated = this.meter.createCounter("routes_created_total", {
			description: "Total number of routes created",
		});

		this.routesDeleted = this.meter.createCounter("routes_deleted_total", {
			description: "Total number of routes deleted",
		});

		this.activeUsers = this.meter.createUpDownCounter("active_users", {
			description: "Number of currently active users",
		});

		this.dbQueryDuration = this.meter.createHistogram("db_query_duration_ms", {
			description: "Duration of database queries in milliseconds",
			unit: "ms",
		});

		this.userUndeletes = this.meter.createCounter("user_undeletes_total", {
			description: "Total number of soft-deleted users restored on relogin",
		});

		this.loginAttempts = this.meter.createCounter("auth_login_total", {
			description: "Total number of authentication attempts",
		});

		this.sessionsRevoked = this.meter.createCounter("auth_session_revoked_total", {
			description: "Total number of revoked sessions",
		});

		this.externalRequestDuration = this.meter.createHistogram("external_request_duration_ms", {
			description: "Duration of outbound requests to third-party providers",
			unit: "ms",
		});

		// Initialize counters with historical data
		await this.initializeBusinessMetrics();
	}

	private async initializeBusinessMetrics() {
		try {
			const totalRoutes = await this.routeRepository.count({});
			this.routesCreated.add(totalRoutes);

			const totalUsers = await this.userRepository.count({}, { filters: { softDelete: false } });
			this.userRegistrations.add(totalUsers);

			const deletedRoutes = await this.routeRepository.count(
				{ deletedAt: { $ne: null } },
				{ filters: { softDelete: false } },
			);
			this.routesDeleted.add(deletedRoutes);

			this.setActiveUsers(0);
		} catch (_error) {
			// Metrics should never block app startup.
		}
	}

	// HTTP metrics methods
	recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
		const labels = { method, route, status_code: statusCode.toString() };

		this.httpRequestTotal.add(1, labels);
		this.httpRequestDuration.record(duration, labels);

		if (statusCode >= 400) {
			this.httpRequestErrors.add(1, labels);
		}
	}

	// Business metrics methods
	recordUserRegistration(registrationType: "google" | "email") {
		this.userRegistrations.add(1, { type: registrationType });
	}

	recordRouteCreated() {
		this.routesCreated.add(1);
	}

	recordRouteDeleted() {
		this.routesDeleted.add(1);
	}

	setActiveUsers(count: number) {
		const delta = count - this.activeUsersCount;
		if (delta !== 0) {
			this.activeUsers.add(delta);
			this.activeUsersCount = count;
		}
	}

	recordDbQuery(operation: string, duration: number) {
		this.dbQueryDuration.record(duration, { operation });
	}

	recordUserUndeleted() {
		this.userUndeletes.add(1);
	}

	recordLoginAttempt(provider: AuthProvider, result: AuthLoginResult) {
		this.loginAttempts.add(1, { provider, result });
	}

	recordSessionRevoked(reason: SessionRevocationReason, count: number) {
		if (count <= 0) return;
		this.sessionsRevoked.add(count, { reason });
	}

	recordExternalRequest(provider: string, status: "success" | "error", duration: number) {
		this.externalRequestDuration.record(duration, { provider, status });
	}
}
