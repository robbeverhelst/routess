import { Migration } from "@mikro-orm/migrations";

// Automated seed refresh (ADR 0033 follow-up): a SeedSource with a stable
// bulk feed URL gets re-pulled on a schedule; without one it stays manual.
export class Migration20260610000000 extends Migration {
	override async up(): Promise<void> {
		this.addSql(`alter table "seed_source" add column "feed_url" varchar(255) null;`);
	}

	override async down(): Promise<void> {
		this.addSql(`alter table "seed_source" drop column "feed_url";`);
	}
}
