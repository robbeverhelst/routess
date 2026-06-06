import { EntityManager } from "@mikro-orm/postgresql";
import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService, type HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";

const PING_TIMEOUT_MS = 1000;

@ApiTags("health")
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
	constructor(
		private health: HealthCheckService,
		private healthIndicator: HealthIndicatorService,
		private em: EntityManager,
	) {}

	// MikroORM v7 connects lazily and terminus' MikroOrmHealthIndicator only
	// inspects the connected flag, so a fresh pod would never become ready.
	// A real `select 1` both establishes the connection and verifies the
	// round-trip.
	private async pingDatabase(): Promise<HealthIndicatorResult> {
		const check = this.healthIndicator.check("database");
		try {
			await Promise.race([
				this.em.getConnection().execute("select 1"),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error(`timeout of ${PING_TIMEOUT_MS}ms exceeded`)), PING_TIMEOUT_MS),
				),
			]);
			return check.up();
		} catch (error) {
			return check.down(error instanceof Error ? error.message : "Database ping failed");
		}
	}

	@ApiOperation({
		summary: "Overall health check",
		description: "Pings the database and reports aggregate health. Same checks as /health/ready.",
	})
	@Get()
	@HealthCheck()
	check() {
		return this.health.check([() => this.pingDatabase()]);
	}

	@ApiOperation({
		summary: "Readiness probe",
		description: "Returns 200 once the database is reachable. Backs the Kubernetes readiness probe.",
	})
	@Get("ready")
	@HealthCheck()
	readiness() {
		return this.health.check([() => this.pingDatabase()]);
	}

	@ApiOperation({
		summary: "Liveness probe",
		description:
			"Returns 200 while the process is alive. Backs the Kubernetes liveness probe; no dependencies checked.",
	})
	@Get("live")
	liveness() {
		return { status: "ok", timestamp: new Date().toISOString() };
	}
}
