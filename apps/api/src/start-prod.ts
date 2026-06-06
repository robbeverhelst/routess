import "reflect-metadata";
import { MikroORM } from "@mikro-orm/core";
import { bootstrap } from "./main";
import config from "./mikro-orm.config";

const MIGRATION_LOCK_ID = 7_268_873_770_001;

async function startProductionApp() {
	// Run migrations in-process so production startup does not depend on the CLI runtime.
	// The advisory lock prevents concurrent replicas from running the migrator at
	// the same time during rolling deploys.
	const orm = await MikroORM.init(config);
	const connection = orm.em.getConnection();

	try {
		await connection.execute("select pg_advisory_lock(?)", [MIGRATION_LOCK_ID]);
		await orm.migrator.up();
	} finally {
		await connection.execute("select pg_advisory_unlock(?)", [MIGRATION_LOCK_ID]).catch(() => undefined);
		await orm.close(true);
	}

	await bootstrap();
}

void startProductionApp();
