import { MikroORM, RequestContext } from "@mikro-orm/core";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { loadEnvironment } from "../config/app-config";
import { PlacesService } from "../places/places.service";

const logger = new Logger("BackfillPlaces");

// Idempotent Place + bbox backfill (#233). Safe to re-run: it only touches
// null fields. Requires MAPBOX_PUBLIC_TOKEN for the place part; bbox fills
// regardless. Run with: bun run backfill:places
async function backfillPlaces() {
	loadEnvironment();
	const app = await NestFactory.createApplicationContext(AppModule, { logger: ["warn", "error"] });
	const orm = app.get(MikroORM);
	const places = app.get(PlacesService);

	await RequestContext.create(orm.em, async () => {
		logger.log(`Geocoding ${places.enabled ? "enabled" : "DISABLED: set MAPBOX_PUBLIC_TOKEN"}`);
		const { boxed, placed } = await places.backfillMissing();
		const external = await places.backfillExternalMissing();
		logger.log(`Done: ${boxed} bboxes, ${placed} route places, ${external.placed} external route places filled.`);
	});

	await app.close();
}

void backfillPlaces();
