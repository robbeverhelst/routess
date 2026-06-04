import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService, MikroOrmHealthIndicator } from "@nestjs/terminus";

@ApiTags("health")
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
	constructor(
		private health: HealthCheckService,
		private db: MikroOrmHealthIndicator,
	) {}

	@ApiOperation({
		summary: "Overall health check",
		description: "Pings the database and reports aggregate health. Same checks as /health/ready.",
	})
	@Get()
	@HealthCheck()
	check() {
		return this.health.check([() => this.db.pingCheck("database")]);
	}

	@ApiOperation({
		summary: "Readiness probe",
		description: "Returns 200 once the database is reachable. Backs the Kubernetes readiness probe.",
	})
	@Get("ready")
	@HealthCheck()
	readiness() {
		return this.health.check([() => this.db.pingCheck("database")]);
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
