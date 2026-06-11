import { MikroORM, RequestContext } from "@mikro-orm/core";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { loadEnvironment } from "../config/app-config";
import { ExternalRoutesService } from "../external-routes/external-routes.service";

const logger = new Logger("RefreshSeeds");

// Scheduled ExternalRoute refresh (ADR 0035): re-pulls every green SeedSource
// with a feedUrl that is due per its refreshIntervalDays. Idempotent, so an
// extra run is a no-op. Run by the Helm CronJob; manually: bun run seed:refresh
async function refreshSeeds(): Promise<void> {
	loadEnvironment();
	const app = await NestFactory.createApplicationContext(AppModule, { logger: ["warn", "error"] });
	const orm = app.get(MikroORM);
	const externalRoutes = app.get(ExternalRoutesService);

	await RequestContext.create(orm.em, async () => {
		const runs = await externalRoutes.refreshDueSources();
		if (runs.length === 0) logger.log("No SeedSources registered.");
		for (const run of runs) {
			if (run.skipped) logger.log(`${run.source}: skipped (${run.skipped})`);
			else if (run.error) logger.error(`${run.source}: ${run.error}`);
			else if (run.result)
				logger.log(
					`${run.source}: ${run.result.inserted} inserted, ${run.result.updated} updated, ${run.result.unchanged} unchanged, ${run.result.removed} removed`,
				);
		}
		// A failed source exits non-zero so the CronJob surfaces it.
		if (runs.some((r) => r.error)) process.exitCode = 1;
	});

	await app.close();
}

void refreshSeeds();
