import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/core";
import { getMeter } from "./tracing";
import { Counter, Histogram, UpDownCounter } from "@opentelemetry/api";
import { Route } from "../entities/route.entity";
import { User } from "../entities/user.entity";

@Injectable()
export class MetricsService implements OnModuleInit {
  private meter = getMeter();

  constructor(
    @InjectRepository(Route)
    private readonly routeRepository: EntityRepository<Route>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
  ) {}

  // HTTP metrics
  private httpRequestDuration: Histogram;
  private httpRequestTotal: Counter;
  private httpRequestErrors: Counter;

  // Business metrics
  private userRegistrations: Counter;
  private routesCreated: Counter;
  private routesDeleted: Counter;
  private activeUsers: UpDownCounter;

  // Database metrics
  private dbQueryDuration: Histogram;
  private dbConnectionPool: UpDownCounter;

  async onModuleInit() {
    await this.initializeMetrics();
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

    // Database metrics
    this.dbQueryDuration = this.meter.createHistogram("db_query_duration_ms", {
      description: "Duration of database queries in milliseconds",
      unit: "ms",
    });

    this.dbConnectionPool = this.meter.createUpDownCounter("db_connection_pool_size", {
      description: "Current size of database connection pool",
    });

    // Initialize counters with historical data
    await this.initializeBusinessMetrics();
  }

  private async initializeBusinessMetrics() {
    try {
      // Initialize routes created counter with total routes in database
      const totalRoutes = await this.routeRepository.count({ deletedAt: null });
      this.routesCreated.add(totalRoutes);

      // Initialize user registrations counter with total users
      const totalUsers = await this.userRepository.count();
      this.userRegistrations.add(totalUsers);

      // Initialize routes deleted counter with soft-deleted routes
      const deletedRoutes = await this.routeRepository.count({ deletedAt: { $ne: null } });
      this.routesDeleted.add(deletedRoutes);

      // Set active users to 0 initially (will be updated as users log in)
      this.activeUsers.add(0);

      console.log(
        `Metrics initialized: ${totalRoutes} routes, ${totalUsers} users, ${deletedRoutes} deleted routes`,
      );
    } catch (error) {
      console.error("Failed to initialize business metrics:", error);
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

  recordRouteCreated(userId: number) {
    this.routesCreated.add(1, { user_id: userId.toString() });
  }

  recordRouteDeleted(userId: number) {
    this.routesDeleted.add(1, { user_id: userId.toString() });
  }

  incrementActiveUsers() {
    this.activeUsers.add(1);
  }

  decrementActiveUsers() {
    this.activeUsers.add(-1);
  }

  // Database metrics methods
  recordDbQuery(operation: string, duration: number) {
    this.dbQueryDuration.record(duration, { operation });
  }

  updateConnectionPoolSize(delta: number) {
    this.dbConnectionPool.add(delta);
  }
}
