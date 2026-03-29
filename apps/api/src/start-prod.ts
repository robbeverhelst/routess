import "reflect-metadata";
import { MikroORM } from "@mikro-orm/core";
import { bootstrap } from "./main";
import config from "./mikro-orm.config";

async function startProductionApp() {
	// Run migrations in-process so production startup does not depend on the CLI runtime.
	const orm = await MikroORM.init(config);

	try {
		await orm.getMigrator().up();
	} finally {
		await orm.close(true);
	}

	await bootstrap();
}

void startProductionApp();
