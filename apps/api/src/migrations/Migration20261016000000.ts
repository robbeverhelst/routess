import { Migration } from "@mikro-orm/migrations";

// Route.clientRef: an idempotency key the client picks, unique per User, so
// claiming a device's LocalRoutes into the account twice cannot duplicate
// them. Null for every existing Route; Postgres treats nulls as distinct, so
// the unique constraint only binds Routes that carry one.
export class Migration20261016000000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "route" add column "client_ref" varchar(255) null;`);
		this.addSql(
			`alter table "route" add constraint "route_user_id_client_ref_unique" unique ("user_id", "client_ref");`,
		);
	}

	override async down(): Promise<void> {
		this.addSql(`alter table "route" drop constraint "route_user_id_client_ref_unique";`);
		this.addSql(`alter table "route" drop column "client_ref";`);
	}
}
