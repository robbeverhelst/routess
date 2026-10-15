import { MikroORM, RequestContext } from "@mikro-orm/core";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { loadEnvironment } from "../config/app-config";
import { WeeklyDigestService } from "../weekly-digest/weekly-digest.service";

const logger = new Logger("WeeklyDigest");

// Sends the weekly "routes near you" email to opted-in Users only. Run by the
// Helm CronJob (off by default); manually: bun src/scripts/send-weekly-digest.ts
// [--dry-run]. Safe to re-run: anyone mailed in the last 6 days is skipped.
async function sendWeeklyDigest(): Promise<void> {
	loadEnvironment();
	const dryRun = process.argv.includes("--dry-run");
	const app = await NestFactory.createApplicationContext(AppModule, { logger: ["log", "warn", "error"] });
	const orm = app.get(MikroORM);
	const digest = app.get(WeeklyDigestService);

	await RequestContext.create(orm.em, async () => {
		const result = await digest.run({ dryRun });
		logger.log(
			`${dryRun ? "[dry-run] " : ""}${result.considered} opted in: ${result.sent} sent, ${result.skippedNoArea} without a planned area, ${result.skippedNoRoutes} without new routes nearby, ${result.failed} failed`,
		);
		if (result.failed > 0) process.exitCode = 1;
	});

	await app.close();
}

void sendWeeklyDigest();
