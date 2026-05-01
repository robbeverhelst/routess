import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService, MikroOrmHealthIndicator } from "@nestjs/terminus";

@ApiTags("health")
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
	constructor(
		private health: HealthCheckService,
		private db: MikroOrmHealthIndicator,
	) {}

	@Get()
	@HealthCheck()
	check() {
		return this.health.check([() => this.db.pingCheck("database")]);
	}

	@Get("ready")
	@HealthCheck()
	readiness() {
		return this.health.check([() => this.db.pingCheck("database")]);
	}

	@Get("live")
	liveness() {
		return { status: "ok", timestamp: new Date().toISOString() };
	}
}
