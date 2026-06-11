import { readFileSync } from "node:fs";
import { MikroORM, RequestContext } from "@mikro-orm/core";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { seedAdapterByKey } from "@routess/core";
import { AppModule } from "../app.module";
import { loadEnvironment } from "../config/app-config";
import { ExternalRoutesService } from "../external-routes/external-routes.service";

const logger = new Logger("SeedFile");

// Seeds any registered SeedSource from a pre-downloaded payload file:
//   bun run seed:file <sourceKey> <payloadFile>
// The automatic path is seed:refresh (fetches feedUrl); this is the manual
// fallback for flaky feeds and for self-hosters seeding offline.
async function seedFile(): Promise<void> {
	const [key, file] = process.argv.slice(2);
	const adapter = key ? seedAdapterByKey(key) : undefined;
	if (!adapter || !file) {
		logger.error("Usage: bun run seed:file <sourceKey> <payloadFile>");
		process.exitCode = 1;
		return;
	}

	loadEnvironment();
	const app = await NestFactory.createApplicationContext(AppModule, { logger: ["warn", "error"] });
	const orm = app.get(MikroORM);
	const externalRoutes = app.get(ExternalRoutesService);
	const seeds = adapter.parse(readFileSync(file, "utf8"));
	logger.log(`Parsed ${seeds.length} routes for '${key}'.`);

	await RequestContext.create(orm.em, async () => {
		await externalRoutes.ensureSource(adapter.meta);
		const result = await externalRoutes.upsertSeedRoutes(adapter.meta.key, seeds);
		logger.log(
			`Done: ${result.inserted} inserted, ${result.updated} updated, ${result.unchanged} unchanged, ${result.removed} removed.`,
		);
	});
	await app.close();
}

void seedFile();
