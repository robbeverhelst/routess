import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { MikroORM, RequestContext } from "@mikro-orm/core";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { EUROVELO_SOURCE, euroVeloAdapter, type SeedRoute } from "@routess/core";
import { AppModule } from "../app.module";
import { loadEnvironment } from "../config/app-config";
import { ExternalRoutesService } from "../external-routes/external-routes.service";

const logger = new Logger("SeedEuroVelo");

// Seeds EuroVelo ExternalRoutes from official ECF GPX (ADR 0033). Fetch the GPX
// out of band (open ODbL since 2024) and point this at the file or directory:
//   bun run seed:eurovelo ./data/eurovelo
// IMPORTANT: pass the COMPLETE set of GPX for the source. The upsert soft-deletes
// any EuroVelo route absent from the input, so a partial run would prune the rest.
function readGpxFiles(target: string): string[] {
	const stat = statSync(target);
	if (stat.isDirectory()) {
		return readdirSync(target)
			.filter((f) => f.toLowerCase().endsWith(".gpx"))
			.map((f) => readFileSync(join(target, f), "utf8"));
	}
	return [readFileSync(target, "utf8")];
}

async function seedEuroVelo(): Promise<void> {
	const target = process.argv[2];
	if (!target) {
		logger.error("Usage: bun run seed:eurovelo <gpx-file-or-directory>");
		process.exitCode = 1;
		return;
	}

	loadEnvironment();
	const app = await NestFactory.createApplicationContext(AppModule, { logger: ["warn", "error"] });
	const orm = app.get(MikroORM);
	const externalRoutes = app.get(ExternalRoutesService);

	const payloads = readGpxFiles(target);
	const seeds: SeedRoute[] = payloads.flatMap((gpx) => euroVeloAdapter.parse(gpx));
	logger.log(`Parsed ${seeds.length} EuroVelo routes from ${payloads.length} GPX file(s).`);

	await RequestContext.create(orm.em, async () => {
		await externalRoutes.ensureSource(EUROVELO_SOURCE);
		const result = await externalRoutes.upsertSeedRoutes(EUROVELO_SOURCE.key, seeds);
		logger.log(
			`Done: ${result.inserted} inserted, ${result.updated} updated, ${result.unchanged} unchanged, ${result.removed} removed.`,
		);
	});

	await app.close();
}

void seedEuroVelo();
