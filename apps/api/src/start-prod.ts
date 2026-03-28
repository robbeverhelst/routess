import "reflect-metadata";
import { MikroORM } from "@mikro-orm/core";
import { bootstrap } from "./main";
import config from "./mikro-orm.config";

async function startProductionApp() {
	const orm = await MikroORM.init(config);

	try {
		await orm.getMigrator().up();
	} finally {
		await orm.close(true);
	}

	await bootstrap();
}

void startProductionApp();
