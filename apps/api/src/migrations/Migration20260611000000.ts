import { Migration } from "@mikro-orm/migrations";

// Admin seeding panel: surface the outcome of the latest automatic refresh
// so a silently failing source is visible, not just an aging last-sync.
export class Migration20260611000000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "seed_source" add column "last_refresh_error" text null;`);
		this.addSql(`alter table "seed_source" add column "last_refresh_stats" jsonb null;`);
	}

	override async down(): Promise<void> {
		this.addSql(`alter table "seed_source" drop column "last_refresh_error";`);
		this.addSql(`alter table "seed_source" drop column "last_refresh_stats";`);
	}
}
