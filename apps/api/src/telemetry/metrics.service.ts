import { Injectable, OnModuleInit } from "@nestjs/common";
import { getMeter } from "./tracing";
import { Counter, Histogram, UpDownCounter } from "@opentelemetry/api";

@Injectable()
export class MetricsService implements OnModuleInit {
  private meter = getMeter();

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

  onModuleInit() {
    this.initializeMetrics();
  }

  private initializeMetrics() {
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
